
export interface StockIdentifier {
  symbol: string;
  name: string;
  exchange: 'NSE' | 'BSE';
  sector?: string;
}

export interface StockBasicData extends StockIdentifier {
  currentPrice: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  change: number;
  changePercent: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  marketCap: string; // e.g., "₹10,000 Cr"
  peRatio?: number | null;
  pbRatio?: number | null;
  dividendYield?: number | null;
  debtToEquity?: number | null;
  roe?: number | null;
  promoterHolding?: number | null;
  promoterPledged?: number | null; // Percentage
  sector: string;
}

export interface FinancialMetric {
  period: string; // e.g., "Q1 2023", "FY2023"
  revenue: number;
  netProfit: number;
  eps: number;
}

export interface RatioMetricDetail {
  company_value: string | null;
  sector_value: string | null;
  numCompany: number | null;
  numSector: number | null;
}

export interface StockFundamentalData {
  isAvailable?: boolean;
  reason?: string;
  source?: string;
  financialHealth: FinancialMetric[]; // Quarterly or Annual
  keyRatios: {
    pe?: number | null;
    pb?: number | null;
    debtToEquity?: number | null;
    roe?: number | null;
    dividendYield?: number | null;
  };
  metrics?: {
    pe?: RatioMetricDetail | null;
    pb?: RatioMetricDetail | null;
    roa?: RatioMetricDetail | null;
    roe?: RatioMetricDetail | null;
    roce?: RatioMetricDetail | null;
    evEbitda?: RatioMetricDetail | null;
    debtToEquity?: RatioMetricDetail | null;
    dividendYield?: RatioMetricDetail | null;
  };
  shareholdingPattern: {
    promoter: number | null;
    fii: number | null;
    dii: number | null;
    public: number | null;
    pledgedPromoter?: number | null; // Percentage
  };
}

export interface NewsItemRaw {
  headline: string;
  source: string;
  date: string;
  link: string;
  summary?: string;
}

export interface CorporateAnnouncement {
  title: string;
  date: string;
  link: string;
  category: string; // e.g., "Results", "Dividend", "Board Meeting"
}

// Data returned from Gemini service (parsed from JSON response)
export interface AISuggestionDetail {
  idealRange?: string;
  trigger?: string;
  advice?: string;
  stopLoss?: string;
  target?: string;
}

export interface AISuggestionPortal {
  buy: AISuggestionDetail;
  hold: AISuggestionDetail;
  sell: AISuggestionDetail;
}

export interface AIScoreDetail {
  score: number; // out of 10
  justification: string;
}

export interface AIScoreData {
  overall: AIScoreDetail;
  fundamentals: AIScoreDetail;
  valuation: AIScoreDetail;
  technicals: AIScoreDetail;
  sentimentNews: AIScoreDetail;
}

export interface AITechnicalIndicatorSummary {
  rsi: string; // e.g., "72 (Overbought)"
  macd: string; // e.g., "Bullish Crossover"
  movingAverages: string; // e.g., "Price is above 50 & 200 DMA (Long-term Bullish)"
}

export interface AIKeyLevels {
  resistance1: string;
  support1: string;
  support2?: string;
}

export interface AINewsItemAnalysis {
  headline: string;
  sentiment: 'Positive' | 'Negative' | 'Neutral';
  originalSource?: string; // To link back if needed
  originalDate?: string;
  link?: string;
}

export interface AISectorOutlook {
  growthPotential: string;
  lifespan: string;
  aiRationale: string;
}

export interface AIEducationalInsights {
  sectorFactors: string[];
  observation: string;
}

export interface VerdictFactor {
  metric: string;
  actual: string;
  preferred: string;
  status: 'Positive' | 'Negative' | 'Neutral';
}

export interface AIAnalysisResponse {
  verdict: 'BUY' | 'HOLD' | 'SELL';
  confidence?: number;
  aiRationale: string;
  suggestionPortal: AISuggestionPortal;
  sreeAIScore: AIScoreData;
  technicalIndicatorSummary: AITechnicalIndicatorSummary;
  keyLevels: AIKeyLevels;
  newsAnalysis: AINewsItemAnalysis[];
  sectorOutlook: AISectorOutlook;
  educationalInsights?: AIEducationalInsights;
  sources: string[];
  verdictDetails: VerdictFactor[];
  historicalData?: { date: string, price: number }[];
}

// New interface for the master object returned by the Research-Agent style Gemini call
export interface ComprehensiveStockAnalysis {
  basicData: StockBasicData;
  fundamentals: StockFundamentalData;
  analysis: AIAnalysisResponse;
  announcements: CorporateAnnouncement[];
  peers: StockBasicData[]; // Simplified peer data for comparison
}

// For chart components
export interface ChartDataPoint {
  name: string;
  value: number;
}
export interface FinancialChartDataPoint {
  period: string;
  revenue: number;
  netProfit: number;
  eps: number;
}

export interface PriceDataPoint {
  time: string;
  price: number;
}

export interface CandleDataPoint {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export type ChartInterval = '1D' | '1W' | '1M' | '3M' | '1Y' | '5Y';

export interface StockChartResponse {
  symbol: string;
  timeframe: ChartInterval;
  isPreviousSession: boolean;
  sessionDate?: string;
  candles: CandleDataPoint[];
}

export enum TabKey {
  SUMMARY = 'Summary & Score',
  FUNDAMENTALS = 'Fundamental Deep Dive',
  NEWS = 'News & Announcements',
}

// For Chatbot
export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

// For Portfolio Manager
export interface PortfolioHolding {
  symbol: string;
  name: string;
  quantity: number;
  buyPrice: number;
  exchange: 'NSE' | 'BSE';
}

export interface PortfolioHoldingWithMarketData extends PortfolioHolding {
  currentPrice: number;
  changePercent: number;
  currentValue: number;
  totalPandL: number;
  totalPandLPercent: number;
}

export interface AIPortfolioAnalysis {
  overallScore: number; // 1-10
  diversification: {
    rating: 'Poor' | 'Fair' | 'Good' | 'Excellent';
    feedback: string;
  };
  suggestions: {
    add: string[];
    reduce: string[];
  };
  healthSummary: string;
}

// For Screener
export interface ScreenerCriteria {
  exchange?: string;
  sector?: string;
  price_lt?: number;
  price_gt?: number;
  marketCap_gt?: number; // in Cr
  marketCap_lt?: number; // in Cr
  peRatio_lt?: number;
  peRatio_gt?: number;
  dividendYield_gt?: number;
  performance?: 'gained_week' | 'lost_week' | 'gained_month' | 'lost_month';
  limit?: number;
}

// For AI Screener Analysis
export interface AIScreenerAnalysis {
  summary: string;
  commonThemes: string[];
  topPicks: {
    symbol: string;
    name: string;
    reason: string;
  }[];
}

// For Comparison Page
export interface ComparisonData extends StockBasicData {
  fundamentals: StockFundamentalData | null;
}

export interface AIComparisonResponse {
  summary: string;
  recommendation: string;
  winnerSymbol?: string;
  pros: { [symbol: string]: string[] };
  cons: { [symbol: string]: string[] };
}
