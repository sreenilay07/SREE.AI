import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { APP_NAME, APP_TAGLINE } from '../../constants';
import TextSelectionExplainer from '../common/TextSelectionExplainer';
import TradingModeToggle from '../trading/TradingModeToggle';
import { ApplicationMode } from '../../types/trading';

interface PageLayoutProps {
  children: React.ReactNode;
  mode: ApplicationMode;
  onModeChange: (mode: ApplicationMode) => void;
}

const PageLayout: React.FC<PageLayoutProps> = ({ children, mode, onModeChange }) => {
  const isTrader = mode === 'TRADER';

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
      isActive
        ? 'bg-gray-700 text-sky-400'
        : 'text-gray-300 hover:bg-gray-700 hover:text-white'
    }`;

  return (
    <div className="min-h-screen flex flex-col bg-gray-900 text-gray-100">
      <TextSelectionExplainer />
      <header className="bg-gray-800 shadow-xl sticky top-0 z-50 border-b border-gray-700/60">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-0">
          {/* Logo & Branding */}
          <div className="flex items-center space-x-4">
            <Link to="/" className="text-sky-400 hover:text-sky-300 transition-colors flex items-center space-x-3 group">
              <img
                src="/sree-ai-logo.png"
                alt="SREE.AI Logo"
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl object-contain shadow-lg border border-sky-500/30 group-hover:border-sky-400 transition-all duration-300"
              />
              <div>
                <div className="flex items-center space-x-2">
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white group-hover:text-sky-300 transition-colors">
                    {APP_NAME}
                  </h1>
                  {isTrader && (
                    <span className="px-2 py-0.5 rounded text-[11px] font-extrabold tracking-wider bg-sky-950 text-sky-400 border border-sky-600/50">
                      INTRATRADE
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400">
                  {isTrader ? 'Real-Time Intraday ML Cockpit' : APP_TAGLINE}
                </p>
              </div>
            </Link>
          </div>

          {/* Mode Toggle & Navigation */}
          <div className="flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:space-x-6">
            {/* Global Application Mode Toggle */}
            <TradingModeToggle mode={mode} onModeChange={onModeChange} />

            {/* Navigation links - STRICTLY hidden in Trader mode */}
            {!isTrader && (
              <nav className="flex items-center space-x-1 sm:space-x-3">
                <NavLink to="/" className={navLinkClass} end>
                  Home
                </NavLink>
                <NavLink to="/compare" className={navLinkClass}>
                  Compare
                </NavLink>
                <NavLink to="/screener" className={navLinkClass}>
                  Screener
                </NavLink>
                <NavLink to="/portfolio" className={navLinkClass}>
                  Portfolio
                </NavLink>
              </nav>
            )}
          </div>
        </div>
      </header>

      <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      <footer className="bg-gray-800 text-gray-400 py-6 text-center shadow-inner-top border-t border-gray-700/60">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <p>&copy; {new Date().getFullYear()} {APP_NAME}. All rights reserved.</p>
          <p className="text-xs mt-1">AI-powered insights for informed investment & trading decisions.</p>
        </div>
      </footer>
    </div>
  );
};

export default PageLayout;
