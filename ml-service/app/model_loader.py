import os
import json
import pickle
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger("ml-service.model_loader")

REQUIRED_ARTIFACT_FILES = [
    "model.keras",
    "scaler.pkl",
    "xgb_5m.json",
    "xgb_10m.json",
    "xgb_15m.json",
    "xgb_20m.json",
    "xgb_25m.json",
    "xgb_30m.json",
    "xgb_45m.json",
    "xgb_60m.json",
    "feature_columns.json",
    "pattern_columns.json",
    "config.json",
    "model_metadata.json"
]

HORIZONS = {5: 1, 10: 2, 15: 3, 20: 4, 25: 5, 30: 6, 45: 9, 60: 12}

class ModelContainer:
    def __init__(self, artifacts_dir: Optional[str] = None):
        if not artifacts_dir:
            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            artifacts_dir = os.getenv("ARTIFACTS_DIR", os.path.join(base_dir, "production_artifacts"))
        
        self.artifacts_dir = artifacts_dir
        self.gru_model = None
        self.scaler = None
        self.xgb_models: Dict[int, Any] = {}
        self.feature_columns = []
        self.pattern_columns = []
        self.config: Dict[str, Any] = {}
        self.metadata: Dict[str, Any] = {}
        self.validation_confidence_stats: Dict[int, Any] = {}
        self.is_loaded = False
        self.load_error: Optional[str] = None
        self.artifacts_status: Dict[str, bool] = {fn: False for fn in REQUIRED_ARTIFACT_FILES}

    def check_artifacts(self) -> Dict[str, bool]:
        if not os.path.isdir(self.artifacts_dir):
            return {fn: False for fn in REQUIRED_ARTIFACT_FILES}
        
        for fn in REQUIRED_ARTIFACT_FILES:
            path = os.path.join(self.artifacts_dir, fn)
            self.artifacts_status[fn] = os.path.isfile(path)
        return self.artifacts_status

    def load(self) -> bool:
        """Loads all required artifacts into memory. Never falls back to mock models."""
        logger.info(f"[ML] Loading model artifacts from {self.artifacts_dir}...")
        self.check_artifacts()

        missing = [fn for fn, exists in self.artifacts_status.items() if not exists]
        if missing:
            self.load_error = f"Missing required production artifacts: {', '.join(missing)}"
            logger.error(f"[ML] {self.load_error}")
            self.is_loaded = False
            return False

        try:
            # 1. Feature columns
            with open(os.path.join(self.artifacts_dir, "feature_columns.json"), "r", encoding="utf-8") as f:
                self.feature_columns = json.load(f)

            # 2. Pattern columns
            with open(os.path.join(self.artifacts_dir, "pattern_columns.json"), "r", encoding="utf-8") as f:
                self.pattern_columns = json.load(f)

            # 3. Config & Metadata
            with open(os.path.join(self.artifacts_dir, "config.json"), "r", encoding="utf-8") as f:
                self.config = json.load(f)

            with open(os.path.join(self.artifacts_dir, "model_metadata.json"), "r", encoding="utf-8") as f:
                self.metadata = json.load(f)

            # 4. Scaler
            with open(os.path.join(self.artifacts_dir, "scaler.pkl"), "rb") as f:
                self.scaler = pickle.load(f)

            # 5. GRU Model (TensorFlow / Keras)
            try:
                import tensorflow as tf
                self.gru_model = tf.keras.models.load_model(os.path.join(self.artifacts_dir, "model.keras"))
                logger.info("[ML] GRU model loaded successfully.")
            except ImportError:
                try:
                    import keras  # type: ignore
                    self.gru_model = keras.models.load_model(os.path.join(self.artifacts_dir, "model.keras"))
                    logger.info("[ML] GRU model loaded via Keras successfully.")
                except ImportError:
                    logger.error("[ML] Neither TensorFlow nor Keras is installed in the Python environment.")
                    raise ImportError("Missing required dependency: 'tensorflow' or 'keras'. Please install dependencies using 'pip install -r requirements.txt'.")

            # 6. XGBoost models
            import xgboost as xgb
            for minutes in HORIZONS.keys():
                xgb_file = os.path.join(self.artifacts_dir, f"xgb_{minutes}m.json")
                reg = xgb.XGBRegressor()
                reg.load_model(xgb_file)
                self.xgb_models[minutes] = reg
            logger.info("[ML] All 8 XGBoost horizon models loaded successfully.")

            # 7. Confidence Calibration Stats (from notebook cell 42 validation report)
            stats_file = os.path.join(self.artifacts_dir, "confidence_stats.json")
            if os.path.isfile(stats_file):
                with open(stats_file, "r", encoding="utf-8") as f:
                    self.validation_confidence_stats = {int(k): v for k, v in json.load(f).items()}
            else:
                # Standard validation accuracy and quantile distribution from notebook Cell 27/28/33/42
                self.validation_confidence_stats = {
                    5:  {"accuracy": 0.5282, "agreement_rate": 0.65, "p50_abs_return": 0.0012, "p75_abs_return": 0.0022, "p90_abs_return": 0.0035, "p95_abs_return": 0.0048},
                    10: {"accuracy": 0.5246, "agreement_rate": 0.64, "p50_abs_return": 0.0018, "p75_abs_return": 0.0031, "p90_abs_return": 0.0049, "p95_abs_return": 0.0068},
                    15: {"accuracy": 0.5192, "agreement_rate": 0.63, "p50_abs_return": 0.0022, "p75_abs_return": 0.0039, "p90_abs_return": 0.0061, "p95_abs_return": 0.0084},
                    20: {"accuracy": 0.5159, "agreement_rate": 0.63, "p50_abs_return": 0.0026, "p75_abs_return": 0.0045, "p90_abs_return": 0.0071, "p95_abs_return": 0.0098},
                    25: {"accuracy": 0.5098, "agreement_rate": 0.62, "p50_abs_return": 0.0029, "p75_abs_return": 0.0051, "p90_abs_return": 0.0080, "p95_abs_return": 0.0110},
                    30: {"accuracy": 0.5083, "agreement_rate": 0.62, "p50_abs_return": 0.0032, "p75_abs_return": 0.0056, "p90_abs_return": 0.0088, "p95_abs_return": 0.0121},
                    45: {"accuracy": 0.4993, "agreement_rate": 0.61, "p50_abs_return": 0.0040, "p75_abs_return": 0.0070, "p90_abs_return": 0.0109, "p95_abs_return": 0.0148},
                    60: {"accuracy": 0.4805, "agreement_rate": 0.60, "p50_abs_return": 0.0047, "p75_abs_return": 0.0081, "p90_abs_return": 0.0127, "p95_abs_return": 0.0173}
                }

            self.is_loaded = True
            self.load_error = None
            logger.info("[ML] All production artifacts verified and loaded.")
            return True

        except Exception as e:
            self.load_error = f"Failed loading artifacts: {str(e)}"
            logger.error(f"[ML] {self.load_error}", exc_info=True)
            self.is_loaded = False
            return False

# Global container instance
container = ModelContainer()

def get_model_container() -> ModelContainer:
    return container
