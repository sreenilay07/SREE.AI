/**
 * Technical Indicators Calculation Module for SREE.AI
 * Calculates exact RSI, SMA, EMA, MACD, Pivot Points, and Technical Signal Scores
 * from real Upstox market candle data (OHLCV format).
 */

/**
 * Calculates Simple Moving Average (SMA) for a given period.
 */
export function calculateSMA(candles, period) {
  if (!candles || candles.length < period) return null;
  const recent = candles.slice(-period);
  const sum = recent.reduce((acc, c) => acc + (c.close || 0), 0);
  return Number((sum / period).toFixed(2));
}

/**
 * Calculates Exponential Moving Average (EMA) for a given period.
 */
export function calculateEMA(candles, period) {
  if (!candles || candles.length < period) return null;
  const k = 2 / (period + 1);
  let ema = candles.slice(0, period).reduce((acc, c) => acc + c.close, 0) / period;
  for (let i = period; i < candles.length; i++) {
    ema = candles[i].close * k + ema * (1 - k);
  }
  return Number(ema.toFixed(2));
}

/**
 * Calculates Relative Strength Index (RSI) for a standard 14-period window.
 */
export function calculateRSI(candles, period = 14) {
  if (!candles || candles.length <= period) return null;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const change = candles[i].close - candles[i - 1].close;
    if (change >= 0) gains += change;
    else losses += Math.abs(change);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < candles.length; i++) {
    const change = candles[i].close - candles[i - 1].close;
    const gain = change >= 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));
  return Number(rsi.toFixed(2));
}

/**
 * Calculates MACD (Moving Average Convergence Divergence) line, signal line, and histogram.
 */
export function calculateMACD(candles, fast = 12, slow = 26, signalPeriod = 9) {
  if (!candles || candles.length < slow + signalPeriod) return null;

  const macdLine = [];
  const kFast = 2 / (fast + 1);
  const kSlow = 2 / (slow + 1);

  let emaFast = candles.slice(0, fast).reduce((a, c) => a + c.close, 0) / fast;
  let emaSlow = candles.slice(0, slow).reduce((a, c) => a + c.close, 0) / slow;

  for (let i = fast; i < slow; i++) {
    emaFast = candles[i].close * kFast + emaFast * (1 - kFast);
  }

  for (let i = slow; i < candles.length; i++) {
    emaFast = candles[i].close * kFast + emaFast * (1 - kFast);
    emaSlow = candles[i].close * kSlow + emaSlow * (1 - kSlow);
    macdLine.push(emaFast - emaSlow);
  }

  if (macdLine.length < signalPeriod) return null;

  const kSignal = 2 / (signalPeriod + 1);
  let signal = macdLine.slice(0, signalPeriod).reduce((a, v) => a + v, 0) / signalPeriod;
  for (let i = signalPeriod; i < macdLine.length; i++) {
    signal = macdLine[i] * kSignal + signal * (1 - kSignal);
  }

  const latestMACD = macdLine[macdLine.length - 1];
  const histogram = latestMACD - signal;

  return {
    macd: Number(latestMACD.toFixed(2)),
    signal: Number(signal.toFixed(2)),
    histogram: Number(histogram.toFixed(2)),
  };
}

/**
 * Calculates standard Pivot Points (Classic) and Support / Resistance levels.
 */
export function calculatePivotPoints(candles) {
  if (!candles || candles.length === 0) return null;
  const lastCandle = candles[candles.length - 1];
  const high = lastCandle.high || lastCandle.close;
  const low = lastCandle.low || lastCandle.close;
  const close = lastCandle.close;

  const pivot = (high + low + close) / 3;
  const r1 = 2 * pivot - low;
  const s1 = 2 * pivot - high;
  const r2 = pivot + (high - low);
  const s2 = pivot - (high - low);
  const r3 = high + 2 * (pivot - low);
  const s3 = low - 2 * (high - pivot);

  return {
    pivot: Number(pivot.toFixed(2)),
    resistance1: Number(r1.toFixed(2)),
    resistance2: Number(r2.toFixed(2)),
    resistance3: Number(r3.toFixed(2)),
    support1: Number(s1.toFixed(2)),
    support2: Number(s2.toFixed(2)),
    support3: Number(s3.toFixed(2)),
  };
}

/**
 * Computes short term percentage return (momentum).
 */
