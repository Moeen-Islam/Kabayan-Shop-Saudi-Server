import fs from "fs";
import path from "path";
import { MongoClient } from "mongodb";
import { Product, Category, Order, DeliveryArea, Coupon, ShopSettings } from "./types";

const DB_FILE = process.env.DB_PATH || path.join(process.cwd(), "db.json");

// Ensure parent directories exist
const dbDir = path.dirname(DB_FILE);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Copy default workspace template if persistent database file is not yet created
if (!fs.existsSync(DB_FILE)) {
  const defaultTemplate = path.join(process.cwd(), "db.json");
  if (fs.existsSync(defaultTemplate)) {
    try {
      fs.copyFileSync(defaultTemplate, DB_FILE);
      console.log(`Initialized database: Copied template seed data to ${DB_FILE}`);
    } catch (err) {
      console.error(`Failed to copy seed database to ${DB_FILE}:`, err);
    }
  }
}

interface DatabaseSchema {
  products: Product[];
  categories: Category[];
  orders: Order[];
  areas: DeliveryArea[];
  coupons: Coupon[];
  settings: ShopSettings;
}

const DEFAULT_CATEGORIES: Category[] = [
  { id: "cat-1", name: "Dresses", slug: "dresses" },
  { id: "cat-2", name: "Abaya", slug: "abaya" },
  { id: "cat-3", name: "Terno", slug: "terno" },
  { id: "cat-4", name: "Denim", slug: "denim" },
  { id: "cat-5", name: "Shoes", slug: "shoes" },
  { id: "cat-6", name: "T-Shirts", slug: "t-shirts" },
  { id: "cat-7", name: "Night Wear", slug: "night-wear" },
  { id: "cat-8", name: "Luggage", slug: "luggage" },
  { id: "cat-9", name: "Combo Pack", slug: "combo-pack" },
  { id: "cat-10", name: "Cosmetics", slug: "cosmetics" },
  { id: "cat-11", name: "Watch", slug: "watch" }
];

const DEFAULT_AREAS: DeliveryArea[] = [
  { id: "area-1", name: "Riyadh", charge: 15 },
  { id: "area-2", name: "Jeddah", charge: 25 },
  { id: "area-3", name: "Dammam", charge: 20 },
  { id: "area-4", name: "Mecca", charge: 25 },
  { id: "area-5", name: "Medina", charge: 25 },
  { id: "area-6", name: "Khobar", charge: 20 },
  { id: "area-7", name: "Other Areas", charge: 40 }
];

const DEFAULT_COUPONS: Coupon[] = [
  { id: "coup-1", code: "KABAYAN10", discountType: "percentage", discountValue: 10, expiryDate: "2026-12-31" },
  { id: "coup-2", code: "WELCOME15", discountType: "fixed", discountValue: 15, expiryDate: "2026-12-31" }
];

const DEFAULT_SETTINGS: ShopSettings = {
  shopName: "Kabayan Shop Saudi",
  whatsappContact: "966501234567", // Example Saudi WhatsApp
  currency: "SAR",
  bannerImages: [
    "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=1200", // Elegant clothing banner
    "https://images.unsplash.com/photo-1483985988355-763728e1935b?q=80&w=1200"  // Premium shopping banner
  ],
  aboutUs: "Kabayan Shop Saudi is the ultimate fashion destination for premium modest clothing, dresses, denim, shoes, and nightwear in the Kingdom of Saudi Arabia. We deliver directly to your doorstep with instant location sharing and fast order updates on WhatsApp.",
  contactEmail: "info@kabayanshopksa.com",
  contactAddress: "Olaya District, Riyadh, Kingdom of Saudi Arabia",
  metaPixelId: "802803573462056",
  metaTitle: "Kabayan Shop Saudi | Premium Modest Fashion & Abayas KSA",
  metaDescription: "Discover luxury modest fashion, modern abayas, elegant dresses, and terno sets at Kabayan Shop Saudi. Cash on Delivery (COD) across Saudi Arabia with fast home delivery.",
  metaKeywords: "kabayan shop saudi, abaya riyadh, modest clothing ksa, buy dress saudi arabia, terno sets online, cod modest fashion"
};

