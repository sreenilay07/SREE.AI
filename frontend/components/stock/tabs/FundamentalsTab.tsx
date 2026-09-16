
import React from 'react';
import { StockFundamentalData, RatioMetricDetail } from '../../../types';
import ExplainTerm from '../../common/ExplainTerm';
import SimpleBarChart from '../../charts/SimpleBarChart';
import SimplePieChart from '../../charts/SimplePieChart';

interface FundamentalsTabProps {
  data: StockFundamentalData | null;
}

const RatioDisplay: React.FC<{ 
  label: string; 
  value?: number | null | string; 
  metricDetail?: RatioMetricDetail | null;
  unit?: string; 
  term: string; 
  higherIsBetter?: boolean; 
  lowerIsBetter?: boolean 
}> = ({ label, value, metricDetail, unit = '', term, higherIsBetter, lowerIsBetter }) => {
  let valueColor = 'text-gray-100';
  let formattedDisplay = 'Not disclosed';

  const rawVal = metricDetail?.company_value ?? value;
  const numVal = metricDetail?.numCompany ?? (typeof value === 'number' ? value : parseFloat(String(value || '')));

  if (typeof numVal === 'number' && !isNaN(numVal)) {
    if (higherIsBetter && numVal > 0) valueColor = 'text-green-400';
    if (lowerIsBetter && numVal < 1) valueColor = 'text-green-400';
    if (higherIsBetter && numVal < 0) valueColor = 'text-red-400';
    if (lowerIsBetter && numVal > 2) valueColor = 'text-red-400';

    if (rawVal !== null && rawVal !== undefined) {
      formattedDisplay = String(rawVal).includes('%') || unit === '' ? `${rawVal}` : `${rawVal}${unit}`;
    } else {
      formattedDisplay = `${numVal.toFixed(2)}${unit}`;
    }
  } else if (typeof rawVal === 'string' && rawVal.trim() !== '') {
    formattedDisplay = `${rawVal}${unit}`;
  }

  const sectorAvg = metricDetail?.sector_value;

  return (
    <div className="flex justify-between items-center py-2.5 border-b border-gray-700">
      <div className="flex flex-col">
        <div className="flex items-center">
          <span className="text-sm font-medium text-gray-300">{label}</span>
          <ExplainTerm term={term} />
        </div>
        {sectorAvg && (
          <span className="text-xs text-gray-400 mt-0.5">
            Sector avg: <span className="font-semibold text-sky-400">{sectorAvg}</span>
          </span>
        )}
      </div>
      <span className={`text-sm font-semibold ${valueColor}`}>{formattedDisplay}</span>
    </div>
  );
};

