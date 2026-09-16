import React from 'react';

interface TradingSignalCardProps {
  signal: string;
  disclaimer?: string;
  reason?: string;
}

const TradingSignalCard: React.FC<TradingSignalCardProps> = ({
  signal,
  disclaimer = 'AI forecast only — not financial advice',
  reason
}) => {
  const isBullish = signal === 'BULLISH' || signal === 'BUY' || signal.includes('BUY');
  const isBearish = signal === 'BEARISH' || signal === 'SELL' || signal.includes('SELL');
  const isNoTrade = !isBullish && !isBearish;

  return (
    <div className="bg-gray-800/80 backdrop-blur border border-gray-700/70 rounded-xl p-5 sm:p-6 shadow-lg text-center flex flex-col items-center justify-center">
      <div className="text-xs uppercase tracking-widest text-gray-400 font-semibold mb-2">
        Execution Signal
      </div>

      <div className="my-2">
        {isBullish && (
          <div className="inline-flex items-center px-6 py-2.5 rounded-xl font-extrabold text-lg sm:text-xl tracking-wider bg-emerald-950/80 text-emerald-400 border border-emerald-600/70 shadow-lg shadow-emerald-950/40">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 mr-2.5 animate-pulse"></span>
            BULLISH
          </div>
        )}

        {isBearish && (
          <div className="inline-flex items-center px-6 py-2.5 rounded-xl font-extrabold text-lg sm:text-xl tracking-wider bg-rose-950/80 text-rose-400 border border-rose-600/70 shadow-lg shadow-rose-950/40">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-400 mr-2.5 animate-pulse"></span>
            BEARISH
          </div>
        )}

        {isNoTrade && (
          <div className="inline-flex items-center px-6 py-2.5 rounded-xl font-extrabold text-lg sm:text-xl tracking-wider bg-gray-900/90 text-amber-400/90 border border-amber-600/40 shadow-md">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 mr-2.5"></span>
            NO TRADE
          </div>
        )}
      </div>

      {reason && (
        <p className="text-xs text-gray-400 max-w-md mt-2 leading-relaxed">
          {reason}
        </p>
      )}

      <div className="mt-4 pt-3 border-t border-gray-700/40 w-full flex items-center justify-center space-x-1.5 text-xs text-gray-400 font-mono">
        <svg className="w-4 h-4 text-amber-400/90 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <span>{disclaimer}</span>
      </div>
    </div>
  );
};

export default TradingSignalCard;
