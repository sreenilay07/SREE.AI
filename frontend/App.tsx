import React, { useState, useRef } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import HomePage from './pages/HomePage';
import StockDashboardPage from './pages/StockDashboardPage';
import PageLayout from './components/layout/PageLayout';
import ComparePage from './pages/ComparePage';
import ScreenerPage from './pages/ScreenerPage';
import PortfolioPage from './pages/PortfolioPage';
import IntratradePage from './pages/IntratradePage';
import ErrorBoundary from './components/common/ErrorBoundary';
import LoadingAnimation from './components/common/LoadingAnimation';
import { ApplicationMode } from './types/trading';

const App: React.FC = () => {
  const [mode, setMode] = useState<ApplicationMode>('INVESTOR');
  const [showAnimation, setShowAnimation] = useState<boolean>(true);
  const pendingModeRef = useRef<ApplicationMode | null>(null);
  const isTransitioningRef = useRef<boolean>(false);

  // Handle Mode Switch with Intro Animation
  const handleModeChange = (newMode: ApplicationMode) => {
    if (newMode === mode || isTransitioningRef.current) return;
    
    isTransitioningRef.current = true;
    pendingModeRef.current = newMode;
    setShowAnimation(true);
  };

  const handleAnimationComplete = () => {
    if (pendingModeRef.current) {
      setMode(pendingModeRef.current);
      pendingModeRef.current = null;
    }
    setShowAnimation(false);
    isTransitioningRef.current = false;
  };

  return (
    <ErrorBoundary>
      {showAnimation && (
        <LoadingAnimation onComplete={handleAnimationComplete} />
      )}
      <HashRouter>
        <PageLayout mode={mode} onModeChange={handleModeChange}>
          {mode === 'TRADER' ? (
            <IntratradePage />
          ) : (
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/stock/:symbol" element={<StockDashboardPage />} />
              <Route path="/compare" element={<ComparePage />} />
              <Route path="/screener" element={<ScreenerPage />} />
              <Route path="/portfolio" element={<PortfolioPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          )}
        </PageLayout>
      </HashRouter>
    </ErrorBoundary>
  );
};

export default App;