const FundamentalsTab: React.FC<FundamentalsTabProps> = ({ data }) => {
  if (!data) {
    return (
      <div className="text-center p-8 bg-gray-800 rounded-lg border border-gray-700">
        <p className="text-amber-400 font-semibold text-lg mb-2">Temporarily Unavailable</p>
        <p className="text-gray-400 text-sm">Fundamental data could not be retrieved from the market data service.</p>
      </div>
    );
  }

  if (data.isAvailable === false) {
    return (
      <div className="text-center p-8 bg-gray-800 rounded-lg border border-gray-700">
        <p className="text-gray-400 font-semibold text-lg mb-2">Fundamental Data Not Disclosed</p>
        <p className="text-gray-500 text-sm">
          {data.reason === 'ISIN_NOT_FOUND' 
            ? 'This security is not mapped to an ISIN required for fundamental reporting.' 
            : 'Upstox Company Fundamentals API returned no records for this security.'}
        </p>
      </div>
    );
  }

  const financialChartData = (data.financialHealth || []).map(fh => ({
    name: fh.period,
    Revenue: fh.revenue || 0,
    NetProfit: fh.netProfit || 0,
    EPS: fh.eps || 0,
  }));

  const hasFinancialHealth = financialChartData.some(d => d.Revenue > 0 || d.NetProfit > 0);
  const hasEPS = financialChartData.some(d => typeof d.EPS === 'number' && d.EPS > 0);

  const shareholdingChartData = [
    { name: 'Promoter', value: data?.shareholdingPattern?.promoter || 0 },
    { name: 'FII', value: data?.shareholdingPattern?.fii || 0 },
    { name: 'DII', value: data?.shareholdingPattern?.dii || 0 },
    { name: 'Public', value: data?.shareholdingPattern?.public || 0 },
  ];

  const formatPct = (val?: number | null) => (typeof val === 'number' && val >= 0 ? `${val.toFixed(2)}%` : 'Not disclosed');
  const promoterPledgeHigh = ((data?.shareholdingPattern?.pledgedPromoter) || 0) > 15;

  return (
    <div className="space-y-8">
      {/* Upstox Live Verification Badge */}
      <div className="flex items-center justify-between text-xs text-gray-400 bg-gray-900/60 px-4 py-2 rounded border border-gray-800">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          Source: Upstox Live Company Fundamentals API
        </span>
        <span>24h Cached</span>
      </div>

      <section className="bg-gray-800 p-6 rounded-lg shadow-xl border border-gray-700">
        <h4 className="text-xl font-semibold text-sky-400 mb-4">Financial Health (Figures in Cr{hasEPS ? ', EPS in ₹' : ''})</h4>
        {hasFinancialHealth ? (
          <div className={`grid md:grid-cols-1 ${hasEPS ? 'lg:grid-cols-3' : 'lg:grid-cols-2'} gap-6 text-xs`}>
            <SimpleBarChart data={financialChartData.map(d => ({ name: d.name, value: d.Revenue }))} dataKey="value" title="Revenue (Cr)" barColor="#38bdf8" />
            <SimpleBarChart data={financialChartData.map(d => ({ name: d.name, value: d.NetProfit }))} dataKey="value" title="Net Profit (Cr)" barColor="#34d399" />
            {hasEPS && (
              <SimpleBarChart data={financialChartData.map(d => ({ name: d.name, value: d.EPS }))} dataKey="value" title="EPS (₹)" barColor="#facc15" />
            )}
          </div>
        ) : (
          <p className="text-gray-400 text-sm">Financial health statement data is not disclosed for this security.</p>
        )}
      </section>

      <section className="bg-gray-800 p-6 rounded-lg shadow-xl border border-gray-700">
        <h4 className="text-xl font-semibold text-sky-400 mb-4">Key Ratios & Sector Benchmarks</h4>
        <div className="grid md:grid-cols-2 gap-x-8 gap-y-2">
          <RatioDisplay label="P/E Ratio" value={data.keyRatios?.pe} metricDetail={data.metrics?.pe} term="P/E Ratio" lowerIsBetter />
          <RatioDisplay label="P/B Ratio" value={data.keyRatios?.pb} metricDetail={data.metrics?.pb} term="P/B Ratio" lowerIsBetter />
          <RatioDisplay label="Debt-to-Equity" value={data.keyRatios?.debtToEquity} metricDetail={data.metrics?.debtToEquity} term="Debt-to-Equity Ratio" lowerIsBetter />
          <RatioDisplay label="Return on Equity (RoE)" value={data.keyRatios?.roe} metricDetail={data.metrics?.roe} unit="%" term="Return on Equity (RoE)" higherIsBetter />
          <RatioDisplay label="Dividend Yield" value={data.keyRatios?.dividendYield} metricDetail={data.metrics?.dividendYield} unit="%" term="Dividend Yield" higherIsBetter />
          {data.metrics?.roa && (
            <RatioDisplay label="Return on Assets (RoA)" metricDetail={data.metrics.roa} term="Return on Assets (RoA)" higherIsBetter />
          )}
          {data.metrics?.roce && (
            <RatioDisplay label="ROCE" metricDetail={data.metrics.roce} term="Return on Capital Employed" higherIsBetter />
          )}
          {data.metrics?.evEbitda && (
            <RatioDisplay label="EV / EBITDA" metricDetail={data.metrics.evEbitda} term="Enterprise Value to EBITDA" lowerIsBetter />
          )}
        </div>
      </section>

      <section className="bg-gray-800 p-6 rounded-lg shadow-xl border border-gray-700">
        <h4 className="text-xl font-semibold text-sky-400 mb-4">
          Shareholding Pattern (%) {data.shareholdingPeriod ? `(${data.shareholdingPeriod})` : ''}
        </h4>
        <div className="grid md:grid-cols-1 lg:grid-cols-2 gap-6 items-center">
          <div>
            {shareholdingChartData.some(d => d.value > 0) ? (
              <SimplePieChart data={shareholdingChartData} />
            ) : (
              <p className="text-gray-400 text-sm">Shareholding pattern chart is not disclosed for this security.</p>
            )}
          </div>
          <div className="text-sm space-y-1">
            <p className="text-gray-300"><span className="font-semibold">Promoter:</span> {formatPct(data?.shareholdingPattern?.promoter)}</p>
            <p className="text-gray-300"><span className="font-semibold">FII:</span> {formatPct(data?.shareholdingPattern?.fii)}</p>
            <p className="text-gray-300"><span className="font-semibold">DII:</span> {formatPct(data?.shareholdingPattern?.dii)}</p>
            <p className="text-gray-300"><span className="font-semibold">Public & Others:</span> {formatPct(data?.shareholdingPattern?.public)}</p>
            {data?.shareholdingPattern?.pledgedPromoter !== undefined && data?.shareholdingPattern?.pledgedPromoter !== null && (
              <p className={`mt-3 p-2 rounded ${promoterPledgeHigh ? 'bg-red-500/30 text-red-300' : 'bg-green-500/20 text-green-300'}`}>
                <span className="font-semibold">Promoter Pledged:</span> {formatPct(data.shareholdingPattern.pledgedPromoter)}
                <ExplainTerm term="Promoter Pledged Percentage" className="ml-1" />
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default FundamentalsTab;
