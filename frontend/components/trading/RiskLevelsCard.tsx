import React from 'react';
import { TradingRiskLevels } from '../../types/trading';

interface RiskLevelsCardProps {
  risk: TradingRiskLevels;
}

const RiskLevelsCard: React.FC<RiskLevelsCardProps> = ({ risk }) => {
  const hasValues = Boolean(risk && risk.entry > 0);

  return (
    <div className="bg-gray-800/80 backdrop-blur border border-gray-700/70 rounded-xl p-5 sm:p-6 shadow-lg">
      <div className="border-b border-gray-700/60 pb-3 mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold tracking-wider text-gray-300 uppercase">
          Risk Management Levels
        </h3>
        <span className="text-xs text-gray-400 font-mono">ATR Based</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 font-mono">
        {/* Entry */}
        <div className="bg-gray-900/60 border border-gray-700/40 rounded-lg p-3">
          <div className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold mb-1">
            Entry Price
          </div>
          <div className="text-base sm:text-lg font-bold text-gray-200">
            {hasValues
              ? `₹${risk.entry.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : '—'}
          </div>
        </div>

        {/* Target */}
        <div className="bg-gray-900/60 border border-gray-700/40 rounded-lg p-3">
          <div className="text-[11px] uppercase tracking-wider text-emerald-400/90 font-semibold mb-1">
            Target Price
          </div>
          <div className="text-base sm:text-lg font-bold text-emerald-400">
            {hasValues && risk.targetPrice
              ? `₹${risk.targetPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : '—'}
          </div>
        </div>

        {/* Stop Loss */}
        <div className="bg-gray-900/60 border border-gray-700/40 rounded-lg p-3">
          <div className="text-[11px] uppercase tracking-wider text-rose-400/90 font-semibold mb-1">
            Stop Loss
          </div>
          <div className="text-base sm:text-lg font-bold text-rose-400">
            {hasValues && risk.stopLoss
              ? `₹${risk.stopLoss.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : '—'}
          </div>
        </div>

        {/* Risk / Reward */}
        <div className="bg-gray-900/60 border border-gray-700/40 rounded-lg p-3">
          <div className="text-[11px] uppercase tracking-wider text-sky-400/90 font-semibold mb-1">
            Risk / Reward
          </div>
          <div className="text-base sm:text-lg font-bold text-sky-300">
            {hasValues && risk.riskReward !== null && risk.riskReward !== undefined
              ? `1 : ${risk.riskReward.toFixed(1)}`
              : '—'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RiskLevelsCard;
