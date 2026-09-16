import React from 'react';
import { useParams } from 'react-router-dom';
import StockHeader from '../components/stock/StockHeader';
import VerdictCard from '../components/stock/VerdictCard';
import SuggestionPortal from '../components/stock/SuggestionPortal';
import TabbedContent from '../components/stock/TabbedContent';
import SummaryScoreTab from '../components/stock/tabs/SummaryScoreTab';
import FundamentalsTab from '../components/stock/tabs/FundamentalsTab';
import NewsTab from '../components/stock/tabs/NewsTab';
import LoadingSpinner from '../components/common/LoadingSpinner';
import DisclaimerBanner from '../components/common/DisclaimerBanner';
import SectorComparison from '../components/stock/SectorComparison';
import SectorOutlook from '../components/stock/SectorOutlook';
import { TabKey } from '../types';
import useStockAnalysis from '../hooks/useStockAnalysis';
import LivePriceChartContainer from '../components/stock/LivePriceChartContainer';
import Chatbot from '../components/chatbot/Chatbot';

const StockDashboardPage: React.FC = () => {
  const { symbol } = useParams<{ symbol: string }>();
  const { stockBasicData, aiAnalysis, stockFundamentalData, corporateAnnouncements, sectorPeers, isLoading, error } = useStockAnalysis(symbol || '');

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)]">
        <LoadingSpinner />
        <p className="mt-4 text-lg text-gray-300">Analyzing {symbol}... Please wait.</p>
      </div>
    );
  }

  if (error) {
    const isTokenError = error.toLowerCase().includes('token') || error.toLowerCase().includes('upstox') || error.toLowerCase().includes('unavailable');
    return (
      <div className="max-w-4xl mx-auto my-12 p-6 bg-amber-950/40 border border-amber-500/50 rounded-xl shadow-2xl text-center">
        <div className="flex justify-center mb-3 text-amber-400">
          <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-amber-300 mb-2">Live Market Data Temporarily Unavailable</h2>
        <p className="text-gray-200 mb-4 max-w-xl mx-auto">{error}</p>
        <div className="flex justify-center gap-4 mt-6">
          {isTokenError && (
            <a
              href="http://localhost:5000/api/auth/upstox/login"
              target="_blank"
              rel="noreferrer"
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-gray-950 font-semibold rounded-lg shadow transition-colors"
            >
              Re-authenticate Upstox Token
            </a>
          )}
          <button
            onClick={() => window.location.reload()}
            className="px-5 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-200 font-medium rounded-lg border border-gray-600 transition-colors"
          >
            Retry Analysis
          </button>
        </div>
      </div>
    );
  }

  if (!stockBasicData || !aiAnalysis) {
    return <div className="text-center py-10 text-xl text-gray-400">Stock data not found for {symbol}.</div>;
  }

  return (
    <div className="max-w-7xl mx-auto">
      <StockHeader stock={stockBasicData} />

      <div className="mt-8">
        <LivePriceChartContainer stockData={stockBasicData} analysis={aiAnalysis} />
      </div>
      
      <div className="bg-gray-850 shadow-2xl rounded-xl p-4 sm:p-6 lg:p-8 border border-gray-700 mt-8">
        <VerdictCard analysis={aiAnalysis} />
        <SuggestionPortal suggestions={aiAnalysis.suggestionPortal} />
      </div>

      <div className="mt-8">
        <SectorOutlook outlook={aiAnalysis.sectorOutlook} sectorName={stockBasicData.sector} />
      </div>

      {sectorPeers.length > 0 && (
        <div className="mt-8">
          <SectorComparison currentStock={stockBasicData} peers={sectorPeers} />
        </div>
      )}

      <div className="mt-8">
        <h2 className="text-2xl font-semibold text-gray-100 mb-1 text-center">All the Details of {stockBasicData.name}</h2>
        <p className="text-sm text-gray-400 mb-6 text-center">Explore the data that powers SreeAI's insights.</p>
        <TabbedContent>
          {(activeTab: TabKey) => (
            <div className="bg-gray-850 shadow-xl rounded-xl p-4 sm:p-6 lg:p-8 border border-gray-700 min-h-[400px]">
              {activeTab === TabKey.SUMMARY && <SummaryScoreTab stockData={stockBasicData} analysis={aiAnalysis} />}
              {activeTab === TabKey.FUNDAMENTALS && <FundamentalsTab data={stockFundamentalData} />}
              {activeTab === TabKey.NEWS && <NewsTab newsItems={aiAnalysis.newsAnalysis} announcements={corporateAnnouncements} />}
            </div>
          )}
        </TabbedContent>
      </div>
      <DisclaimerBanner />
      <Chatbot stockData={stockBasicData} />
    </div>
  );
};

export default StockDashboardPage;