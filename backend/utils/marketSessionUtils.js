/**
 * Market Session & IST Timezone Utilities for SREE.AI
 * Timezone: Asia/Kolkata (IST / UTC+05:30)
 * NSE Market Hours: 09:15 - 15:30 IST (Mon - Fri)
 */

/**
 * Converts a raw timestamp (string ISO, unix ms, or number) into IST components.
 * 
 * @param {string | number} rawTs 
 * @returns {{ timestamp: number, datetime: string, date: string, time: string }}
 */
export function parseTimestampToIST(rawTs) {
  let d;
  if (typeof rawTs === 'number') {
    d = new Date(rawTs);
  } else if (typeof rawTs === 'string') {
    d = new Date(rawTs);
    if (isNaN(d.getTime())) {
      d = new Date();
    }
  } else {
    d = new Date();
  }

  const ms = d.getTime();

  // Format to IST timezone (Asia/Kolkata) using Intl.DateTimeFormat
  const formatterDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' });
  const formatterTime = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

  const dateStr = formatterDate.format(d); // "YYYY-MM-DD"
  const timeStr = formatterTime.format(d).substring(0, 5); // "HH:mm"
  const datetimeStr = `${dateStr}T${timeStr}:00+05:30`;

  return {
    timestamp: ms,
    datetime: datetimeStr,
    date: dateStr,
    time: timeStr
  };
}

/**
 * Returns whether the Indian stock market (NSE/BSE) is currently OPEN in IST.
 * 
 * @returns {boolean}
 */
export function isMarketOpen() {
  const now = new Date();
  const formatterDay = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', weekday: 'short' });
  const formatterTime = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false });

  const day = formatterDay.format(now); // "Mon", "Tue", etc.
  const time = formatterTime.format(now); // "HH:mm"

  if (day === 'Sat' || day === 'Sun') {
    return false;
  }

  return time >= '09:15' && time <= '15:30';
}

/**
 * Returns today's date string in IST ("YYYY-MM-DD").
 * 
 * @returns {string}
 */
export function getTodayISTDate() {
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' });
  return formatter.format(new Date());
}
