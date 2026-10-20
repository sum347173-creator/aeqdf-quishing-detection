import mongoose from "mongoose";

const scanSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  url: { type: String, required: true },
  features: { type: mongoose.Schema.Types.Mixed, required: true },
  verdict: { type: String, enum: ["Safe", "Suspicious", "Malicious"], required: true },
  riskScore: { type: Number, required: true, min: 0, max: 100 },
  confidence: { type: Number },
  explanation: [{
    feature: String,
    impact: Number,
    direction: String,
  }],
  domainCache: { type: mongoose.Schema.Types.Mixed }, // WHOIS/DNS/SafeBrowsing snapshot
  createdAt: { type: Date, default: Date.now, index: true },
});

export default mongoose.model("Scan", scanSchema);
