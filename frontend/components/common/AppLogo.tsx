import React from 'react';

interface AppLogoProps {
  className?: string;
}

const AppLogo: React.FC<AppLogoProps> = ({ className = 'w-10 h-10' }) => (
  <img
    src="/sree-ai-logo.png"
    alt="SREE.AI Logo"
    className={`${className} object-contain rounded-xl`}
  />
);

export default AppLogo;
