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
```env
PORT=5000
ADMIN_EMAIL=admin@kabayanshopksa.com
ADMIN_PASSWORD=admin123
DB_PATH=/optional/path/to/db.json
```

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
To prevent your products and orders from resetting when the server container sleeps or redeploys, you must mount a **Persistent Volume**:
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
4. Configure necessary environment variables in your server provider console (`ADMIN_EMAIL`, `ADMIN_PASSWORD`, `DB_PATH`, `PORT`).
