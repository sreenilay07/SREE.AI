
import React, { useState, useEffect } from 'react';
import { AIAnalysisResponse, StockBasicData, PriceDataPoint, CandleDataPoint, ChartInterval } from '../../types';
import PriceHistoryChart from '../charts/PriceHistoryChart';
import { getStockPriceHistory } from '../../services/stockService';

interface LivePriceChartContainerProps {
  analysis: AIAnalysisResponse | null;
  stockData: StockBasicData | null;
}

const intervalButtons: { key: ChartInterval, label: string }[] = [
  { key: '1D', label: '1D' },
  { key: '1W', label: '1W' },
  { key: '1M', label: '1M' },
  { key: '1Y', label: '1Y' },
  { key: '5Y', label: '5Y' },
];

const LivePriceChartContainer: React.FC<LivePriceChartContainerProps> = ({ analysis, stockData }) => {
  const [activeInterval, setActiveInterval] = useState<ChartInterval>('1D');
  const [priceHistory, setPriceHistory] = useState<CandleDataPoint[]>([]);
  const [isLoadingChart, setIsLoadingChart] = useState(true);

  useEffect(() => {
    if (!stockData?.symbol) return;

    const fetchHistory = async () => {
      setIsLoadingChart(true);
      setPriceHistory([]);
      try {
        // Pass the real current price and historical data to anchor the chart data correctly
        const history = await getStockPriceHistory(
          stockData.symbol,
          activeInterval,
          stockData.currentPrice,
          analysis?.historicalData
        );
        setPriceHistory(history);
      } catch (error) {
        console.error("Failed to fetch price history:", error);
        setPriceHistory([]);
      } finally {
        setIsLoadingChart(false);
      }
    };

    fetchHistory();
  }, [stockData?.symbol, activeInterval, stockData?.currentPrice]);


  // Live update logic removed to ensure stability as per user request.
  // The chart will now only update when a full data refresh occurs.
  useEffect(() => {
    // No-op
  }, []);

  if (!analysis || !stockData) {
    return (
      <div className="bg-gray-800 shadow-xl rounded-xl p-4 sm:p-6 lg:p-8 border border-gray-700 animate-pulse">
        <div className="w-full aspect-[9/2] bg-gray-700 rounded-lg"></div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 shadow-xl rounded-xl p-4 sm:p-6 lg:p-8 border border-gray-700">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
        <h4 className="text-xl font-semibold text-sky-400">Live Price Chart</h4>
        <div className="flex items-center gap-1 bg-gray-700 p-1 rounded-md mt-2 sm:mt-0">
          {intervalButtons.map(interval => (
            <button
              key={interval.key}
              onClick={() => setActiveInterval(interval.key)}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors duration-200 ${activeInterval === interval.key
                ? 'bg-sky-600 text-white'
                : 'text-gray-300 hover:bg-gray-600'
                }`}
            >
              {interval.label}
            </button>
          ))}
        </div>
      </div>
      {isLoadingChart ? (
        <div className="w-full aspect-[9/2] bg-gray-700 rounded-md animate-pulse flex items-center justify-center">
          <p className="text-gray-400">Loading Chart Data...</p>
        </div>
      ) : (
        <PriceHistoryChart data={priceHistory} stockData={stockData} />
      )}
      <p className="text-xs text-gray-500 mt-2 text-center">Note: Chart displays simulated data anchored to live prices for demonstration.</p>
    </div>
  );
};

export default LivePriceChartContainer;