export function calculateMomentum(candles, days = 5) {
  if (!candles || candles.length <= days) return null;
  const current = candles[candles.length - 1].close;
  const past = candles[candles.length - 1 - days].close;
  if (!past || past <= 0) return null;
  return Number((((current - past) / past) * 100).toFixed(2));
}

/**
 * Computes technical indicator summaries for stock analysis prompt.
 */
export function computeTechnicalAnalysis(candles) {
  if (!candles || candles.length === 0) {
    return {
      rsi: null,
      macd: null,
      sma20: null,
      sma50: null,
      pivotPoints: null,
      momentum5d: null,
      summary: {
        rsiText: 'N/A',
        macdText: 'N/A',
        movingAveragesText: 'N/A'
      }
    };
  }

  const rsi = calculateRSI(candles);
  const macd = calculateMACD(candles);
  const sma20 = calculateSMA(candles, 20);
  const sma50 = calculateSMA(candles, 50);
  const pivotPoints = calculatePivotPoints(candles);
  const momentum5d = calculateMomentum(candles, 5);

  const rsiText = rsi !== null ? `${rsi} (${rsi > 70 ? 'Overbought' : rsi < 30 ? 'Oversold' : 'Neutral'})` : 'N/A';
  const macdText = macd !== null ? `Histogram: ${macd.histogram} (${macd.histogram > 0 ? 'Bullish' : macd.histogram < 0 ? 'Bearish' : 'Neutral'})` : 'N/A';

  const lastClose = candles[candles.length - 1].close;
  let maText = 'N/A';
  if (sma20 !== null && sma50 !== null) {
    if (lastClose > sma20 && sma20 > sma50) maText = 'Strong Bullish Alignment (Above SMA20 & SMA50)';
    else if (lastClose < sma20 && sma20 < sma50) maText = 'Bearish Alignment (Below SMA20 & SMA50)';
    else if (lastClose > sma20) maText = 'Bullish Short-Term (Above SMA20)';
    else maText = 'Cautious (Below SMA20)';
  } else if (sma20 !== null) {
    maText = lastClose > sma20 ? 'Bullish Short-Term (Above SMA20)' : 'Cautious (Below SMA20)';
  }

  return {
    rsi,
    macd,
    sma20,
    sma50,
    pivotPoints,
    momentum5d,
    summary: {
      rsiText,
      macdText,
      movingAveragesText: maText
    }
  };
}

/**
 * Calculates dynamic mathematical score and signal verdict.
 * Only present/computed metrics contribute to numerator and denominator.
 * Missing or null metrics are strictly excluded from both.
 */
