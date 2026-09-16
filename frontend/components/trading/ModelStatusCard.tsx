import React from 'react';
import { TradingModelStatus } from '../../types/trading';

interface ModelStatusCardProps {
  model: TradingModelStatus;
  confidence: number;
}

const ModelStatusCard: React.FC<ModelStatusCardProps> = ({ model, confidence }) => {
  const gruActive = Boolean(model?.gru);
  const xgbActive = Boolean(model?.xgboost);

  return (
    <div className="bg-gray-800/80 backdrop-blur border border-gray-700/70 rounded-xl p-5 sm:p-6 shadow-lg flex flex-col justify-between">
      <div>
        <div className="border-b border-gray-700/60 pb-3 mb-4">
          <h3 className="text-sm font-semibold tracking-wider text-gray-300 uppercase">
            Model Architecture
          </h3>
        </div>

        <div className="grid grid-cols-2 gap-4 my-2">
          {/* GRU */}
          <div className="bg-gray-900/60 border border-gray-700/40 rounded-lg p-3 text-center">
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
              GRU Neural Net
            </div>
            <div className="flex items-center justify-center space-x-1 font-mono text-sm">
              {gruActive ? (
                <span className="text-emerald-400 font-bold flex items-center">
                  <svg className="w-4 h-4 mr-1 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  Active
                </span>
              ) : (
                <span className="text-amber-400/90 text-xs">Unavailable</span>
              )}
            </div>
          </div>

          {/* XGBoost */}
          <div className="bg-gray-900/60 border border-gray-700/40 rounded-lg p-3 text-center">
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
              XGBoost Ensembles
            </div>
            <div className="flex items-center justify-center space-x-1 font-mono text-sm">
              {xgbActive ? (
                <span className="text-emerald-400 font-bold flex items-center">
                  <svg className="w-4 h-4 mr-1 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  Active
                </span>
              ) : (
                <span className="text-amber-400/90 text-xs">Unavailable</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 pt-4 border-t border-gray-700/60">
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-semibold tracking-wider text-gray-400 uppercase">
            ML Validation Confidence
          </span>
          <span className="text-2xl font-extrabold text-sky-400 font-mono">
            {confidence > 0 ? `${confidence.toFixed(1)}%` : '—'}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-900/80 rounded-full h-2 mt-2.5 overflow-hidden border border-gray-700/40">
          <div
            className={`h-full transition-all duration-500 rounded-full ${
              confidence >= 60 ? 'bg-sky-400' : 'bg-amber-400'
            }`}
            style={{ width: `${Math.min(100, Math.max(0, confidence))}%` }}
          ></div>
        </div>
        <div className="flex justify-between text-[10px] text-gray-500 mt-1 font-mono">
          <span>0%</span>
          <span>Threshold 60%</span>
          <span>100%</span>
        </div>
      </div>
    </div>
  );
};

export default ModelStatusCard;
