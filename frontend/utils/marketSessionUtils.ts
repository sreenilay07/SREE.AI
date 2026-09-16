/**
 * Canonical Market Session & IST Utilities for SREE.AI Frontend
 * Timezone: Asia/Kolkata (IST / UTC+05:30)
 * NSE Market Hours: 09:15 - 15:30 IST (Mon - Fri)
 */

export interface CanonicalCandle {
  timestamp: number;    // Unix timestamp in milliseconds
  datetime: string;     // ISO 8601 string in IST (+05:30)
  date: string;         // YYYY-MM-DD in IST
  time: string;         // HH:mm in IST
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
  price?: number;
}

export type ChartInterval = '1D' | '1W' | '1M' | '3M' | '1Y' | '5Y';

/**
 * Returns whether the Indian stock market (NSE/BSE) is currently OPEN in IST.
 */
export function isMarketOpen(): boolean {
  const now = new Date();
  const dayFormatter = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', weekday: 'short' });
  const timeFormatter = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false });

  const day = dayFormatter.format(now);
  const time = timeFormatter.format(now);

  if (day === 'Sat' || day === 'Sun') {
    return false;
  }

  return time >= '09:15' && time <= '15:30';
}

/**
 * Returns today's date string in IST ("YYYY-MM-DD").
 */
export function getTodayISTDate(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' });
  return formatter.format(new Date());
}

/**
 * Formats a YYYY-MM-DD date string into a human-readable format e.g. "11 Sep 2026".
 */
export function formatReadableDate(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length < 3) return dateStr;
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * Resolves a list of canonical candles into timeframe-appropriate session data.
 * 
 * For 1D:
 * - Identifies all unique session dates present in the data.
 * - If market is OPEN today and today's session date is present, uses today's session.
 * - Otherwise (market CLOSED or weekend/holiday), automatically selects the MOST RECENT COMPLETED TRADING SESSION DATE.
 * - Filters candles to ONLY contain candles for that single session date (preventing session mixing).
 */
export function resolveChartSession(
  rawCandles: CanonicalCandle[],
  interval: ChartInterval
): {
  sessionDate: string;
  isLive: boolean;
  candles: CanonicalCandle[];
} {
  if (!Array.isArray(rawCandles) || rawCandles.length === 0) {
    return { sessionDate: '', isLive: false, candles: [] };
  }

  // Ensure candles are sorted chronologically ascending by Unix timestamp ms (Requirement 17)
  const sorted = [...rawCandles].sort((a, b) => a.timestamp - b.timestamp);

  if (interval === '1D') {
    const todayIST = getTodayISTDate();
    const marketIsOpenNow = isMarketOpen();

    // Extract unique trading dates in descending order (newest date first)
    const datesDesc = Array.from(new Set(sorted.map(c => c.date).filter(Boolean))).sort().reverse();

    let targetDate = datesDesc[0] || todayIST;

    if (marketIsOpenNow && datesDesc.includes(todayIST)) {
      targetDate = todayIST;
    } else {
      // Pick the latest available trading date in the dataset
      targetDate = datesDesc.find(d => d <= todayIST) || datesDesc[0];
    }

    // Filter to ONLY candles belonging to the selected single session (Requirement 11)
    const singleSessionCandles = sorted.filter(c => c.date === targetDate);

    const isLive = marketIsOpenNow && targetDate === todayIST;

    return {
      sessionDate: formatReadableDate(targetDate),
      isLive,
      candles: singleSessionCandles
    };
  }

  if (interval === '1W') {
    // Keep candles for the latest 5 trading days
    const uniqueDates = Array.from(new Set(sorted.map(c => c.date).filter(Boolean))).sort();
    const recent5Dates = new Set(uniqueDates.slice(-5));
    const weeklyCandles = sorted.filter(c => recent5Dates.has(c.date));
    const lastDate = uniqueDates[uniqueDates.length - 1] || '';

    return {
      sessionDate: formatReadableDate(lastDate),
      isLive: isMarketOpen() && lastDate === getTodayISTDate(),
      candles: weeklyCandles
    };
  }

  // 1M, 3M, 1Y, 5Y (Daily candles)
  const lastDate = sorted[sorted.length - 1]?.date || '';
  return {
    sessionDate: formatReadableDate(lastDate),
    isLive: false,
    candles: sorted
  };
}
