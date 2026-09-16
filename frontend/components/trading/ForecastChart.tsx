import React from 'react';
import { TradingHorizonForecast } from '../../types/trading';

interface ForecastChartProps {
  currentPrice: number;
  forecasts: Record<string, TradingHorizonForecast>;
}

const DISPLAY_HORIZONS = [5, 10, 15, 30, 45, 60];

const ForecastChart: React.FC<ForecastChartProps> = ({ currentPrice, forecasts }) => {
  if (!currentPrice || currentPrice <= 0) {
    return null;
  }

  // Build true trajectory data points
  const points: { label: string; minutes: number; price: number; isForecast: boolean }[] = [
    { label: 'Now', minutes: 0, price: currentPrice, isForecast: false }
  ];

  DISPLAY_HORIZONS.forEach((m) => {
    const f = forecasts[String(m)];
    if (f && f.predictedPrice > 0) {
      points.push({
        label: `${m}m`,
        minutes: m,
        price: f.predictedPrice,
        isForecast: true
      });
    }
  });

  if (points.length <= 1) {
    return (
      <div className="bg-gray-800/80 border border-gray-700/70 rounded-xl p-5 text-center text-gray-500 font-mono text-sm">
        Insufficient forecast points to render trajectory.
      </div>
    );
  }

  // Calculate scaling for SVG
  const prices = points.map((p) => p.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const padding = (maxPrice - minPrice) * 0.15 || minPrice * 0.005;
  const domainMin = minPrice - padding;
  const domainMax = maxPrice + padding;
  const priceRange = domainMax - domainMin || 1;

  const width = 600;
  const height = 220;
  const padLeft = 60;
  const padRight = 40;
  const padTop = 30;
  const padBottom = 40;
  const chartWidth = width - padLeft - padRight;
  const chartHeight = height - padTop - padBottom;

  const getX = (index: number) => padLeft + (index / (points.length - 1)) * chartWidth;
  const getY = (price: number) => padTop + chartHeight - ((price - domainMin) / priceRange) * chartHeight;

  // Generate SVG path coordinates
  const pathD = points
    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(idx).toFixed(1)} ${getY(p.price).toFixed(1)}`)
    .join(' ');

  const lastPrice = points[points.length - 1].price;
  const isOverallUp = lastPrice >= currentPrice;
  const strokeColor = isOverallUp ? '#38bdf8' : '#f87171'; // sky-400 or red-400

  return (
    <div className="bg-gray-800/80 backdrop-blur border border-gray-700/70 rounded-xl p-5 sm:p-6 shadow-lg">
      <div className="flex items-center justify-between border-b border-gray-700/60 pb-3 mb-4">
        <div>
          <h3 className="text-sm font-semibold tracking-wider text-gray-300 uppercase">
            Forecast Trajectory
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">Plotting actual model predictions over horizon intervals</p>
        </div>
        <div className="flex items-center space-x-4 text-xs font-mono">
          <span className="flex items-center text-gray-300">
            <span className="w-2.5 h-2.5 rounded-full bg-white mr-1.5 ring-2 ring-gray-600"></span>
            Current
          </span>
          <span className="flex items-center text-sky-400">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-400 mr-1.5"></span>
            Forecast
          </span>
        </div>
      </div>

      <div className="w-full overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto min-w-[340px] select-none">
          {/* Horizontal Grid lines */}
          <line
            x1={padLeft}
            y1={getY(currentPrice)}
            x2={width - padRight}
            y2={getY(currentPrice)}
            stroke="#475569"
            strokeDasharray="3 3"
            strokeWidth="1"
          />
          <text
            x={padLeft - 8}
            y={getY(currentPrice) + 4}
            textAnchor="end"
            fontSize="10"
            fill="#94a3b8"
            fontFamily="monospace"
          >
            ₹{currentPrice.toFixed(1)}
          </text>

          {/* Forecast Path */}
          <path
            d={pathD}
            fill="none"
            stroke={strokeColor}
            strokeWidth="2.5"
            strokeDasharray="4 4"
          />

          {/* Points */}
          {points.map((p, idx) => {
            const cx = getX(idx);
            const cy = getY(p.price);

            return (
              <g key={p.label}>
                {/* Vertical helper tick */}
                <line
                  x1={cx}
                  y1={cy}
                  x2={cx}
                  y2={height - padBottom + 10}
                  stroke="#334155"
                  strokeWidth="1"
                  strokeDasharray="2 2"
                />

                {/* Point marker */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={p.isForecast ? 4 : 5.5}
                  fill={p.isForecast ? strokeColor : '#ffffff'}
                  stroke={p.isForecast ? '#0f172a' : strokeColor}
                  strokeWidth="2"
                />

                {/* Price text on hover/top */}
                <text
                  x={cx}
                  y={cy - 10}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="bold"
                  fill="#e2e8f0"
                  fontFamily="monospace"
                >
                  ₹{p.price.toFixed(1)}
                </text>

                {/* Horizon bottom label */}
                <text
                  x={cx}
                  y={height - padBottom + 24}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight={p.isForecast ? '500' : 'bold'}
                  fill={p.isForecast ? '#94a3b8' : '#ffffff'}
                  fontFamily="monospace"
                >
                  {p.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};

export default ForecastChart;
