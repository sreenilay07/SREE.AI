
import React from 'react';
import { Link } from 'react-router-dom';
import { StockBasicData } from '../../types';

interface ScreenerResultsTableProps {
  stocks: StockBasicData[];
}

const ScreenerResultsTable: React.FC<ScreenerResultsTableProps> = ({ stocks }) => {
  if (stocks.length === 0) {
    return (
      <div className="text-center p-8 text-gray-400 bg-gray-800/50 rounded-lg">
        No stocks found matching your criteria. Please try a different query.
      </div>
    );
  }

  const getChangeColor = (value: number) => (value >= 0 ? 'text-green-400' : 'text-red-400');

  return (
    <div className="bg-gray-800 rounded-lg shadow-xl border border-gray-700 overflow-x-auto">
      <table className="w-full min-w-[800px] text-sm">
        <thead>
          <tr className="border-b border-gray-700 text-xs text-gray-400 uppercase text-left">
            <th className="py-3 px-4 font-medium">Stock Name</th>
            <th className="py-3 px-4 font-medium text-right">Price (₹)</th>
            <th className="py-3 px-4 font-medium text-right">% Change</th>
            <th className="py-3 px-4 font-medium text-right">Market Cap</th>
            <th className="py-3 px-4 font-medium text-right">P/E Ratio</th>
            <th className="py-3 px-4 font-medium text-right">Promoter Holding (%)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-700">
          {stocks.map(stock => (
            <tr key={stock.symbol} className="transition-colors hover:bg-gray-750">
              <td className="py-3 px-4 font-medium">
                <Link to={`/stock/${stock.symbol}`} className="text-sky-400 hover:text-sky-300 hover:underline">
                  <div className="flex items-center gap-2">
                    <span>{stock.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${stock.exchange === 'BSE' ? 'bg-amber-950/60 text-amber-400 border border-amber-800/60' : 'bg-sky-950/60 text-sky-400 border border-sky-800/60'}`}>
                      {stock.exchange}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                    <span>{stock.symbol}</span>
                    <span>•</span>
                    <span className="text-gray-400 bg-gray-700/50 px-1.5 py-0.5 rounded text-[11px] font-medium">{stock.sector || 'General'}</span>
                  </div>
                </Link>
              </td>
              <td className="py-3 px-4 text-right font-mono text-gray-200">{(stock.currentPrice || 0).toFixed(2)}</td>
              <td className={`py-3 px-4 text-right font-mono font-semibold ${getChangeColor(stock.changePercent || 0)}`}>
                {(stock.changePercent || 0).toFixed(2)}%
              </td>
              <td className="py-3 px-4 text-right font-mono text-gray-200">{stock.marketCap}</td>
              <td className="py-3 px-4 text-right font-mono text-gray-200">{stock.peRatio !== undefined && stock.peRatio > 0 ? stock.peRatio.toFixed(2) : 'N/A'}</td>
              <td className="py-3 px-4 text-right font-mono text-gray-200">{stock.promoterHolding !== undefined && stock.promoterHolding > 0 ? stock.promoterHolding.toFixed(2) + '%' : 'N/A'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ScreenerResultsTable;
