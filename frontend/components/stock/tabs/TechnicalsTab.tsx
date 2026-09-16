import React, { useState, useEffect, useMemo } from 'react';
import { AIAnalysisResponse, StockBasicData } from '../../../types';
import { CanonicalCandle, ChartInterval, resolveChartSession } from '../../../utils/marketSessionUtils';
import { getStockPriceHistory } from '../../../services/stockService';
import StockCandlestickChart from '../../charts/StockCandlestickChart';

interface TechnicalsTabProps {
  analysis: AIAnalysisResponse | null;
  stockData: StockBasicData | null;
}

const IndicatorDisplay: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex justify-between items-center py-2.5 border-b border-gray-700">
    <span className="text-sm font-medium text-gray-400">{label}:</span>
    <span className="text-sm text-gray-100 font-semibold">{value}</span>
  </div>
);

const intervalButtons: { key: ChartInterval, label: string }[] = [
  { key: '1D', label: '1D' },
  { key: '1W', label: '1W' },
  { key: '1M', label: '1M' },
  { key: '1Y', label: '1Y' },
  { key: '5Y', label: '5Y' },
];

const TechnicalsTab: React.FC<TechnicalsTabProps> = ({ analysis, stockData }) => {
  const [activeInterval, setActiveInterval] = useState<ChartInterval>('1D');
  const [rawCandles, setRawCandles] = useState<CanonicalCandle[]>([]);
  const [isLoadingChart, setIsLoadingChart] = useState(true);

  useEffect(() => {
    if (!stockData?.symbol) return;

    let isMounted = true;
    const fetchHistory = async () => {
      setIsLoadingChart(true);
      try {
        const history = await getStockPriceHistory(stockData.symbol, activeInterval, stockData.currentPrice);
        if (isMounted) setRawCandles(history);
      } catch (error) {
        console.error("Failed to fetch price history:", error);
        if (isMounted) setRawCandles([]);
      } finally {
        if (isMounted) setIsLoadingChart(false);
      }
    };

    fetchHistory();
    return () => { isMounted = false; };
  }, [stockData?.symbol, activeInterval, stockData?.currentPrice]);

  const resolvedSession = useMemo(() => {
    return resolveChartSession(rawCandles, activeInterval);
  }, [rawCandles, activeInterval]);

  if (!analysis || !stockData) {
     return (
      <div className="grid md:grid-cols-2 gap-6 animate-pulse">
        <div className="bg-gray-800 p-4 rounded-lg shadow h-64"></div>
        <div className="bg-gray-800 p-4 rounded-lg shadow h-64"></div>
      </div>
    );
  }

  const { technicalIndicatorSummary, keyLevels } = analysis;

  return (
    <div className="grid md:grid-cols-1 lg:grid-cols-5 gap-6">
      <div className="lg:col-span-3 space-y-4">
        <div className="flex justify-between items-center bg-gray-800 p-3 rounded-lg border border-gray-700 shadow-md">
          <h4 className="text-base font-semibold text-sky-400">Technicals Chart</h4>
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

        <StockCandlestickChart
          candles={resolvedSession.candles}
          stockData={stockData}
          interval={activeInterval}
          sessionDate={resolvedSession.sessionDate}
          isLive={resolvedSession.isLive}
          isLoading={isLoadingChart}
        />
      </div>

      <div className="lg:col-span-2 space-y-6">
        <div className="bg-gray-800 p-4 sm:p-6 rounded-lg shadow-xl border border-gray-700">
          <h4 className="text-xl font-semibold text-sky-400 mb-4">Indicator Summary</h4>
          <IndicatorDisplay label="RSI (14)" value={technicalIndicatorSummary.rsi} />
          <IndicatorDisplay label="MACD" value={technicalIndicatorSummary.macd} />
          <IndicatorDisplay label="Moving Averages" value={technicalIndicatorSummary.movingAverages} />
        </div>

        <div className="bg-gray-800 p-4 sm:p-6 rounded-lg shadow-xl border border-gray-700">
          <h4 className="text-xl font-semibold text-sky-400 mb-4">Key Levels</h4>
          <IndicatorDisplay label="Resistance 1" value={keyLevels.resistance1} />
          <IndicatorDisplay label="Support 1" value={keyLevels.support1} />
          {keyLevels.support2 && <IndicatorDisplay label="Support 2" value={keyLevels.support2} />}
        </div>
      </div>
    </div>
  );
};

export default TechnicalsTab;
