
import { useState, useEffect } from 'react';
import {
  StockBasicData,
  AIAnalysisResponse,
  StockFundamentalData,
  CorporateAnnouncement,
} from '../types';
import { getComprehensiveStockAnalysis } from '../services/aiService';
import { isIndianMarketOpen } from '../services/marketTime';

interface UseStockAnalysisReturn {
  stockBasicData: StockBasicData | null;
  aiAnalysis: AIAnalysisResponse | null;
  stockFundamentalData: StockFundamentalData | null;
  corporateAnnouncements: CorporateAnnouncement[];
  sectorPeers: StockBasicData[];
  isLoading: boolean;
  error: string | null;
}

const useStockAnalysis = (stockSymbol: string): UseStockAnalysisReturn => {
  const [stockBasicData, setStockBasicData] = useState<StockBasicData | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysisResponse | null>(null);
  const [stockFundamentalData, setStockFundamentalData] = useState<StockFundamentalData | null>(null);
  const [corporateAnnouncements, setCorporateAnnouncements] = useState<CorporateAnnouncement[]>([]);
  const [sectorPeers, setSectorPeers] = useState<StockBasicData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDataForEffect = async (symbolToFetch: string) => {
      setIsLoading(true);
      setError(null);

      // Reset states
      setStockBasicData(null);
      setAiAnalysis(null);
      setStockFundamentalData(null);
      setCorporateAnnouncements([]);
      setSectorPeers([]);

      try {
        // Call the single "Research Agent" service which uses Google Search
        const comprehensiveData = await getComprehensiveStockAnalysis(symbolToFetch);

        if (!comprehensiveData || !comprehensiveData.basicData) {
          throw new Error(`Could not retrieve data for ${symbolToFetch}. Please try again.`);
        }

        setStockBasicData(comprehensiveData.basicData);
        setStockFundamentalData(comprehensiveData.fundamentals);
        setAiAnalysis(comprehensiveData.analysis);
        setCorporateAnnouncements(comprehensiveData.announcements || []);
        setSectorPeers(comprehensiveData.peers || []);

      } catch (err) {
        console.error("Error fetching stock analysis data:", err);
        const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    if (stockSymbol) {
      fetchDataForEffect(stockSymbol);
    } else {
      setIsLoading(false);
      setError(null);
    }
  }, [stockSymbol]);

  // Effect for simulating live price ticks removed to ensure data stability and accuracy as per user request.
  // In a real production app, this would be replaced by a WebSocket connection to a real-time data provider.
  useEffect(() => {
    // No-op for now.
  }, []);

  return { stockBasicData, aiAnalysis, stockFundamentalData, corporateAnnouncements, sectorPeers, isLoading, error };
};

export default useStockAnalysis;
