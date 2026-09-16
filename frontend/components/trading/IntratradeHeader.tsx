import React from 'react';
import { TradingMarketInfo } from '../../types/trading';

interface IntratradeHeaderProps {
  symbol: string;
  name: string;
  currentPrice: number;
  market: TradingMarketInfo;
}

const IntratradeHeader: React.FC<IntratradeHeaderProps> = ({
  symbol,
  name,
  currentPrice,
  market
}) => {
  const isMarketOpen = Boolean(market?.isOpen);

  return (
    <div className="bg-gray-800/80 backdrop-blur border border-gray-700/70 rounded-xl p-5 sm:p-6 shadow-lg transition-all">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">{symbol}</h2>
            <span className="px-2.5 py-0.5 rounded text-xs font-semibold tracking-wider bg-gray-700/80 text-gray-300 border border-gray-600/50">
              NSE
            </span>
          </div>
          <p className="text-sm text-gray-400 mt-0.5 truncate max-w-md">{name || symbol}</p>
        </div>

        <div className="flex sm:flex-col items-baseline sm:items-end justify-between sm:justify-center gap-2">
          {currentPrice > 0 ? (
            <div className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-100 font-mono">
              ₹{currentPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          ) : (
            <div className="text-xl font-medium text-gray-500 font-mono">Price Unavailable</div>
          )}

          <div className="inline-flex items-center space-x-2">
            {isMarketOpen ? (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-700/60 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-400 mr-1.5 animate-pulse"></span>
                MARKET OPEN
              </span>
            ) : (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-700/60 text-gray-400 border border-gray-600/60 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-gray-400 mr-1.5"></span>
                MARKET CLOSED
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default IntratradeHeader;
