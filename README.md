# AEQDF Prototype

Adaptive Explainable Quishing Detection Framework — reference implementation.

See `docs/AEQDF_Prototype_Build_Guide.pdf` for the full architecture, phase
breakdown, and viva preparation. This README is just the "how do I run it"
quick reference.

## Status

This is the Phase 0 + skeleton drop:

- [x] Repository structure (frontend / backend / ml-service)
- [x] Phase 1 training script (`ml-service/training/train_model.py`) — **run this first**
- [x] Phase 2 FastAPI service skeleton, ready to load the trained artifact
- [x] Phase 3 feature extractor — lexical features done, WHOIS/SSL/Safe Browsing stubbed (see TODOs)
- [x] Phase 4 backend — auth, scan orchestration, MongoDB models
- [x] Phase 5 frontend — routing, auth pages, scan UI (upload + camera), result view, dashboard
- [ ] Phase 6 — not yet deployed

## Run order

### 1. Train the model (required before anything else works end to end)

```bash
cd ml-service
pip install -r requirements.txt
# download PhiUSIIL_Phishing_URL_Dataset.csv into training/, then:
cd training
python train_model.py
```

This writes `ml-service/artifacts/aeqdf_ensemble.joblib`.

### 2. Start the ML service

```bash
cd ml-service
uvicorn app.main:app --reload --port 8000
curl http://localhost:8000/health
```

### 3. Start the backend

```bash
cd backend
cp .env.example .env    # fill in MONGO_URI and JWT_SECRET
npm install
npm run dev
curl http://localhost:5000/health
```

### 4. Start the frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
# open http://localhost:5173
```

## What still needs real implementation

`backend/src/services/featureExtractor.js` has three stubbed functions —
`domainIntelligence`, `sslInfo`, `safeBrowsingCheck` — each returning a
documented fallback value. Wire in real WHOIS/TLS/Safe Browsing calls there.
Everything else in the request path (auth, orchestration, ML inference,
persistence, frontend) is functional as written.

**Before wiring up feature extraction fully:** hit
`GET http://localhost:8000/feature-schema` once the model is trained and
confirm the feature *names* your extractor produces match it exactly, in
concept if not in order (the backend builds a dict, so order doesn't matter
there — only that every required key is present).
