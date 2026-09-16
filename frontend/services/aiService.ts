import { 
  StockBasicData, 
  ScreenerCriteria, 
  PortfolioHolding, 
  AIPortfolioAnalysis, 
  ComparisonData, 
  AIComparisonResponse, 
  AIScreenerAnalysis, 
  ComprehensiveStockAnalysis 
} from '../types';

// Detect base URL from environment, use Render in production, or relative (proxied) in local dev
const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? 'https://sree-ai.onrender.com' : '');

const fetchJson = async <T>(url: string, options?: RequestInit): Promise<T> => {
  const response = await fetch(`${API_BASE}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const errText = await response.text();
    let errMessage = 'API Request failed';
    try {
      const errJson = JSON.parse(errText);
      errMessage = errJson.error || errJson.text || errMessage;
    } catch (_) {
      errMessage = errText || errMessage;
    }
    throw new Error(errMessage);
  }

  return response.json() as Promise<T>;
};

export const getComprehensiveStockAnalysis = async (symbol: string): Promise<ComprehensiveStockAnalysis> => {
  return fetchJson<ComprehensiveStockAnalysis>(`/api/stocks/analysis/${encodeURIComponent(symbol)}`);
};

export const getTermExplanation = async (term: string): Promise<string> => {
  try {
    const response = await fetch(`${API_BASE}/api/term/explain?term=${encodeURIComponent(term)}`);
    if (!response.ok) return 'Explanation unavailable.';
    return await response.text();
  } catch (e) {
    return 'Explanation temporarily unavailable.';
  }
};

export const parseScreenerQuery = async (query: string): Promise<ScreenerCriteria> => {
  try {
    return await fetchJson<ScreenerCriteria>('/api/screener/parse', {
      method: 'POST',
      body: JSON.stringify({ query }),
    });
  } catch (e) {
    return {};
  }
};

export const getAIScreenerAnalysis = async (query: string, stocks: StockBasicData[]): Promise<AIScreenerAnalysis> => {
  return fetchJson<AIScreenerAnalysis>('/api/screener/analyze', {
    method: 'POST',
    body: JSON.stringify({ query, stocks }),
  });
};

export const getAIPortfolioAnalysis = async (holdings: PortfolioHolding[]): Promise<AIPortfolioAnalysis> => {
  return fetchJson<AIPortfolioAnalysis>('/api/portfolio/analyze', {
    method: 'POST',
    body: JSON.stringify({ holdings }),
  });
};

export const getAIComparison = async (stocks: ComparisonData[]): Promise<AIComparisonResponse> => {
  return fetchJson<AIComparisonResponse>('/api/stocks/compare', {
    method: 'POST',
    body: JSON.stringify({ stocks }),
  });
};

export const getBatchStockDetails = async (symbols: string[]): Promise<StockBasicData[]> => {
  try {
    return await fetchJson<StockBasicData[]>('/api/stocks/batch', {
      method: 'POST',
      body: JSON.stringify({ symbols }),
    });
  } catch (e) {
    console.error('Error fetching batch stock details:', e);
    return [];
  }
};
