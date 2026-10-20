import { Router } from "express";
import mongoose from "mongoose";
import Scan from "../models/Scan.js";
import { requireAuth } from "../middleware/auth.js";
import { extractFeatures } from "../services/featureExtractor.js";
import { getPrediction } from "../services/mlClient.js";

const router = Router();

function isValidUrl(str) {
  try {
    const u = new URL(str);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

// POST /api/scan  { url }
router.post("/", requireAuth, async (req, res) => {
  const { url } = req.body;
  if (!url || !isValidUrl(url)) {
    return res.status(400).json({ error: "A valid http(s) URL is required" });
  }

  try {
    const features = await extractFeatures(url);
    const prediction = await getPrediction(features);

    const scan = await Scan.create({
      userId: req.userId,
      url,
      features,
      verdict: prediction.verdict,
      riskScore: prediction.risk_score,
      confidence: prediction.confidence,
      explanation: prediction.explanation,
    });

    res.status(201).json({
      id: scan._id,
      url: scan.url,
      verdict: scan.verdict,
      riskScore: scan.riskScore,
      confidence: scan.confidence,
      explanation: scan.explanation,
      createdAt: scan.createdAt,
    });
  } catch (err) {
    res.status(502).json({ error: "Scan failed", detail: err.message });
  }
});

// GET /api/scans?page=1&limit=20
router.get("/", requireAuth, async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, parseInt(req.query.limit) || 20);

  const [items, total] = await Promise.all([
    Scan.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Scan.countDocuments({ userId: req.userId }),
  ]);

  res.json({ items, page, limit, total });
});

// GET /api/scans/stats — verdict distribution for the dashboard chart
router.get("/stats", requireAuth, async (req, res) => {
  const agg = await Scan.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(req.userId) } },
    { $group: { _id: "$verdict", count: { $sum: 1 } } },
  ]);
  res.json(agg.reduce((acc, r) => ({ ...acc, [r._id]: r.count }), {}));
});

export default router;
