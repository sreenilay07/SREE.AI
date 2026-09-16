import React from 'react';
import { TradingHorizonForecast } from '../../types/trading';

interface IntradayForecastProps {
  forecasts: Record<string, TradingHorizonForecast>;
}

const DISPLAY_HORIZONS = [5, 10, 15, 30, 45, 60];

const IntradayForecast: React.FC<IntradayForecastProps> = ({ forecasts }) => {
  return (
    <div className="bg-gray-800/80 backdrop-blur border border-gray-700/70 rounded-xl p-5 sm:p-6 shadow-lg">
      <div className="flex items-center justify-between border-b border-gray-700/60 pb-3 mb-4">
        <h3 className="text-sm font-semibold tracking-wider text-gray-300 uppercase">
          AI Intraday Forecast
        </h3>
        <span className="text-xs text-sky-400 font-mono font-medium">Multi-Horizon</span>
      </div>

      <div className="divide-y divide-gray-700/40">
        {DISPLAY_HORIZONS.map((mins) => {
          const item = forecasts[String(mins)];

          if (!item) {
            return (
              <div key={mins} className="py-3 flex items-center justify-between text-sm text-gray-500 font-mono">
                <span className="font-semibold">{mins} MIN</span>
                <span>Prediction unavailable</span>
              </div>
            );
          }

          const isPositive = item.direction === 'INCREASE' || item.expectedMovePercent > 0;
          const isNegative = item.direction === 'DECREASE' || item.expectedMovePercent < 0;

          return (
            <div
              key={mins}
              className="py-3.5 flex items-center justify-between transition-colors hover:bg-gray-750/30 px-2 rounded-lg"
            >
              <div className="flex items-center space-x-3">
                <span className="w-16 text-xs sm:text-sm font-bold tracking-wide text-gray-300 font-mono">
                  {mins} MIN
                </span>
                <span className="hidden sm:inline-block text-xs px-2 py-0.5 rounded bg-gray-700/50 text-gray-400 font-mono">
                  {item.modelUsed || 'GRU'}
                </span>
              </div>

              <div className="text-sm sm:text-base font-bold text-gray-100 font-mono">
                ₹{item.predictedPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>

              <div className="w-24 text-right">
                <span
                  className={`inline-flex items-center text-xs sm:text-sm font-semibold font-mono ${
                    isPositive
                      ? 'text-emerald-400'
                      : isNegative
                      ? 'text-rose-400'
                      : 'text-gray-400'
                  }`}
                >
                  {isPositive && '↗ +'}
                  {isNegative && '↘ '}
                  {!isPositive && !isNegative && '→ '}
                  {item.expectedMovePercent.toFixed(2)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default IntradayForecast;
