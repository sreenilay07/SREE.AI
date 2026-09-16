import { getStockPrediction, getMlHealth } from '../services/mlTradingService.js';

describe('ML Trading Service Gateway Tests', () => {
  test('getStockPrediction requires a symbol', async () => {
    await expect(getStockPrediction({})).rejects.toThrow('Stock symbol is required.');
  });

  test('getStockPrediction returns structured error object when ML service is offline', async () => {
    // Calling with non-existent or offline endpoint should return typed error object, not unhandled exception or mock data
    const result = await getStockPrediction({ symbol: 'MRF' });
    expect(result).toBeDefined();
    expect(result.stock.symbol).toBe('MRF');
    expect(result.currentPrice).toBe(0);
    expect(result.signal).toBe('NO TRADE');
    // Ensure no fake prices or demo values are present
    expect(result.currentPrice).not.toBe(1425.30);
  });

  test('getMlHealth returns status information', async () => {
    const health = await getMlHealth();
    expect(health).toBeDefined();
    expect(typeof health.status).toBe('string');
  });
});