export function calculateDynamicScoreAndVerdict(techMetrics = {}, liveQuote = {}) {
  let bullishPoints = 0;
  let totalPoints = 0;
  const verdictDetails = [];

  // 1. Session Price Change
  if (typeof liveQuote.changePercent === 'number' && !isNaN(liveQuote.changePercent)) {
    const pts = 2;
    totalPoints += pts;
    let status = 'Neutral';
    if (liveQuote.changePercent > 0.5) {
      bullishPoints += 2;
      status = 'Positive';
    } else if (liveQuote.changePercent >= -0.5) {
      bullishPoints += 1;
      status = 'Neutral';
    } else {
      status = 'Negative';
    }
    verdictDetails.push({
      metric: 'Price Movement',
      actual: `₹${liveQuote.currentPrice || 0} (${liveQuote.changePercent}%)`,
      preferred: 'Upward Trend (> 0.5%)',
      status
    });
  }

  // 2. Relative Strength Index (RSI 14)
  if (techMetrics.rsi !== null && techMetrics.rsi !== undefined) {
    const pts = 2;
    totalPoints += pts;
    let status = 'Neutral';
    if (techMetrics.rsi <= 30) {
      bullishPoints += 2; // Oversold -> strong buy signal
      status = 'Positive';
    } else if (techMetrics.rsi > 30 && techMetrics.rsi <= 60) {
      bullishPoints += 1.5;
      status = 'Positive';
    } else if (techMetrics.rsi > 60 && techMetrics.rsi <= 70) {
      bullishPoints += 1;
      status = 'Neutral';
    } else {
      status = 'Negative'; // Overbought (> 70)
    }
    verdictDetails.push({
      metric: 'RSI (14)',
      actual: `${techMetrics.rsi} (${techMetrics.rsi > 70 ? 'Overbought' : techMetrics.rsi < 30 ? 'Oversold' : 'Neutral'})`,
      preferred: '30 - 60 (Bullish Momentum)',
      status
    });
  }

  // 3. MACD Histogram
  if (techMetrics.macd?.histogram !== undefined && techMetrics.macd?.histogram !== null) {
    const pts = 2;
    totalPoints += pts;
    let status = 'Neutral';
    if (techMetrics.macd.histogram > 0) {
      bullishPoints += 2;
      status = 'Positive';
    } else if (techMetrics.macd.histogram === 0) {
      bullishPoints += 1;
      status = 'Neutral';
    } else {
      status = 'Negative';
    }
    verdictDetails.push({
      metric: 'MACD (12,26,9)',
      actual: `Histogram: ${techMetrics.macd.histogram}`,
      preferred: 'Positive Histogram (> 0)',
      status
    });
  }

  // 4. Moving Averages Alignment (SMA20 / SMA50)
  if (techMetrics.sma20 !== null && techMetrics.sma20 !== undefined) {
    const pts = 2;
    totalPoints += pts;
    let status = 'Neutral';
    const lastClose = liveQuote.currentPrice || 0;
    if (techMetrics.sma50 !== null && techMetrics.sma50 !== undefined) {
      if (lastClose > techMetrics.sma20 && techMetrics.sma20 > techMetrics.sma50) {
        bullishPoints += 2;
        status = 'Positive';
      } else if (lastClose > techMetrics.sma20) {
        bullishPoints += 1.5;
        status = 'Positive';
      } else if (lastClose > techMetrics.sma50) {
        bullishPoints += 1;
        status = 'Neutral';
      } else {
        status = 'Negative';
      }
    } else {
      if (lastClose > techMetrics.sma20) {
        bullishPoints += 1.5;
        status = 'Positive';
      } else {
        status = 'Negative';
      }
    }
    verdictDetails.push({
      metric: 'Moving Averages',
      actual: techMetrics.summary?.movingAveragesText || 'Evaluated',
      preferred: 'Price Above SMA20 & SMA50',
      status
    });
  }

  // 5. 52-Week Range Position
  if (liveQuote.fiftyTwoWeekHigh > 0 && liveQuote.fiftyTwoWeekLow > 0 && liveQuote.fiftyTwoWeekHigh > liveQuote.fiftyTwoWeekLow) {
    const range = liveQuote.fiftyTwoWeekHigh - liveQuote.fiftyTwoWeekLow;
    const pos = (liveQuote.currentPrice - liveQuote.fiftyTwoWeekLow) / range;
    totalPoints += 1.5;
    let status = 'Neutral';
    if (pos >= 0.7) {
      bullishPoints += 1.5;
      status = 'Positive';
    } else if (pos >= 0.4) {
      bullishPoints += 1;
      status = 'Neutral';
    } else {
      status = 'Negative';
    }
    verdictDetails.push({
      metric: '52-Week Range Position',
      actual: `${(pos * 100).toFixed(1)}% of 52W Range`,
      preferred: '> 50% Range Position',
      status
    });
  }

  // 6. Short-Term Momentum (5D Return)
  if (techMetrics.momentum5d !== null && techMetrics.momentum5d !== undefined) {
    totalPoints += 1.5;
    let status = 'Neutral';
    if (techMetrics.momentum5d > 2.0) {
      bullishPoints += 1.5;
      status = 'Positive';
    } else if (techMetrics.momentum5d >= 0) {
      bullishPoints += 1;
      status = 'Neutral';
    } else {
      status = 'Negative';
    }
    verdictDetails.push({
      metric: '5-Day Momentum',
      actual: `${techMetrics.momentum5d}%`,
      preferred: '> 0% Gain',
      status
    });
  }

  const rawScore = totalPoints > 0 ? (bullishPoints / totalPoints) * 10 : 5.0;
  const score = Number(Math.min(Math.max(rawScore, 1), 10).toFixed(1));

  let verdict = 'HOLD';
  if (score >= 6.8) verdict = 'BUY';
  else if (score <= 3.8) verdict = 'SELL';

  const confidence = totalPoints >= 6 ? 85 : 70;

  return { score, verdict, confidence, bullishPoints, totalPoints, verdictDetails };
}
