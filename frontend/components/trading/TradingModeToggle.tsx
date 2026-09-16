import React from 'react';
import { ApplicationMode } from '../../types/trading';

interface TradingModeToggleProps {
  mode: ApplicationMode;
  onModeChange: (mode: ApplicationMode) => void;
}

const TradingModeToggle: React.FC<TradingModeToggleProps> = ({ mode, onModeChange }) => {
  const isTrader = mode === 'TRADER';

  return (
    <div className="inline-flex items-center bg-gray-950/80 p-1 rounded-full border border-gray-800 shadow-inner">
      <button
        type="button"
        onClick={() => onModeChange('INVESTOR')}
        className={`px-3 sm:px-4 py-1.5 rounded-full text-xs sm:text-sm font-medium tracking-wide transition-all duration-200 ${
          !isTrader
            ? 'bg-sky-500 text-gray-950 font-semibold shadow-md'
            : 'text-gray-400 hover:text-gray-200'
        }`}
        aria-pressed={!isTrader}
      >
        INVESTORS
      </button>

      <button
        type="button"
        onClick={() => onModeChange('TRADER')}
        className={`px-3 sm:px-4 py-1.5 rounded-full text-xs sm:text-sm font-medium tracking-wide transition-all duration-200 flex items-center space-x-1.5 ${
          isTrader
            ? 'bg-sky-500 text-gray-950 font-semibold shadow-md'
            : 'text-gray-400 hover:text-gray-200'
        }`}
        aria-pressed={isTrader}
      >
        <span>TRADERS</span>
        {isTrader && (
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
        )}
      </button>
    </div>
  );
};

export default TradingModeToggle;
