import { useState, useEffect } from 'react';
import { StockIdentifier, ComparisonData, StockBasicData, StockFundamentalData } from '../types';
import { getStockFundamentalData } from '../services/stockService';
import { getBatchStockDetails } from '../services/aiService';

interface UseStockComparisonReturn {
  stocksData: (ComparisonData | null)[];
  isLoading: boolean;
}

const useStockComparison = (stocks: StockIdentifier[]): UseStockComparisonReturn => {
  const [stocksData, setStocksData] = useState<(ComparisonData | null)[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchAllData = async () => {
      if (stocks.length === 0) {
        setStocksData([]);
        return;
      }
      setIsLoading(true);

      try {
        // 1. Get Real-Time Basic Data for ALL selected stocks in one go
        const symbols = stocks.map(s => s.symbol);
        const realTimeDataBatch = await getBatchStockDetails(symbols);

        // 2. Fetch fundamentals (still individual calls as they are mock/lightweight or could be optimized later)
        const results = await Promise.all(
          stocks.map(async (stock) => {
            try {
              // Find the real-time data for this stock
              const realData = realTimeDataBatch.find(d => d.symbol === stock.symbol);
              const fundamentalData = await getStockFundamentalData(stock.symbol);

              if (!realData) {
                // Fallback to basic structure if AI fails
                return {
                  ...stock,
                  currentPrice: 0,
                  fundamentals: null
                } as ComparisonData;
              }

              return {
                ...realData,
                fundamentals: (realData as any).fundamentals || null,
              } as ComparisonData;

            } catch (error) {
              console.error(`Failed to process data for ${stock.symbol}`, error);
              return null;
            }
          })
        );

        setStocksData(results);
      } catch (err) {
        console.error("Error in comparison fetch", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllData();
  }, [stocks]); // Re-run when the list of stocks to compare changes

  return { stocksData, isLoading };
};

export default useStockComparison;
