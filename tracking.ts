import crypto from "crypto";
import { Order } from "./types";
import { getDb } from "./db";

// Helper to hash user data as required by Meta's privacy compliance (SHA-256)
function sha256(text: string): string {
  return crypto.createHash("sha256").update(text.toLowerCase().trim()).digest("hex");
}

// Clean phone numbers (retain only digits) and hash
function hashPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  return sha256(cleaned);
}

// Extract and hash first name
function hashFirstName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  const firstName = parts[0] || "";
  return sha256(firstName);
}

export async function trackServerPurchase(order: Order, req: any) {
  try {
    const db = getDb();
    const pixelId = db.settings?.metaPixelId;
    const fbAccessToken = process.env.FB_ACCESS_TOKEN || db.settings?.fbAccessToken;

    if (!pixelId) {
      console.log("[Meta CAPI] Skipping server-side event: Meta Pixel ID is not configured.");
      return;
    }

    if (!fbAccessToken) {
      console.log("[Meta CAPI] Skipping server-side event: Access Token is not configured.");
      return;
    }

    // Prepare User Data (Hashed for privacy compliance)
    const userData: any = {
      ph: [hashPhone(order.whatsapp)],
      fn: [hashFirstName(order.customerName)],
      ge: [], // gender (optional)
      country: [sha256("sa")] // Saudi Arabia default for this regional shop
    };

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

    // Format custom data for purchase contents
    const contents = order.items.map(item => ({
      id: item.productId,
      quantity: item.quantity,
      item_price: item.price
    }));

    // Build the request body structure
    const payload = {
      data: [
        {
          event_name: "Purchase",
          event_time: Math.floor(Date.now() / 1000),
          event_id: order.id, // Must match client-side eventID for deduplication
          event_source_url: `${req.headers["referer"] || req.headers["origin"] || ""}/`,
          action_source: "website",
          user_data: userData,
          custom_data: {
            value: order.grandTotal,
            currency: db.settings?.currency || "SAR",
            content_type: "product",
            contents: contents
          }
        }
      ]
    };

    console.log(`[Meta CAPI] Sending server Purchase event for order ${order.orderNumber} (Event ID: ${order.id})...`);

    const res = await fetch(`https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${fbAccessToken}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const resData = await res.json() as any;
    if (res.ok) {
      console.log(`[Meta CAPI] Successfully sent Purchase event for order ${order.orderNumber}. Meta response:`, resData);
    } else {
      console.error(`[Meta CAPI] Meta API returned error for order ${order.orderNumber}:`, resData);
    }
  } catch (err: any) {
    console.error("[Meta CAPI] Failed to dispatch Conversions API event:", err.message);
  }
}
