import express from "express";
import path from "path";
import fs from "fs";
import cors from "cors";
import dotenv from "dotenv";
import { getDb, saveDb, initDatabase } from "./db";
import { Product, Category, Order, DeliveryArea, Coupon, ShopSettings, DashboardStats } from "./types";

// Load environment variables from .env file
dotenv.config();

async function startServer() {
  // Initialize database (connects and loads MongoDB document cache if MONGO_URI is configured)
  await initDatabase();

  const app = express();
  const PORT = process.env.PORT || 5000;

  // Enable CORS for frontend clients dynamically
  const allowedOrigins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173"
  ];

  if (process.env.CLIENT_URL) {
    allowedOrigins.push(process.env.CLIENT_URL.replace(/\/$/, ""));
  }

  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, etc.)
      if (!origin) return callback(null, true);
      
      const isAllowed = allowedOrigins.includes(origin) || origin.endsWith(".vercel.app");
      if (isAllowed) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    credentials: true
  }));

  // Body parser with size limits for base64 uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Determine uploads directory (use same folder as DB_PATH if persistent volume is mounted)
  const dbPathEnv = process.env.DB_PATH;
  const uploadsDir = dbPathEnv 
    ? path.join(path.dirname(dbPathEnv), "uploads") 
    : path.join(process.cwd(), "uploads");

  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // Serve uploads folder statically
  app.use("/uploads", express.static(uploadsDir));

  // Helper: Simple Admin Auth Middleware
  const adminAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    const expectedToken = "Bearer kabayan-admin-super-secure-token-2026";
    if (authHeader === expectedToken) {
      next();
    } else {
      res.status(401).json({ error: "Unauthorized access to admin API" });
    }
  };

  // ----------------------------------------------------
  // API ROUTES
  // ----------------------------------------------------

  // Server health/status check
  app.get("/", (req, res) => {
    res.json({ message: "Kabayan Shop Saudi API Server is active." });
  });

  // 1. Admin Login
  app.post("/api/admin/login", (req, res) => {
    const { email, password } = req.body;
    const db = getDb();
    const dbEmail = db.settings?.adminEmail || process.env.ADMIN_EMAIL || "admin@kabayanshopksa.com";
    const dbPassword = db.settings?.adminPassword || process.env.ADMIN_PASSWORD || "admin123";

    if (email === dbEmail && password === dbPassword) {
      res.json({
        success: true,
        token: "kabayan-admin-super-secure-token-2026",
        admin: { email }
      });
    } else {
      res.status(401).json({ error: "Invalid admin email or password" });
    }
  });

  // Admin image upload API (Base64)
  app.post("/api/admin/upload", adminAuth, async (req, res) => {
    const { filename, data } = req.body;
    if (!filename || !data) {
      return res.status(400).json({ error: "Filename and data are required" });
    }

    try {
      // Data is expected to be a data-url: "data:image/png;base64,..." or similar
      const matches = data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (!matches || matches.length !== 3) {
        return res.status(400).json({ error: "Invalid base64 image data format" });
      }

      // 1. Check if ImgBB API Key is configured for permanent cloud image hosting (Recommended)
      if (process.env.IMGBB_API_KEY) {
        try {
          console.log("Uploading image to ImgBB CDN...");
          const base64Data = matches[2];
          
          const formData = new URLSearchParams();
          formData.append("image", base64Data);
          
          const imgbbResponse = await fetch(`https://api.imgbb.com/1/upload?key=${process.env.IMGBB_API_KEY}`, {
            method: "POST",
            body: formData,
            headers: {
              "Content-Type": "application/x-www-form-urlencoded"
            }
          });
          
          if (imgbbResponse.ok) {
            const result = await imgbbResponse.json() as any;
            if (result && result.data && result.data.url) {
              const imageUrl = result.data.url;
              console.log("Image uploaded to ImgBB successfully:", imageUrl);
              return res.json({ success: true, imageUrl });
            }
          }
          const errText = await imgbbResponse.text();
          console.error("ImgBB upload failed, falling back to local storage:", errText);
        } catch (uploadErr) {
          console.error("Failed to upload to ImgBB, falling back to local storage:", uploadErr);
        }
      }

      // 2. Fallback to Local Persistent File Storage
      const imageBuffer = Buffer.from(matches[2], "base64");
      const uniqueFilename = `${Date.now()}-${filename}`;
      const absolutePath = path.join(uploadsDir, uniqueFilename);
      
      fs.writeFileSync(absolutePath, imageBuffer);
      
      // Resolve absolute url using host headers
      const proto = req.headers["x-forwarded-proto"] || req.protocol;
      const host = req.headers["x-forwarded-host"] || req.get("host");
      const imageUrl = `${proto}://${host}/uploads/${uniqueFilename}`;
      
      res.json({ success: true, imageUrl });
    } catch (e) {
      console.error("Image upload failed", e);
      res.status(500).json({ error: "Failed to upload image" });
    }
  });

  // 2. Settings (Public GET, Admin POST)
  app.get("/api/settings", (req, res) => {
    const db = getDb();
    const publicSettings = { ...db.settings };
    delete publicSettings.adminEmail;
    delete publicSettings.adminPassword;
    res.json(publicSettings);
  });

  app.post("/api/settings", adminAuth, (req, res) => {
    const db = getDb();
    db.settings = { ...db.settings, ...req.body };
    saveDb(db);
    res.json({ success: true, settings: db.settings });
  });

  // 3. Categories (Public GET, Admin POST/DELETE)
  app.get("/api/categories", (req, res) => {
    const db = getDb();
    res.json(db.categories);
  });

  app.post("/api/categories", adminAuth, (req, res) => {
    const db = getDb();
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Category name is required" });
    }
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    
    // Check if category already exists
    if (db.categories.some(c => c.slug === slug)) {
      return res.status(400).json({ error: "Category already exists" });
    }

    const newCategory: Category = {
      id: "cat-" + Date.now(),
      name,
      slug
    };

    db.categories.push(newCategory);
    saveDb(db);
    res.json({ success: true, category: newCategory });
  });

  app.delete("/api/categories/:id", adminAuth, (req, res) => {
    const db = getDb();
    const { id } = req.params;
    db.categories = db.categories.filter(c => c.id !== id);
    saveDb(db);
    res.json({ success: true });
  });

  // 4. Delivery Areas (Public GET, Admin POST/PUT/DELETE)
  app.get("/api/areas", (req, res) => {
    const db = getDb();
    res.json(db.areas);
  });

  app.post("/api/areas", adminAuth, (req, res) => {
    const db = getDb();
    const { name, charge, freeDeliveryAbove, minOrderValue } = req.body;
    if (!name || charge === undefined) {
      return res.status(400).json({ error: "Name and charge are required" });
    }

    const newArea: DeliveryArea = {
      id: "area-" + Date.now(),
      name,
      charge: Number(charge),
      freeDeliveryAbove: freeDeliveryAbove !== undefined && freeDeliveryAbove !== null && freeDeliveryAbove !== "" ? Number(freeDeliveryAbove) : null,
      minOrderValue: minOrderValue !== undefined && minOrderValue !== null && minOrderValue !== "" ? Number(minOrderValue) : null
    };

    db.areas.push(newArea);
    saveDb(db);
    res.json({ success: true, area: newArea });
  });

  app.put("/api/areas/:id", adminAuth, (req, res) => {
    const db = getDb();
    const { id } = req.params;
    const { name, charge, freeDeliveryAbove, minOrderValue } = req.body;

    const areaIndex = db.areas.findIndex(a => a.id === id);
    if (areaIndex === -1) {
      return res.status(404).json({ error: "Delivery area not found" });
    }

    db.areas[areaIndex] = {
      ...db.areas[areaIndex],
      name: name !== undefined ? name : db.areas[areaIndex].name,
      charge: charge !== undefined ? Number(charge) : db.areas[areaIndex].charge,
      freeDeliveryAbove: freeDeliveryAbove !== undefined ? (freeDeliveryAbove !== null && freeDeliveryAbove !== "" ? Number(freeDeliveryAbove) : null) : db.areas[areaIndex].freeDeliveryAbove,
      minOrderValue: minOrderValue !== undefined ? (minOrderValue !== null && minOrderValue !== "" ? Number(minOrderValue) : null) : db.areas[areaIndex].minOrderValue
    };

    saveDb(db);
    res.json({ success: true, area: db.areas[areaIndex] });
  });

  app.delete("/api/areas/:id", adminAuth, (req, res) => {
    const db = getDb();
    const { id } = req.params;
    db.areas = db.areas.filter(a => a.id !== id);
    saveDb(db);
    res.json({ success: true });
  });

  // 5. Coupons (Public GET specific check, Admin POST/DELETE)
  app.get("/api/coupons", adminAuth, (req, res) => {
    const db = getDb();
    res.json(db.coupons);
  });

  // Validate a coupon (Public)
  app.get("/api/coupons/validate/:code", (req, res) => {
    const db = getDb();
    const { code } = req.params;
    const coupon = db.coupons.find(c => c.code.toUpperCase() === code.toUpperCase());
    
    if (!coupon) {
      return res.status(404).json({ error: "Invalid coupon code" });
    }

    // Check expiry
    const expiry = new Date(coupon.expiryDate);
    const now = new Date();
    if (expiry < now) {
      return res.status(400).json({ error: "Coupon code has expired" });
    }

    res.json(coupon);
  });

  app.post("/api/coupons", adminAuth, (req, res) => {
    const db = getDb();
    const { code, discountType, discountValue, expiryDate } = req.body;
    if (!code || !discountType || discountValue === undefined || !expiryDate) {
      return res.status(400).json({ error: "All coupon fields are required" });
    }

    const newCoupon: Coupon = {
      id: "coup-" + Date.now(),
      code: code.toUpperCase(),
      discountType,
      discountValue: Number(discountValue),
      expiryDate
    };

    db.coupons.push(newCoupon);
    saveDb(db);
    res.json({ success: true, coupon: newCoupon });
  });

  app.delete("/api/coupons/:id", adminAuth, (req, res) => {
    const db = getDb();
    const { id } = req.params;
    db.coupons = db.coupons.filter(c => c.id !== id);
    saveDb(db);
    res.json({ success: true });
  });

  // 6. Products (Public GET, GET by slug, Admin POST/PUT/DELETE)
  app.get("/api/products", (req, res) => {
    const db = getDb();
    res.json(db.products);
  });

  app.get("/api/products/slug/:slug", (req, res) => {
    const db = getDb();
    const { slug } = req.params;
    const product = db.products.find(p => p.slug === slug);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json(product);
  });

  app.post("/api/products", adminAuth, (req, res) => {
    const db = getDb();
    const {
      name,
      category,
      description,
      images,
      price,
      offerPrice,
      stock,
      sizes,
      colors,
      packageTypes,
      packagePrices,
      status,
      hasDualSizes,
      dualSizesTitle1,
      dualSizesTitle2,
      sizes2,
      colorImageMap
    } = req.body;

    if (!name || !category || !price || stock === undefined) {
      return res.status(400).json({ error: "Name, category, price, and stock are required" });
    }

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") + "-" + Math.floor(1000 + Math.random() * 9000);

    const newProduct: Product = {
      id: "prod-" + Date.now(),
      name,
      slug,
      category,
      description: description || "",
      images: images && images.length > 0 ? images : ["https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=1200"],
      price: Number(price),
      offerPrice: offerPrice ? Number(offerPrice) : undefined,
      stock: Number(stock),
      sizes: sizes || ["Free Size"],
      colors: colors || ["Multi"],
      packageTypes: packageTypes || ["Single Piece"],
      packagePrices: packagePrices || {},
      status: status || "active",
      createdAt: new Date().toISOString(),
      hasDualSizes: !!hasDualSizes,
      dualSizesTitle1: dualSizesTitle1 || "Size 1",
      dualSizesTitle2: dualSizesTitle2 || "Size 2",
      sizes2: sizes2 || [],
      colorImageMap: colorImageMap || {}
    };

    db.products.push(newProduct);
    saveDb(db);
    res.json({ success: true, product: newProduct });
  });

  app.put("/api/products/:id", adminAuth, (req, res) => {
    const db = getDb();
    const { id } = req.params;
    const productIndex = db.products.findIndex(p => p.id === id);
    if (productIndex === -1) {
      return res.status(404).json({ error: "Product not found" });
    }

    const currentProduct = db.products[productIndex];
    const updatedProduct = {
      ...currentProduct,
      ...req.body,
      price: req.body.price !== undefined ? Number(req.body.price) : currentProduct.price,
      offerPrice: req.body.offerPrice !== undefined ? (req.body.offerPrice ? Number(req.body.offerPrice) : undefined) : currentProduct.offerPrice,
      stock: req.body.stock !== undefined ? Number(req.body.stock) : currentProduct.stock,
    };

    db.products[productIndex] = updatedProduct;
    saveDb(db);
    res.json({ success: true, product: updatedProduct });
  });

  app.delete("/api/products/:id", adminAuth, (req, res) => {
    const db = getDb();
    const { id } = req.params;
    db.products = db.products.filter(p => p.id !== id);
    saveDb(db);
    res.json({ success: true });
  });

  // 7. Orders (Public POST to create, Admin GET/PUT status)
  app.get("/api/orders", adminAuth, (req, res) => {
    const db = getDb();
    // Sort orders from newest to oldest
    const sortedOrders = [...db.orders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json(sortedOrders);
  });

  function getPackageMultiplierAndDiscount(pkgName: string): { multiplier: number; discount: number } {
    const name = (pkgName || "").toLowerCase();
    let count = 1;
    const packOfMatch = name.match(/(?:pack|combo|set|pieces|pcs)\s*(?:of)?\s*(\d+)/i) || 
                        name.match(/(\d+)\s*(?:pcs|pc|piece|pieces|pack|combo|set)/i) ||
                        name.match(/^(\d+)\s*$/);
                        
    if (packOfMatch && packOfMatch[1]) {
      count = parseInt(packOfMatch[1], 10);
    } else if (name.includes("pair") || name.includes("terno")) {
      count = 2;
    } else if (name.includes("double")) {
      count = 2;
    } else if (name.includes("triple")) {
      count = 3;
    } else if (name.includes("dozen")) {
      count = 12;
    } else {
      const digitMatch = name.match(/(\d+)/);
      if (digitMatch) {
        count = parseInt(digitMatch[1], 10);
      }
    }

    if (isNaN(count) || count <= 0) {
      count = 1;
    }

    let discount = 1.0;
    if (count === 1) {
      discount = 1.0;
    } else if (count === 2) {
      discount = 0.90;
    } else if (count === 3) {
      discount = 0.85;
    } else if (count >= 4 && count <= 5) {
      discount = 0.80;
    } else if (count >= 6 && count <= 11) {
      discount = 0.75;
    } else if (count >= 12) {
      discount = 0.70;
    }

    return { multiplier: count, discount };
  }

  app.post("/api/orders", (req, res) => {
    const db = getDb();
    const {
      customerName,
      whatsapp,
      areaId,
      houseNo,
      fullAddress,
      notes,
      lat,
      lng,
      items,
      couponCode
    } = req.body;

    if (!customerName || !whatsapp || !areaId || !fullAddress || !items || items.length === 0) {
      return res.status(400).json({ error: "Missing required checkout fields" });
    }

    // Lookup area charge
    const area = db.areas.find(a => a.id === areaId);
    if (!area) {
      return res.status(400).json({ error: "Invalid delivery area" });
    }

    let deliveryCharge = area.charge;

    // Calculate product total and validate inventory
    let productTotal = 0;
    const validatedItems = [];

    for (const item of items) {
      const product = db.products.find(p => p.id === item.productId);
      if (!product) {
        return res.status(400).json({ error: `Product ${item.productName} no longer exists` });
      }

      // Check stock
      if (product.stock < item.quantity) {
        return res.status(400).json({ error: `Insufficient stock for ${product.name}. Available: ${product.stock}` });
      }

      const defaultBasePrice = product.offerPrice !== undefined ? product.offerPrice : product.price;
      const basePrice = (product.sizePrices && item.selectedSize && product.sizePrices[item.selectedSize] !== undefined)
        ? product.sizePrices[item.selectedSize]
        : defaultBasePrice;

      const { multiplier, discount } = getPackageMultiplierAndDiscount(item.selectedPackageType);
      
      let activePrice = 0;
      if (product.packagePrices && product.packagePrices[item.selectedPackageType] !== undefined) {
        activePrice = product.packagePrices[item.selectedPackageType];
      } else {
        activePrice = Math.round(basePrice * multiplier * discount);
      }

      const unitPrice = multiplier > 0 ? Math.round((activePrice / multiplier) * 100) / 100 : basePrice;
      productTotal += Math.round(unitPrice * item.quantity);

      // Deduct stock
      product.stock -= item.quantity;

      validatedItems.push({
        productId: product.id,
        productName: product.name,
        productImage: product.images[0] || "",
        quantity: item.quantity,
        price: unitPrice,
        selectedColor: item.selectedColor,
        selectedSize: item.selectedSize,
        selectedPackageType: item.selectedPackageType,
        purchasePrice: product.purchasePrice || 0,
        clothShopOwner: product.clothShopOwner || ""
      });
    }

    // Apply Coupon if present
    let discountAmount = 0;
    if (couponCode) {
      const coupon = db.coupons.find(c => c.code.toUpperCase() === couponCode.toUpperCase());
      if (coupon) {
        const expiry = new Date(coupon.expiryDate);
        if (expiry >= new Date()) {
          if (coupon.discountType === "percentage") {
            discountAmount = Math.round((productTotal * coupon.discountValue) / 100);
          } else {
            discountAmount = Math.min(coupon.discountValue, productTotal);
          }
        }
      }
    }

    if (area.freeDeliveryAbove !== undefined && area.freeDeliveryAbove !== null) {
      if (productTotal >= area.freeDeliveryAbove) {
        deliveryCharge = 0;
      }
    }

    const grandTotal = Math.max(0, productTotal - discountAmount) + deliveryCharge;
    
    // Custom regional order number generator: MT-{paddedNumber}({areaName})
    let maxSerial = 0;
    const areaOrders = db.orders.filter(o => o.areaId === areaId);
    for (const o of areaOrders) {
      const match = o.orderNumber.match(/^MT-(\d+)/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxSerial) {
          maxSerial = num;
        }
      }
    }
    const nextSerial = maxSerial > 0 ? maxSerial + 1 : areaOrders.length + 1;
    const serialStr = nextSerial < 10 ? "0" + nextSerial : String(nextSerial);
    const orderNumber = `MT-${serialStr}(${area.name})`;

    const mapLink = (lat && lng) ? `https://www.google.com/maps?q=${lat},${lng}` : req.body.mapLink;

    const newOrder: Order = {
      id: "ord-" + Date.now(),
      orderNumber,
      createdAt: new Date().toISOString(),
      customerName,
      whatsapp,
      areaId,
      areaName: area.name,
      houseNo,
      fullAddress,
      notes,
      lat: lat ? Number(lat) : undefined,
      lng: lng ? Number(lng) : undefined,
      mapLink,
      items: validatedItems,
      productTotal,
      deliveryCharge,
      discountAmount: discountAmount > 0 ? discountAmount : undefined,
      grandTotal,
      status: "Pending",
      driverDeliveryCharge: area.driverCharge || 0,
      deliveryTime: area.deliveryTime || ""
    };

    db.orders.push(newOrder);
    saveDb(db);
    res.json({ success: true, order: newOrder });
  });

  app.put("/api/orders/:id/status", adminAuth, (req, res) => {
    const db = getDb();
    const { id } = req.params;
    const { status } = req.body;

    const orderIndex = db.orders.findIndex(o => o.id === id);
    if (orderIndex === -1) {
      return res.status(404).json({ error: "Order not found" });
    }

    const allowedStatuses = ["Pending", "Confirmed", "Packed", "Shipped", "Delivered", "Cancelled"];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status value" });
    }

    // If order is transitioned from Cancelled back, or newly Cancelled, handle stock adjustments if necessary
    // To keep it simple, we decrement stock when order is placed. If cancelled, we return stock!
    if (status === "Cancelled" && db.orders[orderIndex].status !== "Cancelled") {
      // Put stock back
      for (const item of db.orders[orderIndex].items) {
        const product = db.products.find(p => p.id === item.productId);
        if (product) {
          product.stock += item.quantity;
        }
      }
    } else if (db.orders[orderIndex].status === "Cancelled" && status !== "Cancelled") {
      // Re-deduct stock
      for (const item of db.orders[orderIndex].items) {
        const product = db.products.find(p => p.id === item.productId);
        if (product) {
          product.stock = Math.max(0, product.stock - item.quantity);
        }
      }
    }

    db.orders[orderIndex].status = status;
    saveDb(db);
    res.json({ success: true, order: db.orders[orderIndex] });
  });

  app.put("/api/orders/:id/whatsapp", adminAuth, (req, res) => {
    const db = getDb();
    const { id } = req.params;
    const { whatsapp } = req.body;

    const order = db.orders.find(o => o.id === id);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    order.whatsapp = whatsapp;
    saveDb(db);
    res.json({ success: true, order });
  });

  app.delete("/api/orders/:id", adminAuth, (req, res) => {
    const db = getDb();
    const { id } = req.params;

    const orderIndex = db.orders.findIndex(o => o.id === id);
    if (orderIndex === -1) {
      return res.status(404).json({ error: "Order not found" });
    }

    const order = db.orders[orderIndex];

    // Return stock if the order wasn't cancelled yet
    if (order.status !== "Cancelled") {
      for (const item of order.items) {
        const product = db.products.find(p => p.id === item.productId);
        if (product) {
          product.stock += item.quantity;
        }
      }
    }

    db.orders.splice(orderIndex, 1);
    saveDb(db);
    res.json({ success: true, message: "Order deleted successfully" });
  });

  // 8. Admin Statistics Dashboard
  app.get("/api/admin/stats", adminAuth, (req, res) => {
    const db = getDb();
    const orders = db.orders;

    const totalOrders = orders.length;
    const pendingOrders = orders.filter(o => o.status === "Pending").length;
    const confirmedOrders = orders.filter(o => o.status === "Confirmed").length;
    const deliveredOrders = orders.filter(o => o.status === "Delivered").length;
    const cancelledOrders = orders.filter(o => o.status === "Cancelled").length;

    // Revenue only includes orders that are NOT cancelled
    const activeOrders = orders.filter(o => o.status !== "Cancelled");
    const totalRevenue = activeOrders.reduce((sum, o) => sum + o.grandTotal, 0);

    // Calculate monthly revenue (current month)
    const currentMonthStr = new Date().toISOString().substring(0, 7); // "YYYY-MM"
    const monthlyRevenue = activeOrders
      .filter(o => o.createdAt.startsWith(currentMonthStr))
      .reduce((sum, o) => sum + o.grandTotal, 0);

    // Helper to calculate profit of an order
    const calculateOrderProfit = (o: any) => {
      const totalCost = o.items.reduce((costSum: number, item: any) => {
        const purchasePrice = item.purchasePrice !== undefined 
          ? item.purchasePrice 
          : (db.products.find(p => p.id === item.productId)?.purchasePrice || 0);
        return costSum + (purchasePrice * item.quantity);
      }, 0);
      return o.grandTotal - totalCost - (o.driverDeliveryCharge || 0);
    };

    const totalProfit = activeOrders.reduce((sum, o) => sum + calculateOrderProfit(o), 0);

    const monthlyProfit = activeOrders
      .filter(o => o.createdAt.startsWith(currentMonthStr))
      .reduce((sum, o) => sum + calculateOrderProfit(o), 0);

    // Group sales and order counts by day (last 7 days)
    const salesByDayMap: { [key: string]: number } = {};
    const ordersByDayMap: { [key: string]: number } = {};

    // Initialize last 7 days
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().substring(0, 10); // "YYYY-MM-DD"
      salesByDayMap[dateStr] = 0;
      ordersByDayMap[dateStr] = 0;
    }

    // Populate actual order stats
    activeOrders.forEach(o => {
      const dateStr = o.createdAt.substring(0, 10);
      if (salesByDayMap[dateStr] !== undefined) {
        salesByDayMap[dateStr] += o.grandTotal;
      }
      if (ordersByDayMap[dateStr] !== undefined) {
        ordersByDayMap[dateStr] += 1;
      }
    });

    const salesByDay = Object.keys(salesByDayMap).map(date => ({
      date,
      amount: Math.round(salesByDayMap[date])
    }));

    const ordersByDay = Object.keys(ordersByDayMap).map(date => ({
      date,
      count: ordersByDayMap[date]
    }));

    const stats: DashboardStats = {
      totalOrders,
      pendingOrders,
      confirmedOrders,
      deliveredOrders,
      cancelledOrders,
      totalRevenue,
      monthlyRevenue,
      totalProfit,
      monthlyProfit,
      salesByDay,
      ordersByDay
    };

    res.json(stats);
  });

  app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`Kabayan Shop Saudi Server is active at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
