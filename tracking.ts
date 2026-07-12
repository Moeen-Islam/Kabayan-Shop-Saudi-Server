import crypto from "crypto";
import { Order } from "./types";
import { getDb, saveDb } from "./db";

// Helper to hash user data as required by Meta's privacy compliance (SHA-256)
function sha256(text: string): string {
  return crypto.createHash("sha256").update(text.toLowerCase().trim()).digest("hex");
}

// Normalize phone numbers: Meta standard requires country code (no +, no leading 0s/00s)
function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/\D/g, "");
  // Strip leading 00 if it exists
  if (cleaned.startsWith("00")) {
    cleaned = cleaned.substring(2);
  }
  // Normalize Saudi phone numbers (starts with 05 and length 10 -> starts with 9665)
  if (cleaned.startsWith("05") && cleaned.length === 10) {
    cleaned = "966" + cleaned.substring(1);
  } else if (cleaned.startsWith("5") && cleaned.length === 9) {
    cleaned = "966" + cleaned;
  }
  return cleaned;
}

// Clean phone numbers and hash
function hashPhone(phone: string): string {
  return sha256(normalizePhone(phone));
}

// Extract and hash first name
function hashFirstName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  const firstName = parts[0] || "";
  return sha256(firstName);
}

export async function trackServerEvent(
  eventName: string,
  eventId: string,
  userDataInput: {
    whatsapp?: string;
    customerName?: string;
    externalId?: string;
  },
  customDataInput: any,
  req: any
) {
  try {
    const db = getDb();
    const pixelId = db.settings?.metaPixelId;
    const fbAccessToken = db.settings?.fbAccessToken || process.env.FB_ACCESS_TOKEN;

    if (!pixelId) {
      console.log(`[Meta CAPI] Skipping server event '${eventName}': Meta Pixel ID is not configured.`);
      return;
    }

    if (!fbAccessToken) {
      console.log(`[Meta CAPI] Skipping server event '${eventName}': Access Token is not configured.`);
      return;
    }

    // Prepare User Data (Hashed for privacy compliance)
    const userData: any = {
      country: [sha256("sa")] // Saudi Arabia default for this regional shop
    };

    // Phone Hash matching
    if (userDataInput.whatsapp) {
      userData.ph = [hashPhone(userDataInput.whatsapp)];
      // Email Hash matching: Derive a consistent email from the cleaned phone number
      const cleaned = normalizePhone(userDataInput.whatsapp);
      userData.em = [sha256(`${cleaned}@kabayanshopksa.com`)];
    }

    // First Name Hash matching
    if (userDataInput.customerName) {
      userData.fn = [hashFirstName(userDataInput.customerName)];
    }

    // External ID matching (Must match client-side raw format for deduplication and matching)
    if (userDataInput.externalId) {
      userData.external_id = userDataInput.externalId;
    }

    // Client IP and User Agent are highly valuable for matching
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    if (ip) {
      // If multiple IPs are forwarded, extract the first one
      const clientIp = typeof ip === "string" ? ip.split(",")[0].trim() : ip;
      userData.client_ip_address = clientIp;
    }

    const userAgent = req.headers["user-agent"];
    if (userAgent) {
      userData.client_user_agent = userAgent;
    }

    // Extract cookies (_fbp and _fbc)
    const cookies = req.headers.cookie || "";
    const fbpMatch = cookies.match(/_fbp=([^;]+)/);
    const fbcMatch = cookies.match(/_fbc=([^;]+)/);
    if (fbpMatch) {
      userData.fbp = fbpMatch[1].trim();
    }
    if (fbcMatch) {
      userData.fbc = fbcMatch[1].trim();
    }

    // Dynamic resolve of referer source URL with fallback
    let sourceUrl = req.headers["referer"] || req.headers["origin"] || "https://kabayan-shop-saudi.vercel.app/";
    if (typeof sourceUrl === "string" && !sourceUrl.startsWith("http")) {
      sourceUrl = "https://kabayan-shop-saudi.vercel.app/";
    }

    // Build payload
    const payload: any = {
      data: [
        {
          event_name: eventName,
          event_time: Math.floor(Date.now() / 1000),
          event_id: eventId, // Must match client-side eventID for deduplication
          event_source_url: sourceUrl,
          action_source: "website",
          user_data: userData,
          custom_data: customDataInput
        }
      ]
    };

    if (process.env.FB_TEST_EVENT_CODE) {
      payload.test_event_code = process.env.FB_TEST_EVENT_CODE.trim();
    }

    console.log(`[Meta CAPI] Sending server event '${eventName}' (Event ID: ${eventId})...`);

    const res = await fetch(`https://graph.facebook.com/v20.0/${pixelId}/events?access_token=${fbAccessToken}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const resData = await res.json() as any;
    if (res.ok) {
      console.log(`[Meta CAPI] Successfully sent server event '${eventName}'. Meta response:`, resData);
    } else {
      console.error(`[Meta CAPI] Meta API returned error for event '${eventName}':`, resData);
    }
  } catch (err: any) {
    console.error(`[Meta CAPI] Failed to dispatch server event '${eventName}':`, err.message);
  }
}

export async function trackServerPurchase(order: Order, req: any) {
  try {
    const db = getDb();
    const dbOrder = db.orders.find(o => o.id === order.id);

    if (dbOrder && dbOrder.capiTracked) {
      console.log(`[Meta CAPI] Skipping CAPI purchase event for order ${order.orderNumber} (Event ID: ${order.id}) as it was already tracked.`);
      return;
    }

    const contents = order.items.map(item => ({
      id: item.productId,
      quantity: item.quantity,
      item_price: item.price
    }));

    const externalId = req.headers["x-external-id"] || order.id;

    const userDataInput = {
      whatsapp: order.whatsapp,
      customerName: order.customerName,
      externalId: typeof externalId === "string" ? externalId : undefined
    };

    const customData = {
      value: order.grandTotal,
      currency: db.settings?.currency || "SAR",
      content_type: "product",
      contents: contents
    };

    await trackServerEvent("Purchase", order.id, userDataInput, customData, req);

    if (dbOrder) {
      dbOrder.capiTracked = true;
      saveDb(db);
      console.log(`[Meta CAPI] Order ${order.id} marked as capiTracked in database.`);
    }
  } catch (err: any) {
    console.error("[Meta CAPI] Failed to dispatch Purchase Conversions API event:", err.message);
  }
}
