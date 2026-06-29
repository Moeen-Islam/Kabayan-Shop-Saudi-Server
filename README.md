# Kabayan Shop Saudi - Backend Server

This is the REST API backend server that manages products, categories, shipping locations, discount coupons, orders, and shop settings.

---

## 📦 Key Dependencies
* **Core Framework**: `Express` (REST router)
* **Access Control**: Cross-Origin Resource Sharing (`CORS`) middleware
* **Environment Configuration**: `Dotenv`
* **Transpiler & Builder**: `esbuild` (transpiles TypeScript to single CJS bundle), `tsx` (runs TS in dev mode)
* **TypeScript**: Type checking and definitions

---

## ⚡ Development & Scripts

### Environment Variables (`server/.env`)
Create a `.env` file in the `/server` directory:
PORT=5000
ADMIN_EMAIL=admin@kabayanshopksa.com
ADMIN_PASSWORD=admin123
DB_PATH=/optional/path/to/db.json
IMGBB_API_KEY=your_free_imgbb_api_key_for_permanent_images
```

> [!TIP]
> **ImgBB Integration**: To ensure your product images are never lost on server restarts or git pushes (since serverless filesystems are ephemeral), register for a free account at [ImgBB](https://imgbb.com/) and create a free API Key, then add it to your environment variables. The server will automatically detect it and host your images permanently on ImgBB's global high-speed CDN. Otherwise, it will fall back to local disk storage.


### Run Locally
Install dependencies and launch the dev server:
```bash
npm install
npm run dev
```

### Production Build
Compile TypeScript code to a single bundled CommonJS file in `/server/dist/server.cjs` using `esbuild`:
```bash
npm run build
```

---

## 💾 Persistent Storage Configuration
To prevent your products and orders from resetting when the server container sleeps or redeploys, you have two options:

### Option A: Free MongoDB Atlas (Recommended for Render Free Tier)
Since Render's free tier does not support persistent disks, you can connect a free MongoDB Atlas cluster:
1. Create a free shared cluster on [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Copy your connection string (e.g. `mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority`).
3. Add an environment variable to your server host dashboard:
   * **Key**: `MONGO_URI`
   * **Value**: (Your MongoDB connection string)
4. On startup, the server automatically connects, seeds your default configurations from `db.json`, and caches reads/writes in memory for maximum speed.

### Option B: Persistent Disk Volume (Requires Paid Render/Railway Instance)
If you are using a paid instance type that supports disks:
1. Mount a volume at path `/data`.
2. Add an environment variable to your server host dashboard:
   * **Key**: `DB_PATH`
   * **Value**: `/data/db.json`
3. On first startup, the server will copy your default configuration and category seed data to `/data/db.json` automatically.

---

## ☁️ Deployment Instructions
1. **Root Directory**: `server`
2. **Build Command**: `npm install && npm run build`
3. **Start Command**: `npm run start` (which triggers `node dist/server.cjs`)
4. Configure necessary environment variables in your server provider console (`ADMIN_EMAIL`, `ADMIN_PASSWORD`, `MONGO_URI` or `DB_PATH`, `PORT`).
