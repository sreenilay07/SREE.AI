import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Label, Brush } from 'recharts';
import { CandleDataPoint, StockBasicData } from '../../types';

interface PriceHistoryChartProps {
  data: CandleDataPoint[];
  stockData: StockBasicData;
}

const CustomTooltip: React.FC<any> = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-gray-800 p-3 border border-gray-600 rounded shadow-lg text-xs sm:text-sm">
        <p className="text-gray-400 mb-1">{`Time: ${label}`}</p>
        <p className="text-sky-300 font-semibold text-lg">₹{payload[0].value.toFixed(2)}</p>
      </div>
    );
  }
  return null;
};

const PriceHistoryChart: React.FC<PriceHistoryChartProps> = ({ data, stockData }) => {
  if (!data || data.length === 0) {
    return (
      <div className="w-full aspect-[9/2] bg-gray-750 rounded-md flex items-center justify-center">
        <p className="text-gray-400">Price history data is currently unavailable.</p>
      </div>
    );
  }

  const lastDataPoint = data[data.length - 1];
  // Use close price for the line
  const minPrice = Math.min(...data.map(p => p.close), stockData.close);
  const maxPrice = Math.max(...data.map(p => p.close), stockData.close);
  const domainPadding = (maxPrice - minPrice) * 0.1;

  const priceColor = lastDataPoint.close >= stockData.close ? "#22c55e" : "#ef4444";
  const gradientId = "priceGradient";

  const isDaily = data[0]?.time.includes('-');

  return (
    <div className="w-full aspect-[9/2]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 30, left: -20, bottom: 25 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={priceColor} stopOpacity={0.4} />
              <stop offset="95%" stopColor={priceColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.1} />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 10, fill: '#9ca3af' }}
            tickFormatter={(timeStr) => {
              if (isDaily) {
                const date = new Date(timeStr);
                if (date.getDate() === 1) {
                  return date.toLocaleDateString('en-US', { month: 'short' });
                }
                return '';
              }
              return timeStr.endsWith(':00') || timeStr.endsWith(':30') ? timeStr : '';
            }}
            interval="preserveStartEnd"
            minTickGap={isDaily ? 1 : 40}
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#9ca3af' }}
            domain={[minPrice - domainPadding, maxPrice + domainPadding]}
            tickFormatter={(price) => `₹${price.toFixed(0)}`}
            orientation="right"
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />

          {/* Previous Close Line */}
          <ReferenceLine y={stockData.close} stroke="#f59e0b" strokeDasharray="3 3">
            <Label value={`Prev Close ${stockData.close.toFixed(2)}`} position="insideTopLeft" fill="#f59e0b" fontSize={10} />
          </ReferenceLine>

          {/* Live Price Line */}
          <ReferenceLine y={lastDataPoint.close} stroke={priceColor} strokeDasharray="4 4">
            <Label
              value={lastDataPoint.close.toFixed(2)}
              position="right"
              fill="white"
              fontSize={12}
              style={{
                backgroundColor: priceColor,
                padding: '2px 6px',
                borderRadius: '4px',
              }}
            />
          </ReferenceLine>

          <Area
            isAnimationActive={false}
            type="monotone"
            dataKey="close"
            stroke={priceColor}
            strokeWidth={2}
            fillOpacity={1}
            fill={`url(#${gradientId})`}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PriceHistoryChart;