import express from 'express';
import { getStockPrediction, getMlHealth } from '../services/mlTradingService.js';

const router = express.Router();

// GET /api/trading/health
router.get('/health', async (req, res) => {
  try {
    const health = await getMlHealth();
    res.json(health);
  } catch (err) {
    res.status(500).json({
      status: 'error',
      model_loaded: false,
      error: err.message
    });
  }
});

// GET /api/trading/predict
router.get('/predict', async (req, res) => {
  const { symbol, instrumentKey, stockName } = req.query;

  if (!symbol) {
    return res.status(400).json({
      status: 'error',
      message: 'MISSING_SYMBOL',
      reason: 'Parameter "symbol" is required.'
    });
  }

  try {
    const prediction = await getStockPrediction({
      symbol: String(symbol),
      instrumentKey: instrumentKey ? String(instrumentKey) : undefined,
      stockName: stockName ? String(stockName) : undefined
    });

    res.json(prediction);
  } catch (err) {
    console.error('[TradingRoute] Error handling prediction:', err);
    res.status(500).json({
      status: 'error',
      message: 'PREDICTION_ROUTING_ERROR',
      reason: err.message
    });
  }
});

export default router;