const DEFAULT_PRODUCTS: Product[] = [
  {
    id: "prod-1",
    name: "Elegant Black Georgette Abaya with Gold Lace",
    slug: "elegant-black-abaya-gold-lace",
    category: "Abaya",
    description: "Premium quality lightweight georgette abaya featuring intricate golden lace embroidery on the sleeves and borders. Styled with a matching sheila. Ideal for everyday wear or formal gatherings.",
    images: [
      "https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?q=80&w=1000",
      "https://images.unsplash.com/photo-1609357605129-26f69add5d6e?q=80&w=1000"
    ],
    price: 180,
    offerPrice: 145,
    stock: 25,
    sizes: ["S", "M", "L", "XL", "XXL", "Free Size"],
    colors: ["Jet Black", "Midnight Blue", "Emerald Green"],
    packageTypes: ["Single Piece", "2pcs Combo (Abaya + Sheila)"],
    status: "active",
    createdAt: new Date().toISOString(),
    isTrending: true
  },
  {
    id: "prod-2",
    name: "Classic Modest Linen A-Line Maxi Dress",
    slug: "classic-modest-linen-maxi-dress",
    category: "Dresses",
    description: "A beautifully structured maxi dress made of breathable Turkish linen. It features a high waistband, comfortable round neck, and a full flare skirt. Comes with a matching fabric belt.",
    images: [
      "https://images.unsplash.com/photo-1595777457583-95e059d581b8?q=80&w=1000",
      "https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?q=80&w=1000"
    ],
    price: 210,
    offerPrice: 169,
    stock: 15,
    sizes: ["S", "M", "L", "XL"],
    colors: ["Beige", "Dusty Pink", "Sage Green", "Black"],
    packageTypes: ["Single Piece"],
    status: "active",
    createdAt: new Date().toISOString()
  },
  {
    id: "prod-3",
    name: "Premium Denim Boyfriend Jacket - Midnight Wash",
    slug: "premium-denim-boyfriend-jacket",
    category: "Denim",
    description: "Authentic, high-density cotton denim jacket featuring classic metal buttons, functional chest pockets, and a clean structured oversize design. Soft-washed for instant comfort.",
    images: [
      "https://images.unsplash.com/photo-1576995853123-5a10305d93c0?q=80&w=1000",
      "https://images.unsplash.com/photo-1611312449412-6cefac5dc3e4?q=80&w=1000"
    ],
    price: 160,
    offerPrice: 120,
    stock: 8,
    sizes: ["M", "L", "XL", "XXL"],
    colors: ["Dark Blue Wash", "Black Washed", "Light Bleach Wash"],
    packageTypes: ["Single Piece"],
    status: "active",
    createdAt: new Date().toISOString()
  },
  {
    id: "prod-4",
    name: "Summer Linen 2-Piece Terno Set (Top & Wide Pants)",
    slug: "summer-linen-2pc-terno-set",
    category: "Terno",
    description: "A comfortable, ultra-stylish 2-piece modern terno outfit featuring a relaxed button-down side-slit top and high-rise elasticated wide-leg pants. Made from premium, anti-shrink linen fabric.",
    images: [
      "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?q=80&w=1000",
      "https://images.unsplash.com/photo-1549064482-6779ba3292fe?q=80&w=1000"
    ],
    price: 220,
    offerPrice: 185,
    stock: 3,
    sizes: ["S", "M", "L", "XL", "Free Size"],
    colors: ["Oatmeal Beige", "Terracotta", "Olive Green", "White"],
    packageTypes: ["2pcs Set (Top + Pants)", "Buy 2 Sets Promo (4pcs)"],
    status: "active",
    createdAt: new Date().toISOString(),
    isTrending: true
  },
  {
    id: "prod-5",
    name: "Soft Cotton Ribbed Night Wear Sleepwear",
    slug: "soft-cotton-ribbed-sleepwear",
    category: "Night Wear",
    description: "Extremely soft, high-elastic ribbed cotton loungewear set. Includes a cozy long-sleeve tee and matching draw-string joggers. Breathable and gentle on sensitive skin.",
    images: [
      "https://images.unsplash.com/photo-1562572159-4ebcd318f4dd?q=80&w=1000",
      "https://images.unsplash.com/photo-1618333747975-650a4c9c3971?q=80&w=1000"
    ],
    price: 130,
    offerPrice: 95,
    stock: 45,
    sizes: ["S", "M", "L", "XL", "XXL"],
    colors: ["Dusty Lilac", "Soft Cream", "Charcoal Gray"],
    packageTypes: ["1 Set", "2 Sets Bundle (Super Value Offer!)"],
    status: "active",
    createdAt: new Date().toISOString()
  },
  {
    id: "prod-6",
    name: "Ultra-Comfort Suede Loafers",
    slug: "ultra-comfort-suede-loafers",
    category: "Shoes",
    description: "Fine Italian suede loafers featuring hand-stitched detailing, arch-support cushions, and a highly durable, flexible anti-slip rubber outsole. Timeless design that complements casual or smart-casual outfits.",
    images: [
      "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?q=80&w=1000",
      "https://images.unsplash.com/photo-1539185441755-769473a23570?q=80&w=1000"
    ],
    price: 250,
    offerPrice: 199,
    stock: 12,
    sizes: ["37", "38", "39", "40", "41"],
    colors: ["Honey Tan", "Classic Camel", "Rich Onyx"],
    packageTypes: ["Single Pair"],
    status: "active",
    createdAt: new Date().toISOString()
  },
  {
    id: "prod-7",
    name: "Premium Breathable Cotton Everyday Tees (Pack of 3)",
    slug: "premium-breathable-cotton-everyday-tees",
    category: "T-Shirts",
    description: "Heavyweight 220GSM organic cotton crewneck t-shirts. Features side-seam split hem, relaxed drape, and high-elastic ribbed collar. Built to retain its shape and soft texture even after many washes.",
    images: [
      "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?q=80&w=1000",
      "https://images.unsplash.com/photo-1564564321837-a57b7070ac4f?q=80&w=1000"
    ],
    price: 120,
    offerPrice: 85,
    stock: 50,
    sizes: ["M", "L", "XL", "XXL"],
    colors: ["Mixed Pack (White/Black/Beige)", "All White Trio", "All Black Trio"],
    packageTypes: ["3pcs Combo Pack", "6pcs Ultimate Combo Pack"],
    status: "active",
    createdAt: new Date().toISOString()
  }
];

