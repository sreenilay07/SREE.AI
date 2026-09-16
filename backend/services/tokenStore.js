import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const TOKEN_FILE = path.join(DATA_DIR, 'upstox_token.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let cachedTokenState = null;

function loadTokenFromFile() {
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      const data = fs.readFileSync(TOKEN_FILE, 'utf8');
      cachedTokenState = JSON.parse(data);
      return cachedTokenState;
    }
  } catch (err) {
    console.error('[TOKEN STORE] Failed reading upstox_token.json:', err.message);
  }
  return null;
}

function saveTokenToFile(state) {
  try {
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(state, null, 2), 'utf8');
    cachedTokenState = state;
  } catch (err) {
    console.error('[TOKEN STORE] Failed saving upstox_token.json:', err.message);
  }
}

/**
 * Saves a new Upstox access token to persistent storage.
 * Upstox tokens typically expire daily at ~03:30 AM IST of the following day.
 * 
 * @param {object} param0 
 * @param {string} param0.accessToken
 * @param {number} [param0.expiresIn] Seconds until expiry (if provided by Upstox API)
 */
export function saveToken({ accessToken, expiresIn }) {
  const createdAt = Date.now();
  let expiresAt;

  if (expiresIn && typeof expiresIn === 'number') {
    expiresAt = createdAt + expiresIn * 1000;
  } else {
    // Upstox access tokens expire daily around 03:30 AM IST of the next day (or ~24h fallback)
    // Default to 20 hours if not specified
    expiresAt = createdAt + 20 * 60 * 60 * 1000;
  }

  const state = {
    accessToken,
    createdAt,
    expiresAt,
    createdAtISO: new Date(createdAt).toISOString(),
    expiresAtISO: new Date(expiresAt).toISOString(),
    expiresAtIST: new Date(expiresAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
  };

  saveTokenToFile(state);
  console.log(`[UPSTOX AUTH] New access token saved. Expires at: ${state.expiresAtIST}`);
  return state;
}

/**
 * Retrieves the current Upstox token state.
 */
export function getTokenState() {
  if (!cachedTokenState) {
    loadTokenFromFile();
  }

  // Fallback to process.env.UPSTOX_ACCESS_TOKEN if file state doesn't exist
  if (!cachedTokenState && process.env.UPSTOX_ACCESS_TOKEN) {
    return {
      accessToken: process.env.UPSTOX_ACCESS_TOKEN,
      createdAt: Date.now(),
      expiresAt: Date.now() + 12 * 60 * 60 * 1000,
      expiresAtIST: 'Environment Variable (.env)',
      isEnvFallback: true
    };
  }

  return cachedTokenState;
}

/**
 * Gets the current raw access token string.
 */
export function getAccessToken() {
  const state = getTokenState();
  return state ? state.accessToken : null;
}

/**
 * Checks token health status.
 * Buffer minutes defaults to 5 minutes.
 */
export function getTokenHealth(bufferMinutes = 5) {
  const state = getTokenState();

  if (!state || !state.accessToken) {
    return {
      status: 'EXPIRED',
      reason: 'NO_TOKEN',
      message: 'No Upstox token found. Please authenticate at /api/auth/upstox/login',
      expiresAtIST: 'N/A',
      minutesRemaining: 0
    };
  }

  const now = Date.now();
  const expiresAt = state.expiresAt || 0;
  const msRemaining = expiresAt - now - (bufferMinutes * 60 * 1000);
  const minutesRemaining = Math.max(0, Math.floor((expiresAt - now) / (60 * 1000)));

  if (msRemaining <= 0) {
    return {
      status: 'EXPIRED',
      reason: 'TOKEN_EXPIRED',
      message: `[UPSTOX AUTH] Token expired at ${state.expiresAtIST || '03:30 IST'} — re-authenticate at /api/auth/upstox/login`,
      expiresAtIST: state.expiresAtIST || 'Expired',
      minutesRemaining: 0
    };
  }

  if (minutesRemaining <= 120) {
    return {
      status: 'EXPIRING_SOON',
      reason: 'EXPIRES_WITHIN_2H',
      message: `[UPSTOX AUTH] Token expiring soon (${minutesRemaining} mins remaining). Re-auth before market opens: /api/auth/upstox/login`,
      expiresAtIST: state.expiresAtIST,
      minutesRemaining
    };
  }

  return {
    status: 'HEALTHY',
    reason: 'OK',
    message: `[UPSTOX AUTH] Token active. Expires at ${state.expiresAtIST}`,
    expiresAtIST: state.expiresAtIST,
    minutesRemaining
  };
}
