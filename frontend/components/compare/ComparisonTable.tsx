import React from 'react';
import { ComparisonData } from '../../types';
import LoadingSpinner from '../common/LoadingSpinner';

interface ComparisonTableProps {
  stocksData: (ComparisonData | null)[];
  isLoading: boolean;
}

const ComparisonTable: React.FC<ComparisonTableProps> = ({ stocksData, isLoading }) => {
  if (stocksData.length === 0 && !isLoading) {
    return null;
  }

  const metrics = [
    { key: 'currentPrice', label: 'Last Price', format: (val: any) => typeof val === 'number' && !isNaN(val) ? `₹${val.toFixed(2)}` : 'N/A' },
    { key: 'changePercent', label: '% Change', format: (val: any) => typeof val === 'number' && !isNaN(val) ? `${val.toFixed(2)}%` : '0.00%', higherIsBetter: true },
    { key: 'marketCap', label: 'Market Cap', format: (val: any) => (val && val !== 'N/A' ? String(val) : 'N/A') },
    { key: 'peRatio', label: 'P/E Ratio', format: (val: any) => typeof val === 'number' && !isNaN(val) && val !== 0 ? val.toFixed(2) : (val ? String(val) : 'N/A'), lowerIsBetter: true },
    { key: 'pbRatio', label: 'P/B Ratio', format: (val: any) => typeof val === 'number' && !isNaN(val) && val !== 0 ? val.toFixed(2) : (val ? String(val) : 'N/A'), lowerIsBetter: true },
    { key: 'roe', label: 'RoE (%)', format: (val: any) => typeof val === 'number' && !isNaN(val) ? `${val.toFixed(2)}%` : 'N/A', higherIsBetter: true },
    { key: 'debtToEquity', label: 'Debt to Equity', format: (val: any) => typeof val === 'number' && !isNaN(val) ? val.toFixed(2) : 'N/A', lowerIsBetter: true },
    { key: 'dividendYield', label: 'Dividend Yield (%)', format: (val: any) => typeof val === 'number' && !isNaN(val) ? `${val.toFixed(2)}%` : 'N/A', higherIsBetter: true },
    { key: 'promoterHolding', label: 'Promoter Holding (%)', format: (val: any) => typeof val === 'number' && !isNaN(val) ? `${val.toFixed(2)}%` : 'N/A', higherIsBetter: true },
    { key: 'volume', label: 'Per Day Volume', format: (val: any) => typeof val === 'number' && !isNaN(val) ? val.toLocaleString() : 'N/A', higherIsBetter: true },
  ];

  const findBestValue = (metricKey: string, higherIsBetter?: boolean, lowerIsBetter?: boolean): number | undefined => {
    if (!higherIsBetter && !lowerIsBetter) return undefined;

    const values = stocksData
      .map(data => {
        if (!data) return null;
        if (['roe', 'debtToEquity', 'dividendYield'].includes(metricKey)) {
          const v = data.fundamentals?.keyRatios?.[metricKey as keyof typeof data.fundamentals.keyRatios] ?? (data as any)[metricKey];
          return typeof v === 'number' && !isNaN(v) ? v : null;
        }
        if (metricKey === 'promoterHolding') {
          const v = data.fundamentals?.shareholdingPattern?.promoter ?? data.promoterHolding;
          return typeof v === 'number' && !isNaN(v) ? v : null;
        }
        if (['peRatio', 'pbRatio'].includes(metricKey)) {
          const v = (data as any)[metricKey] ?? (data.fundamentals?.keyRatios as any)?.[metricKey === 'peRatio' ? 'pe' : 'pb'];
          return typeof v === 'number' && !isNaN(v) ? v : null;
        }
        const v = (data as any)[metricKey];
        return typeof v === 'number' && !isNaN(v) ? v : null;
      })
      .filter(v => typeof v === 'number' && !isNaN(v));

    if (values.length < 2) return undefined;

    return higherIsBetter ? Math.max(...values as number[]) : Math.min(...values as number[]);
  };

  const getChangeColor = (value: number) => (value >= 0 ? 'text-green-400' : 'text-red-400');

  return (
    <div className="mt-8 bg-gray-800 rounded-lg shadow-xl border border-gray-700 overflow-x-auto">
      <table className="w-full min-w-[800px] divide-y divide-gray-700">
        <thead className="bg-gray-750">
          <tr>
            <th scope="col" className="sticky left-0 bg-gray-750 px-4 py-3 text-left text-xs font-medium text-sky-400 uppercase tracking-wider z-10">
              Metric
            </th>
            {stocksData.map((data) => (
              <th key={data?.symbol || Math.random()} scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-200 uppercase tracking-wider">
                {data ? `${data.name} (${data.symbol})` : 'Loading...'}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-gray-800 divide-y divide-gray-700">
          {isLoading && stocksData.length === 0 ? (
            <tr>
              <td colSpan={5} className="text-center p-8">
                <div className="flex justify-center items-center">
                  <LoadingSpinner />
                  <span className="ml-4 text-gray-300">Fetching comparison data...</span>
                </div>
              </td>
            </tr>
          ) : (
            metrics.map((metric) => {
              const bestValue = findBestValue(metric.key, metric.higherIsBetter, metric.lowerIsBetter);
              return (
                <tr key={metric.key}>
                  <td className="sticky left-0 bg-gray-800 px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-300 z-10">
                    {metric.label}
                  </td>
                  {stocksData.map((data, index) => {
                    if (!data) {
                      return <td key={index} className="px-4 py-3"><div className="w-20 h-4 bg-gray-700 rounded animate-pulse mx-auto"></div></td>;
                    }

                    let value: number | string | undefined;
                    if (['roe', 'debtToEquity', 'dividendYield'].includes(metric.key)) {
                      value = data.fundamentals?.keyRatios?.[metric.key as keyof typeof data.fundamentals.keyRatios] ?? (data as any)[metric.key];
                    } else if (metric.key === 'promoterHolding') {
                      value = data.fundamentals?.shareholdingPattern?.promoter ?? data.promoterHolding;
                    } else if (['peRatio', 'pbRatio'].includes(metric.key)) {
                      value = (data as any)[metric.key] ?? (data.fundamentals?.keyRatios as any)?.[metric.key === 'peRatio' ? 'pe' : 'pb'];
                    } else {
                      const potentialValue = (data as any)[metric.key];
                      if (typeof potentialValue === 'string' || typeof potentialValue === 'number') {
                        value = potentialValue;
                      }
                    }

                    const colorClass = metric.key === 'changePercent' && typeof value === 'number' ? getChangeColor(value) : 'text-gray-100';
                    const isBest = typeof value === 'number' && value === bestValue;
                    const bestClass = isBest ? 'bg-green-500/10 border-l-2 border-green-500' : '';

                    return (
                      <td key={data.symbol} className={`px-4 py-3 whitespace-nowrap text-sm text-center font-semibold transition-colors ${colorClass} ${bestClass}`}>
                        {data ? (metric.format as (val: any) => string)(value) : ''}
                      </td>
                    );
                  })}
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  );
};

export default ComparisonTable;