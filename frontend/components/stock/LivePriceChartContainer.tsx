import React, { useState, useEffect, useMemo } from 'react';
import { AIAnalysisResponse, StockBasicData } from '../../types';
import { CanonicalCandle, ChartInterval, resolveChartSession } from '../../utils/marketSessionUtils';
import { getStockPriceHistory } from '../../services/stockService';
import StockCandlestickChart from '../charts/StockCandlestickChart';

interface LivePriceChartContainerProps {
  analysis: AIAnalysisResponse | null;
  stockData: StockBasicData | null;
}

const intervalButtons: { key: ChartInterval; label: string }[] = [
  { key: '1D', label: '1D' },
  { key: '1W', label: '1W' },
  { key: '1M', label: '1M' },
  { key: '3M', label: '3M' },
  { key: '1Y', label: '1Y' },
  { key: '5Y', label: '5Y' },
];

const LivePriceChartContainer: React.FC<LivePriceChartContainerProps> = ({ stockData }) => {
  const [activeInterval, setActiveInterval] = useState<ChartInterval>('1D');
  const [rawCandles, setRawCandles] = useState<CanonicalCandle[]>([]);
  const [isLoadingChart, setIsLoadingChart] = useState(true);

  useEffect(() => {
    if (!stockData?.symbol) return;

    let isMounted = true;

    const fetchHistory = async () => {
      setIsLoadingChart(true);
      try {
        const history = await getStockPriceHistory(
          stockData.symbol,
          activeInterval,
          stockData.currentPrice
        );
        if (isMounted) {
          setRawCandles(history);
        }
      } catch (error) {
        console.error("Failed to fetch price history:", error);
        if (isMounted) setRawCandles([]);
      } finally {
        if (isMounted) setIsLoadingChart(false);
      }
    };

    fetchHistory();

    return () => {
      isMounted = false;
    };
  }, [stockData?.symbol, activeInterval, stockData?.currentPrice]);

  // Resolve session date and session-specific candles (Requirement 8 & 11)
  const resolvedSession = useMemo(() => {
    return resolveChartSession(rawCandles, activeInterval);
  }, [rawCandles, activeInterval]);

  if (!stockData) {
    return (
      <div className="bg-gray-800 shadow-xl rounded-xl p-4 sm:p-6 lg:p-8 border border-gray-700 animate-pulse">
        <div className="w-full aspect-[2/1] bg-gray-700 rounded-lg"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Timeframe Selector Bar */}
      <div className="flex justify-between items-center bg-gray-800 p-3 rounded-lg border border-gray-700 shadow-md">
        <h4 className="text-base font-semibold text-sky-400">Technical Candlestick Chart</h4>
        <div className="flex items-center gap-1 bg-gray-750 p-1 rounded-md">
          {intervalButtons.map(interval => (
            <button
              key={interval.key}
              onClick={() => setActiveInterval(interval.key)}
              className={`px-3 py-1 text-xs font-semibold rounded transition-colors duration-200 ${
                activeInterval === interval.key
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-gray-300 hover:bg-gray-700'
              }`}
            >
              {interval.label}
            </button>
          ))}
        </div>
      </div>

      {/* Candlestick Visualization */}
      <StockCandlestickChart
        candles={resolvedSession.candles}
        stockData={stockData}
        interval={activeInterval}
        sessionDate={resolvedSession.sessionDate}
        isLive={resolvedSession.isLive}
        isLoading={isLoadingChart}
      />
    </div>
  );
};

export default LivePriceChartContainer;