// Virtual Memory Cache state
let dbCache: DatabaseSchema | null = null;
let mongoClient: MongoClient | null = null;
let useMongo = false;

export async function initDatabase() {
  // Load local DB synchronously first so the server has data immediately
  dbCache = loadLocalDb();

  const uri = process.env.MONGO_URI;
  if (uri && uri !== "your_mongo_url" && !uri.includes("placeholder") && !uri.includes("your_")) {
    console.log("Connecting to MongoDB Atlas in background...");
    
    // Connect asynchronously to avoid blocking server startup (cold starts)
    const client = new MongoClient(uri, {
      connectTimeoutMS: 3000,
      serverSelectionTimeoutMS: 3000
    });

    client.connect()
      .then(async () => {
        mongoClient = client;
        useMongo = true;
        console.log("Connected to MongoDB successfully in background!");

        const db = client.db("kabayan_shop");
        const collection = db.collection("datastore");
        const doc = await collection.findOne({ _id: "master" });

        if (doc) {
          dbCache = doc.data as DatabaseSchema;
          console.log("Database cache synced from MongoDB Atlas.");
        } else {
          // Seed database from local dbCache
          await collection.insertOne({ _id: "master", data: dbCache! });
          console.log("Initialized new database document in MongoDB Atlas.");
        }
      })
      .catch((err) => {
        console.error("Failed to connect to MongoDB in background, using local file storage:", err.message);
        useMongo = false;
      });
  } else {
    console.log("MONGO_URI not specified or is placeholder. Using local file storage.");
    useMongo = false;
  }
}

function loadLocalDb(): DatabaseSchema {
  if (!fs.existsSync(DB_FILE)) {
    const defaultDb: DatabaseSchema = {
      products: DEFAULT_PRODUCTS,
      categories: DEFAULT_CATEGORIES,
      orders: [],
      areas: DEFAULT_AREAS,
      coupons: DEFAULT_COUPONS,
      settings: DEFAULT_SETTINGS
    };
    saveLocalDb(defaultDb);
    return defaultDb;
  }
  try {
    const data = fs.readFileSync(DB_FILE, "utf-8");
    const parsed = JSON.parse(data);
    return {
      products: parsed.products || DEFAULT_PRODUCTS,
      categories: parsed.categories || DEFAULT_CATEGORIES,
      orders: parsed.orders || [],
      areas: parsed.areas || DEFAULT_AREAS,
      coupons: parsed.coupons || DEFAULT_COUPONS,
      settings: parsed.settings || DEFAULT_SETTINGS
    };
  } catch (error) {
    console.error("Error reading database file, returning default schema", error);
    return {
      products: DEFAULT_PRODUCTS,
      categories: DEFAULT_CATEGORIES,
      orders: [],
      areas: DEFAULT_AREAS,
      coupons: DEFAULT_COUPONS,
      settings: DEFAULT_SETTINGS
    };
  }
}

function saveLocalDb(db: DatabaseSchema) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf-8");
  } catch (error) {
    console.error("Error saving database file", error);
  }
}

export function getDb(): DatabaseSchema {
  if (!dbCache) {
    dbCache = loadLocalDb();
  }
  return dbCache;
}

export function saveDb(db: DatabaseSchema) {
  dbCache = db;
  if (useMongo && mongoClient) {
    const database = mongoClient.db("kabayan_shop");
    const collection = database.collection("datastore");
    collection.updateOne(
      { _id: "master" },
      { $set: { data: db } },
      { upsert: true }
    ).catch(err => {
      console.error("Failed to save database to MongoDB:", err);
    });
  } else {
    saveLocalDb(db);
  }
}
