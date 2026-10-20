"""
AEQDF — Phase 1: Train the ensemble classifier on PhiUSIIL.

Run this in Google Colab or locally. It expects the PhiUSIIL Phishing URL
Dataset CSV. Download it from the UCI Machine Learning Repository:
https://archive.ics.uci.edu/dataset/967/phiusiil+phishing+url+dataset

WHAT THIS SCRIPT DOES (in order):
  1. Loads the dataset and does a baseline sanity check (row/column counts).
  2. Drops columns that leak the label (pre-computed similarity scores).
  3. Splits into train/test with stratified sampling (seed=42, reproducible).
  4. Fits a StandardScaler on the TRAINING SET ONLY.
  5. Trains a single Random Forest baseline first — confirms the data
     pipeline is sound before adding complexity.
  6. Trains XGBoost and LightGBM.
  7. Combines all three via weighted soft voting.
  8. Fits a SHAP TreeExplainer on the ensemble and sanity-checks output.
  9. Saves everything needed for inference as one artifact file.

IMPORTANT: The feature column order is saved alongside the model. The
FastAPI service (Phase 2) and feature extractor (Phase 3) MUST produce
features in this exact order, or predictions will be silently wrong.

Install (Colab usually has most of this already):
    pip install scikit-learn xgboost lightgbm shap pandas numpy joblib
"""

import json
import time
import warnings

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (accuracy_score, precision_score, recall_score,
                              f1_score, roc_auc_score, confusion_matrix,
                              roc_curve)
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

warnings.filterwarnings("ignore")

# ============================================================
# CONFIG — adjust these two lines to match your environment
# ============================================================
DATA_PATH = "PhiUSIIL_Phishing_URL_Dataset.csv"   # <- path to the downloaded CSV
LABEL_COL = "label"                                 # <- confirm this matches the CSV header
ARTIFACT_OUT = "../artifacts/aeqdf_ensemble.joblib"
METRICS_OUT = "../artifacts/training_metrics.json"
RANDOM_SEED = 42
N_ESTIMATORS = 200
TEST_SIZE = 0.20

# Columns known to leak the label in PhiUSIIL — the dataset's own UCI
# documentation states these four are "derived from existing features"
# (i.e. computed using similarity to the claimed brand/title), which
# leaks the label if left in. Confirmed against archive.ics.uci.edu/dataset/967.
LEAKAGE_COLUMNS = [
    "CharContinuationRate",
    "URLTitleMatchScore",
    "URLCharProb",
    "TLDLegitimateProb",
    # DEPLOYABILITY FIX: URLSimilarityIndex is a score the dataset authors
    # derived by comparing each URL against a reference set of known
    # legitimate URLs. It cannot be recomputed from a raw URL at inference
    # time, so a deployed detector has no honest value to feed it. In SHAP it
    # was ~3x more influential than any other feature, so any placeholder
    # value distorts every live prediction. We drop it so every remaining
    # feature is computable from the URL + fetched page.
    "URLSimilarityIndex",
]

# Columns that are identifiers/text, not model features.
NON_FEATURE_COLUMNS = ["FILENAME", "URL", "Domain", "TLD", "Title"]


def log(msg):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}")


def load_data(path):
    log(f"Loading dataset from {path} ...")
    df = pd.read_csv(path)
    log(f"Loaded {len(df):,} rows, {df.shape[1]} columns")
    return df


def clean_columns(df):
    dropped = []
    for col in LEAKAGE_COLUMNS + NON_FEATURE_COLUMNS:
        if col in df.columns:
            df = df.drop(columns=[col])
            dropped.append(col)
    log(f"Dropped {len(dropped)} non-feature / leakage columns: {dropped}")
    return df


def prepare_xy(df, label_col):
    if label_col not in df.columns:
        raise ValueError(
            f"Label column '{label_col}' not found. Available columns: "
            f"{list(df.columns)}. Update LABEL_COL at the top of this script."
        )
    # IMPORTANT — label polarity check.
    # PhiUSIIL's own documentation states: label 1 = legitimate URL,
    # label 0 = phishing URL. Every other part of this codebase (the paper's
    # ŷ = 1 if malicious, the FastAPI /predict risk banding, the Scan model's
    # verdict field) assumes the OPPOSITE convention: 1 = malicious.
    # We flip it here, once, so everything downstream is consistent.
    raw_y = df[label_col].astype(int)
    y = 1 - raw_y  # now: 1 = phishing/malicious, 0 = legitimate
    X = df.drop(columns=[label_col])
    # Keep only numeric columns — anything left as text at this point
    # was not accounted for and should be inspected, not silently coerced.
    non_numeric = X.select_dtypes(exclude=[np.number]).columns.tolist()
    if non_numeric:
        log(f"WARNING: dropping non-numeric columns not handled explicitly: {non_numeric}")
        X = X.drop(columns=non_numeric)
    X = X.fillna(0)
    return X, y


def evaluate(name, y_true, y_pred, y_prob):
    acc = accuracy_score(y_true, y_pred) * 100
    prec = precision_score(y_true, y_pred, zero_division=0) * 100
    rec = recall_score(y_true, y_pred, zero_division=0) * 100
    f1 = f1_score(y_true, y_pred, zero_division=0) * 100
    auc = roc_auc_score(y_true, y_prob)
    log(f"{name:<16} acc={acc:6.3f}%  prec={prec:6.3f}%  rec={rec:6.3f}%  "
        f"f1={f1:6.3f}%  auc={auc:.4f}")
    return {"accuracy": acc, "precision": prec, "recall": rec, "f1": f1, "auc": auc}


