import React, { useState, useEffect, useCallback } from 'react';
import SearchBar from '../components/search/SearchBar';
import { StockIdentifier } from '../types';
import { TradingPredictionResponse } from '../types/trading';
import { getTradingPrediction, getTradingHealth } from '../services/tradingService';

import IntratradeHeader from '../components/trading/IntratradeHeader';
import IntradayForecast from '../components/trading/IntradayForecast';
import ModelStatusCard from '../components/trading/ModelStatusCard';
import ForecastChart from '../components/trading/ForecastChart';
import RiskLevelsCard from '../components/trading/RiskLevelsCard';
import TradingSignalCard from '../components/trading/TradingSignalCard';

const IntratradePage: React.FC = () => {
  // Default to MRF as configured in notebook, or allow user to search any stock
  const [selectedStock, setSelectedStock] = useState<StockIdentifier>({
    symbol: 'MRF',
    name: 'MRF Ltd',
    exchange: 'NSE'
  });

  const [prediction, setPrediction] = useState<TradingPredictionResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingStep, setLoadingStep] = useState<string>('');
  const [errorReason, setErrorReason] = useState<string | null>(null);
  const [serviceStatus, setServiceStatus] = useState<string>('checking');

  // Check ML service health on mount
  useEffect(() => {
    let mounted = true;
    getTradingHealth()
      .then((res) => {
        if (!mounted) return;
        if (res.status === 'ok') {
          setServiceStatus('ready');
        } else if (res.status === 'degraded') {
          setServiceStatus('degraded');
        } else {
          setServiceStatus('offline');
        }
      })
      .catch(() => {
        if (mounted) setServiceStatus('offline');
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Fetch prediction function
  const fetchPredictionForStock = useCallback(async (stock: StockIdentifier) => {
    setIsLoading(true);
    setErrorReason(null);

    // Multi-step loading progress indicators (without fake data)
    setLoadingStep(`Analyzing ${stock.symbol}...`);
    const timer1 = setTimeout(() => setLoadingStep('Fetching live market data...'), 600);
    const timer2 = setTimeout(() => setLoadingStep('Preparing 5-minute candles...'), 1200);
    const timer3 = setTimeout(() => setLoadingStep('Running intraday model...'), 2000);
    const timer4 = setTimeout(() => setLoadingStep('Generating forecast...'), 2800);

    try {
      const data = await getTradingPrediction(stock.symbol, (stock as any).instrumentKey, stock.name);
      
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);

      setPrediction(data);

      if (data.status === 'error' || data.status === 'out_of_distribution' || data.status === 'insufficient_data' || data.status === 'stale_data') {
        setErrorReason(data.reason || data.message || 'Unable to generate prediction');
      }
    } catch (err: any) {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
      setErrorReason(err.message || 'Error communicating with ML prediction gateway');
      setPrediction(null);
    } finally {
      setIsLoading(false);
      setLoadingStep('');
    }
  }, []);

  // Initial fetch for default stock
  useEffect(() => {
    fetchPredictionForStock(selectedStock);
  }, [fetchPredictionForStock]);

  const handleStockSelect = (stock: StockIdentifier) => {
    setSelectedStock(stock);
    fetchPredictionForStock(stock);
  };

  const hasValidForecast = prediction && prediction.status === 'success' && Object.keys(prediction.forecasts || {}).length > 0;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Search Bar Section */}
      <div className="bg-gray-850 border border-gray-700/60 rounded-xl p-5 shadow-lg">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-3">
            <h2 className="text-lg font-bold text-white tracking-wide">
              SREE.AI <span className="text-sky-400">INTRATRADE</span>
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Live intraday deep learning forecasts powered by production GRU & XGBoost
            </p>
          </div>
          <SearchBar onStockSelect={handleStockSelect} />
        </div>
      </div>

      {/* Loading State Overlay */}
      {isLoading && (
        <div className="bg-gray-800/90 border border-sky-500/30 rounded-xl p-10 text-center shadow-xl backdrop-blur animate-pulse">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-sky-950/80 border border-sky-500/50 mb-4">
            <div className="w-6 h-6 border-2 border-sky-400 border-t-transparent rounded-full animate-spin"></div>
          </div>
          <h3 className="text-lg font-bold text-white font-mono">{loadingStep}</h3>
          <p className="text-xs text-gray-400 mt-1">Executing real-time inference on session candles</p>
        </div>
      )}

      {/* Main Content (when not loading) */}
      {!isLoading && prediction && (
        <div className="space-y-6">
          {/* Stock Header + Market Status */}
          <IntratradeHeader
            symbol={prediction.stock?.symbol || selectedStock.symbol}
            name={prediction.stock?.name || selectedStock.name}
            currentPrice={prediction.currentPrice}
            market={prediction.market}
          />

          {/* Technical Diagnostics / Warning Banner if non-success */}
          {errorReason && (
            <div className="bg-gray-850 border-l-4 border-amber-500 p-4 rounded-r-xl shadow-md">
              <div className="flex items-start space-x-3">
                <svg className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <h4 className="text-sm font-semibold text-amber-300">Live prediction notice</h4>
                  <p className="text-xs text-gray-300 mt-1 leading-relaxed">{errorReason}</p>
                  {prediction.message && (
                    <span className="inline-block mt-2 px-2 py-0.5 rounded text-[11px] font-mono bg-gray-800 text-gray-400 border border-gray-700">
                      Code: {prediction.message}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Forecast Grid */}
          {hasValidForecast ? (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 2 Cols: AI Intraday Forecast */}
                <div className="lg:col-span-2">
                  <IntradayForecast forecasts={prediction.forecasts} />
                </div>

                {/* 1 Col: Model Status & Validation Confidence */}
                <div className="lg:col-span-1">
                  <ModelStatusCard model={prediction.model} confidence={prediction.confidence} />
                </div>
              </div>

              {/* Forecast Trajectory Chart */}
              <ForecastChart
                currentPrice={prediction.currentPrice}
                forecasts={prediction.forecasts}
              />

              {/* Risk Levels & Trading Signal */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <RiskLevelsCard risk={prediction.risk} />
                <TradingSignalCard
                  signal={prediction.signal}
                  disclaimer={prediction.disclaimer}
                  reason={prediction.reason}
                />
              </div>
            </>
          ) : (
            !errorReason && (
              <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-8 text-center text-gray-400 font-mono text-sm">
                No active prediction generated for {selectedStock.symbol}.
              </div>
            )
          )}
        </div>
      )}

      {/* Fallback Empty State if no prediction object */}
      {!isLoading && !prediction && (
        <div className="bg-gray-850 border border-gray-700/60 rounded-xl p-10 text-center text-gray-400">
          <p className="text-sm">Search for a stock above to view live intraday ML forecasts.</p>
        </div>
      )}
    </div>
  );
};

export default IntratradePage;
