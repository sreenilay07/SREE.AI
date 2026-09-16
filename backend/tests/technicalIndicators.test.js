import {
  calculateSMA,
  calculateRSI,
  calculateMACD,
  computeTechnicalAnalysis,
  calculateDynamicScoreAndVerdict
} from '../utils/technicalIndicators.js';

// Helper to generate candle array fixture
function generateCandles(basePrice, trendPercent, count = 70) {
  const candles = [];
  let price = basePrice;
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  for (let i = 0; i < count; i++) {
    const change = price * (trendPercent / 100) + (Math.random() - 0.5) * (basePrice * 0.005);
    const open = price;
    const close = Math.max(1, price + change);
    const high = Math.max(open, close) + Math.abs(change) * 0.2;
    const low = Math.min(open, close) - Math.abs(change) * 0.2;
    const timestamp = now - (count - i) * dayMs;

    candles.push({
      timestamp,
      datetime: new Date(timestamp).toISOString(),
      date: new Date(timestamp).toISOString().split('T')[0],
      time: '15:30',
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume: 100000 + i * 1000
    });
    price = close;
  }
  return candles;
}

describe('Technical Indicators Engine', () => {
  test('calculateSMA returns correct average with 50 candles', () => {
    const candles = generateCandles(100, 0.5, 60);
    const sma20 = calculateSMA(candles, 20);
    const sma50 = calculateSMA(candles, 50);

    expect(sma20).not.toBeNull();
    expect(sma50).not.toBeNull();
    expect(typeof sma20).toBe('number');
    expect(typeof sma50).toBe('number');
  });

  test('calculateRSI and calculateMACD compute valid numbers on 60 candles', () => {
    const candles = generateCandles(500, 0.3, 60);
    const rsi = calculateRSI(candles);
    const macd = calculateMACD(candles);

    expect(rsi).not.toBeNull();
    expect(rsi).toBeGreaterThanOrEqual(0);
    expect(rsi).toBeLessThanOrEqual(100);

    expect(macd).not.toBeNull();
    expect(macd).toHaveProperty('macd');
    expect(macd).toHaveProperty('signal');
    expect(macd).toHaveProperty('histogram');
  });

  test('calculateDynamicScoreAndVerdict reaches BUY for strong uptrend fixture', () => {
    const candles = generateCandles(200, 1.2, 70); // Strong positive trend
    const techMetrics = computeTechnicalAnalysis(candles);
    const lastPrice = candles[candles.length - 1].close;

    const liveQuote = {
      symbol: 'TEST_BUY',
      currentPrice: lastPrice,
      changePercent: 2.5,
      fiftyTwoWeekHigh: lastPrice * 1.02,
      fiftyTwoWeekLow: lastPrice * 0.5
    };

    const result = calculateDynamicScoreAndVerdict(techMetrics, liveQuote);
    expect(result.verdict).toBe('BUY');
    expect(result.score).toBeGreaterThanOrEqual(6.8);
    expect(result.verdictDetails.length).toBeGreaterThan(0);
  });

  test('calculateDynamicScoreAndVerdict reaches SELL for strong downtrend fixture', () => {
    const candles = generateCandles(500, -1.2, 70); // Strong negative trend
    const techMetrics = computeTechnicalAnalysis(candles);
    const lastPrice = candles[candles.length - 1].close;

    const liveQuote = {
      symbol: 'TEST_SELL',
      currentPrice: lastPrice,
      changePercent: -3.5,
      fiftyTwoWeekHigh: lastPrice * 2.0,
      fiftyTwoWeekLow: lastPrice * 0.98
    };

    const result = calculateDynamicScoreAndVerdict(techMetrics, liveQuote);
    expect(result.verdict).toBe('SELL');
    expect(result.score).toBeLessThanOrEqual(3.8);
  });

  test('calculateDynamicScoreAndVerdict excludes missing/null indicators from denominator', () => {
    const partialMetrics = { rsi: 45, macd: null, sma20: null, summary: { rsiText: '45 (Neutral)' } };
    const liveQuote = { symbol: 'TEST_PARTIAL', currentPrice: 100, changePercent: 0.1 };

    const result = calculateDynamicScoreAndVerdict(partialMetrics, liveQuote);
    expect(result.verdict).toBeDefined();
    expect(typeof result.score).toBe('number');
    expect(isNaN(result.score)).toBe(false);
  });
});
