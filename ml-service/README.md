# SREE.AI ML Service

Dedicated Python + FastAPI microservice for real-time intraday trading inference.

## Architecture

This service acts as the inference engine for SREE.AI Intratrade:
```
React Frontend -> Node.js Express Gateway -> Python FastAPI ML Service -> Upstox API & Model Artifacts
```

## Setup & Running Locally

1. Create a Python virtual environment:
   ```bash
   cd ml-service
   python -m venv .venv
   source .venv/bin/activate  # Or on Windows: .venv\Scripts\activate
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Configure environment variables in `.env`:
   ```env
   PORT=8000
   UPSTOX_ACCESS_TOKEN=your_upstox_token_here
   ARTIFACTS_DIR=./production_artifacts
   ```

4. Ensure production model artifacts are present in `production_artifacts/`:
   - `model.keras`
   - `scaler.pkl`
   - `xgb_5m.json`, `xgb_10m.json`, `xgb_15m.json`, `xgb_20m.json`, `xgb_25m.json`, `xgb_30m.json`, `xgb_45m.json`, `xgb_60m.json`
   - `feature_columns.json`, `pattern_columns.json`, `config.json`, `model_metadata.json`

5. Start the server:
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```

## Endpoints

### 1. Health Check
- `GET /health`
- Verifies server status and artifact readiness.

### 2. Intraday Prediction
- `GET /api/predict?symbol=MRF&instrumentKey=NSE_EQ|INE883A01011&stockName=MRF`
- Queries live Upstox candles, validates session, builds live features, and returns multi-horizon predictions, validation confidence, ATR risk levels, and trading signals.

## Deployment to Render

1. Create a new **Web Service** on Render.
2. Connect your Git repository.
3. Set **Root Directory** to `ml-service`.
4. Choose **Docker** or **Python 3** environment.
5. Set environment variable `UPSTOX_ACCESS_TOKEN`.
6. Add health check path: `/health`.
