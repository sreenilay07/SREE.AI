import os
import logging
from contextlib import asynccontextmanager
from datetime import datetime
from fastapi import FastAPI, Query, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("ml-service")

from .model_loader import get_model_container
from .predictor import predict_stock_pipeline
from .schemas import HealthResponse, PredictionResponse

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("[ML] Initializing ML Service...")
    container = get_model_container()
    loaded = container.load()
    if loaded:
        logger.info("[ML] Production ML models ready for inference.")
    else:
        logger.warning(f"[ML] Model startup warning: {container.load_error}")
    yield
    logger.info("[ML] Shutting down ML Service.")

app = FastAPI(
    title="SREE.AI Intratrade ML Service",
    description="Dedicated FastAPI service for real-time intraday stock prediction",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

@app.get("/", tags=["General"])
def root():
    return {
        "service": "SREE.AI Intratrade ML Inference Engine",
        "status": "online",
        "timestamp": datetime.utcnow().isoformat()
    }

@app.get("/health", response_model=HealthResponse, tags=["Health"])
def health():
    container = get_model_container()
    container.check_artifacts()
    return HealthResponse(
        status="ok" if container.is_loaded else "degraded",
        model_loaded=container.is_loaded,
        artifacts=container.artifacts_status,
        timestamp=datetime.utcnow().isoformat(),
        error=container.load_error
    )

@app.get("/api/predict", response_model=PredictionResponse, tags=["Inference"])
def predict(
    symbol: str = Query(..., description="Stock symbol (e.g. MRF, RELIANCE)"),
    instrumentKey: str = Query(..., description="Upstox instrument key (e.g. NSE_EQ|INE883A01011)"),
    stockName: str = Query("", description="Company name"),
    authorization: str = Header(None, description="Optional Upstox Bearer token override")
):
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization.replace("Bearer ", "").strip()

    logger.info(f"[ML] Incoming prediction request: symbol={symbol}, key={instrumentKey}, name={stockName}")
    
    clean_name = stockName.strip() or symbol.strip()
    result = predict_stock_pipeline(
        symbol=symbol.strip().toUpperCase() if hasattr(symbol, 'toUpperCase') else symbol.strip().upper(),
        instrument_key=instrumentKey.strip(),
        stock_name=clean_name,
        token=token
    )

    return result

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=True)
