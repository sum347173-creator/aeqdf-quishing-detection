"""
AEQDF — Phase 2: FastAPI ML service.

Loads the artifact produced by training/train_model.py ONCE at startup,
exposes /health and /predict. Run with:

    uvicorn app.main:app --reload --port 8000

This file is deliberately written to work as soon as
artifacts/aeqdf_ensemble.joblib exists — no changes needed after Phase 1
finishes, as long as Phase 3's feature extractor produces the same
feature names in the same order (see /feature-schema below).
"""

import os
from typing import Dict

import joblib
import numpy as np
import shap
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

ARTIFACT_PATH = os.environ.get("MODEL_PATH", "artifacts/aeqdf_ensemble.joblib")

app = FastAPI(title="AEQDF ML Service", version="0.1.0")

# Lock this down to the real backend URL in production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

_state: Dict = {"loaded": False}


class FeatureVector(BaseModel):
    # Accept an arbitrary dict of feature_name -> value. Validation against
    # the trained feature list happens in predict(), not here, so the error
    # message can name exactly which features are missing or unexpected.
    features: Dict[str, float]


def load_artifact():
    if not os.path.exists(ARTIFACT_PATH):
        print(f"[startup] WARNING: no model artifact at {ARTIFACT_PATH}. "
              f"/predict will return 503 until Phase 1 training is complete.")
        return
    artifact = joblib.load(ARTIFACT_PATH)
    _state.update(artifact)
    _state["explainer"] = shap.TreeExplainer(artifact["rf"])
    _state["loaded"] = True
    print(f"[startup] Model loaded. {len(artifact['feature_names'])} features, "
          f"threshold={artifact['threshold']:.4f}")


@app.on_event("startup")
def on_startup():
    load_artifact()


@app.get("/health")
def health():
    return {
        "status": "ok",
        "model_loaded": _state["loaded"],
        "feature_count": len(_state.get("feature_names", [])),
    }


@app.get("/feature-schema")
def feature_schema():
    """Phase 3's feature extractor must produce exactly these keys."""
    if not _state["loaded"]:
        raise HTTPException(503, "Model not loaded yet — run Phase 1 training first.")
    return {"feature_names": _state["feature_names"]}


def band(score: float) -> str:
    if score <= 30:
        return "Safe"
    if score <= 70:
        return "Suspicious"
    return "Malicious"


def explain(feature_row: np.ndarray, feature_names, top_n=6):
    sv = _state["explainer"].shap_values(feature_row.reshape(1, -1))
    # Same version-dependent shape handling as training/train_model.py:
    # list -> [class0, class1]; 3D array -> (samples, features, classes).
    if isinstance(sv, list):
        sv = sv[1]
    elif hasattr(sv, "ndim") and sv.ndim == 3:
        sv = sv[:, :, 1]
    sv = sv[0]  # single row we predicted for
    idx = np.argsort(np.abs(sv))[::-1][:top_n]
    out = []
    for i in idx:
        i = int(i)
        out.append({
            "feature": feature_names[i],
            "impact": round(float(sv[i]), 4),
            "direction": "increases risk" if sv[i] > 0 else "decreases risk",
        })
    return out


@app.post("/predict")
def predict(payload: FeatureVector):
    if not _state["loaded"]:
        raise HTTPException(503, "Model not loaded yet — run Phase 1 training first.")

    names = _state["feature_names"]
    missing = [n for n in names if n not in payload.features]
    if missing:
        raise HTTPException(
            400,
            f"Missing {len(missing)} required features, e.g. {missing[:5]}. "
            f"See /feature-schema for the full required list.",
        )

    row = np.array([payload.features[n] for n in names], dtype=float).reshape(1, -1)
    row_scaled = _state["scaler"].transform(row)

    w1, w2, w3 = _state["weights"]
    p_rf = _state["rf"].predict_proba(row_scaled)[0, 1]
    p_xgb = _state["xgb"].predict_proba(row_scaled)[0, 1]
    p_lgbm = _state["lgbm"].predict_proba(row_scaled)[0, 1]
    p_ens = w1 * p_rf + w2 * p_xgb + w3 * p_lgbm

    risk_score = round(float(p_ens) * 100, 1)
    verdict = band(risk_score)
    factors = explain(row_scaled[0], names)

    return {
        "verdict": verdict,
        "risk_score": risk_score,
        "confidence": round(float(max(p_ens, 1 - p_ens)), 4),
        "threshold": _state["threshold"],
        "component_probabilities": {
            "random_forest": round(float(p_rf), 4),
            "xgboost": round(float(p_xgb), 4),
            "lightgbm": round(float(p_lgbm), 4),
        },
        "explanation": factors,
    }
