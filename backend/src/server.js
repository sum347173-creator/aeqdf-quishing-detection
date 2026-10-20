import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";

import { connectDB } from "./config/db.js";
import authRoutes from "./routes/auth.js";
import scanRoutes from "./routes/scan.js";

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || "http://localhost:5173" }));
app.use(express.json());

// Scanning triggers paid/rate-limited external lookups — throttle it.
const scanLimiter = rateLimit({ windowMs: 60 * 1000, max: 20 });

app.get("/health", (req, res) => res.json({ status: "ok" }));
app.use("/api/auth", authRoutes);
app.use("/api/scans", scanLimiter, scanRoutes);

const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => {
    app.listen(PORT, () => console.log(`[server] AEQDF backend listening on :${PORT}`));
  })
  .catch((err) => {
    console.error("[server] Failed to start:", err.message);
    process.exit(1);
  });
