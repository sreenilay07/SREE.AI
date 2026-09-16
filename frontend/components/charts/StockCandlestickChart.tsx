import React, { useEffect, useRef, useState, useMemo } from 'react';
import { createChart, ColorType, IChartApi, Time, CandlestickSeries, HistogramSeries } from 'lightweight-charts';
import { CanonicalCandle, ChartInterval } from '../../utils/marketSessionUtils';
import { StockBasicData } from '../../types';

interface StockCandlestickChartProps {
  candles: CanonicalCandle[];
  stockData: StockBasicData;
  interval: ChartInterval;
  sessionDate: string;
  isLive: boolean;
  isLoading?: boolean;
}

const StockCandlestickChart: React.FC<StockCandlestickChartProps> = ({
  candles,
  stockData,
  interval,
  sessionDate,
  isLive,
  isLoading = false
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [hoveredCandle, setHoveredCandle] = useState<CanonicalCandle | null>(null);

  const validCandles = useMemo(() => {
    if (!Array.isArray(candles)) return [];
    return candles.filter(c => c.open > 0 && c.high > 0 && c.low > 0 && c.close > 0);
  }, [candles]);

  useEffect(() => {
    if (!chartContainerRef.current || validCandles.length === 0) return;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#111827' },
        textColor: '#9CA3AF',
      },
      grid: {
        vertLines: { color: '#1F2937' },
        horzLines: { color: '#1F2937' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 360,
      localization: {
        timeFormatter: (time: number) => {
          const date = new Date(time * 1000);
          const timeString = date.toLocaleTimeString('en-IN', {
            timeZone: 'Asia/Kolkata',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          });
          const dateString = date.toLocaleDateString('en-IN', {
            timeZone: 'Asia/Kolkata',
            day: '2-digit',
            month: 'short',
            year: 'numeric'
          });
          return interval === '1D' || interval === '1W' ? dateString : `${dateString} ${timeString}`;
        }
      },
      timeScale: {
        timeVisible: interval === '1D' || interval === '1W',
        secondsVisible: false,
        borderColor: '#374151',
        tickMarkFormatter: (time: number) => {
          const date = new Date(time * 1000);
          if (interval === '1D') {
            return date.toLocaleTimeString('en-IN', {
              timeZone: 'Asia/Kolkata',
              hour: '2-digit',
              minute: '2-digit',
              hour12: false
            });
          }
          return date.toLocaleDateString('en-IN', {
            timeZone: 'Asia/Kolkata',
            day: '2-digit',
            month: 'short'
          });
        }
      },
      rightPriceScale: {
        borderColor: '#374151',
        scaleMargins: {
          top: 0.1,
          bottom: 0.25,
        },
      },
      crosshair: {
        vertLine: {
          color: '#38BDF8',
          width: 1,
          style: 3,
        },
        horzLine: {
          color: '#38BDF8',
          width: 1,
          style: 3,
        },
      },
    });

    chartRef.current = chart;

    const sorted = [...validCandles].sort((a, b) => a.timestamp - b.timestamp);
    const formattedCandles: { time: Time; open: number; high: number; low: number; close: number }[] = [];
    const formattedVolume: { time: Time; value: number; color: string }[] = [];

    let lastTime = 0;
    sorted.forEach(c => {
      let t = Math.floor(c.timestamp / 1000) as Time;
      if (typeof t === 'number' && t <= lastTime) {
        t = (lastTime + 1) as Time;
      }
      if (typeof t === 'number') lastTime = t;

      formattedCandles.push({
        time: t,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      });

      formattedVolume.push({
        time: t,
        value: c.volume || 0,
        color: c.close >= c.open ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)',
      });
    });

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });

    candlestickSeries.setData(formattedCandles);

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: '',
    });

    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });

    volumeSeries.setData(formattedVolume);

    chart.subscribeCrosshairMove(param => {
      if (param.time && param.seriesData.get(candlestickSeries)) {
        const data = param.seriesData.get(candlestickSeries) as any;
        const matchingCandle = sorted.find(c => Math.floor(c.timestamp / 1000) === (param.time as number)) || {
          timestamp: (param.time as number) * 1000,
          datetime: '',
          date: '',
          time: '',
          open: data.open,
          high: data.high,
          low: data.low,
          close: data.close,
          volume: null,
        };
        setHoveredCandle(matchingCandle);
      } else {
        setHoveredCandle(null);
      }
    });

    chart.timeScale().fitContent();

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [validCandles, interval]);

  if (isLoading) {
    return (
      <div className="w-full h-[400px] bg-gray-900 rounded-xl p-6 border border-gray-800 animate-pulse flex flex-col justify-between">
        <div className="flex justify-between items-center">
          <div className="h-6 bg-gray-800 rounded w-1/3"></div>
          <div className="h-6 bg-gray-800 rounded w-1/6"></div>
        </div>
        <div className="w-full h-64 bg-gray-850 rounded-lg"></div>
        <div className="h-4 bg-gray-800 rounded w-1/4 self-center"></div>
      </div>
    );
  }

  if (validCandles.length === 0) {
    return (
      <div className="w-full h-[400px] bg-gray-900 rounded-xl p-8 border border-gray-800 flex flex-col items-center justify-center text-center">
        <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center mb-3 text-sky-400">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
          </svg>
        </div>
        <h5 className="text-lg font-semibold text-gray-200 mb-1">No Candle Data Found</h5>
        <p className="text-xs text-gray-400 max-w-sm">
          Upstox candle data is unavailable for {stockData.symbol} ({interval}). Try selecting another timeframe.
        </p>
      </div>
    );
  }

  const latestCandle = validCandles[validCandles.length - 1];
  const activeCandle = hoveredCandle || latestCandle;
  const isUp = activeCandle.close >= activeCandle.open;
  const candleChange = activeCandle.close - activeCandle.open;
  const candleChangePct = activeCandle.open > 0 ? (candleChange / activeCandle.open) * 100 : 0;

  return (
    <div className="w-full bg-gray-900 rounded-xl border border-gray-800 p-4 shadow-xl space-y-3">
      {/* Session Status & OHLC Metrics Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-800 pb-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-gray-200">{stockData.symbol} ({interval})</span>
          {isLive ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
              LIVE MARKET
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
              PREVIOUS SESSION {sessionDate ? `(${sessionDate})` : ''}
            </span>
          )}
        </div>

        {/* OHLC Readout */}
        <div className="flex items-center gap-4 text-xs font-mono">
          <div><span className="text-gray-500">O:</span> <span className="text-gray-200">₹{activeCandle.open.toFixed(2)}</span></div>
          <div><span className="text-gray-500">H:</span> <span className="text-gray-200">₹{activeCandle.high.toFixed(2)}</span></div>
          <div><span className="text-gray-500">L:</span> <span className="text-gray-200">₹{activeCandle.low.toFixed(2)}</span></div>
          <div><span className="text-gray-500">C:</span> <span className={isUp ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>₹{activeCandle.close.toFixed(2)}</span></div>
          <div>
            <span className={isUp ? 'text-emerald-400' : 'text-rose-400'}>
              {isUp ? '+' : ''}{candleChange.toFixed(2)} ({isUp ? '+' : ''}{candleChangePct.toFixed(2)}%)
            </span>
          </div>
          {activeCandle.volume !== null && activeCandle.volume !== undefined && (
            <div className="hidden sm:block"><span className="text-gray-500">Vol:</span> <span className="text-gray-300">{activeCandle.volume.toLocaleString()}</span></div>
          )}
        </div>
      </div>

      {/* Lightweight Chart Container */}
      <div ref={chartContainerRef} className="w-full h-[360px] rounded-lg overflow-hidden" />
    </div>
  );
};

export default StockCandlestickChart;