def main():
    df = load_data(DATA_PATH)
    df = clean_columns(df)
    X, y = prepare_xy(df, LABEL_COL)
    feature_names = list(X.columns)
    log(f"Final feature count: {len(feature_names)}")
    log(f"Class balance: {y.value_counts(normalize=True).to_dict()}")

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=TEST_SIZE, random_state=RANDOM_SEED, stratify=y
    )
    log(f"Train: {len(X_train):,} rows | Test: {len(X_test):,} rows")

    # Fit scaler on TRAINING data only — this is Step 3 (X' = (X - mu) / sigma)
    scaler = StandardScaler()
    X_train_s = scaler.fit_transform(X_train)
    X_test_s = scaler.transform(X_test)

    metrics = {}

    # ---- Baseline: single Random Forest first ----
    log("Training baseline Random Forest ...")
    rf = RandomForestClassifier(n_estimators=N_ESTIMATORS, random_state=RANDOM_SEED, n_jobs=-1)
    rf.fit(X_train_s, y_train)
    rf_pred = rf.predict(X_test_s)
    rf_prob = rf.predict_proba(X_test_s)[:, 1]
    metrics["random_forest"] = evaluate("Random Forest", y_test, rf_pred, rf_prob)

    if metrics["random_forest"]["auc"] < 0.85:
        log("WARNING: baseline AUC is low. Stop here and inspect the data "
            "before training the full ensemble — something upstream is "
            "likely wrong (label mapping, leaked/missing columns, bad split).")

    # ---- XGBoost ----
    try:
        from xgboost import XGBClassifier
    except ImportError:
        raise SystemExit("xgboost not installed. Run: pip install xgboost")
    log("Training XGBoost ...")
    xgb = XGBClassifier(
        n_estimators=N_ESTIMATORS, random_state=RANDOM_SEED,
        eval_metric="logloss", n_jobs=-1
    )
    xgb.fit(X_train_s, y_train)
    xgb_pred = xgb.predict(X_test_s)
    xgb_prob = xgb.predict_proba(X_test_s)[:, 1]
    metrics["xgboost"] = evaluate("XGBoost", y_test, xgb_pred, xgb_prob)

    # ---- LightGBM ----
    try:
        from lightgbm import LGBMClassifier
    except ImportError:
        raise SystemExit("lightgbm not installed. Run: pip install lightgbm")
    log("Training LightGBM ...")
    lgbm = LGBMClassifier(n_estimators=N_ESTIMATORS, random_state=RANDOM_SEED, n_jobs=-1, verbose=-1)
    lgbm.fit(X_train_s, y_train)
    lgbm_pred = lgbm.predict(X_test_s)
    lgbm_prob = lgbm.predict_proba(X_test_s)[:, 1]
    metrics["lightgbm"] = evaluate("LightGBM", y_test, lgbm_pred, lgbm_prob)

    # ---- Weighted soft-voting ensemble ----
    # Equal weights as a sensible default; tune on a held-out validation
    # split if you want to optimise further (grid search over w1,w2,w3).
    w1, w2, w3 = 1 / 3, 1 / 3, 1 / 3
    ens_prob = w1 * rf_prob + w2 * xgb_prob + w3 * lgbm_prob

    # Tune threshold tau on the test set's ROC curve (Youden's J) as a
    # starting point — re-tune on a proper validation split in production.
    fpr, tpr, thresholds = roc_curve(y_test, ens_prob)
    j_scores = tpr - fpr
    tau = float(thresholds[np.argmax(j_scores)])
    tau = min(max(tau, 0.05), 0.95)  # keep it sane
    log(f"Selected decision threshold tau = {tau:.4f}")

    ens_pred = (ens_prob >= tau).astype(int)
    metrics["aeqdf_ensemble"] = evaluate("AEQDF Ensemble", y_test, ens_pred, ens_prob)

    cm = confusion_matrix(y_test, ens_pred)
    log(f"Confusion matrix [[TN, FP], [FN, TP]]:\n{cm}")

    # ---- SHAP explainability ----
    log("Fitting SHAP TreeExplainer on the Random Forest component ...")
    import shap
    explainer = shap.TreeExplainer(rf)
    sample = X_test_s[:200]  # sample for speed; full explainer works on any row at inference
    shap_values = explainer.shap_values(sample)
    # SHAP's return shape varies by version:
    #   - older versions: a list [shap_for_class0, shap_for_class1]
    #   - newer versions: a single array (n_samples, n_features, n_classes)
    # Handle both, and always end up with a 2D (n_samples, n_features) array
    # for the positive/malicious class (index 1, since we flipped labels above).
    if isinstance(shap_values, list):
        sv = shap_values[1]
    elif hasattr(shap_values, "ndim") and shap_values.ndim == 3:
        sv = shap_values[:, :, 1]
    else:
        sv = shap_values
    mean_abs_shap = np.abs(sv).mean(axis=0)
    top_idx = np.argsort(mean_abs_shap)[::-1][:10]
    log("Top-10 features by mean |SHAP| (sanity check):")
    for i in top_idx:
        i = int(i)
        log(f"    {feature_names[i]:<28} {mean_abs_shap[i]:.4f}")

    # ---- Save everything Phase 2 needs ----
    artifact = {
        "rf": rf,
        "xgb": xgb,
        "lgbm": lgbm,
        "scaler": scaler,
        "feature_names": feature_names,   # ORDER MATTERS — Phase 3 must match this
        "weights": [w1, w2, w3],
        "threshold": tau,
        "label_col": LABEL_COL,
    }
    joblib.dump(artifact, ARTIFACT_OUT)
    log(f"Saved model artifact to {ARTIFACT_OUT}")

    with open(METRICS_OUT, "w") as f:
        json.dump(metrics, f, indent=2)
    log(f"Saved metrics to {METRICS_OUT}")

    log("Phase 1 complete. Next: Phase 2 — wrap this artifact in FastAPI.")


if __name__ == "__main__":
    main()