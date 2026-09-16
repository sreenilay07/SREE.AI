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

        const results = await Promise.all(
          stocks.map(async (stock) => {
            try {
              const cleanSym = stock.symbol.toUpperCase().replace(/\.NS$|\.BO$/, '');
              const realData = realTimeDataBatch.find(d => 
                d.symbol.toUpperCase().replace(/\.NS$|\.BO$/, '') === cleanSym || 
                d.symbol.toUpperCase() === stock.symbol.toUpperCase()
              );

              if (!realData) {
                return {
                  ...stock,
                  currentPrice: 0,
                  fundamentals: null
                } as ComparisonData;
              }

              return {
                ...stock,
                ...realData,
                fundamentals: (realData as any)?.fundamentals || null,
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
