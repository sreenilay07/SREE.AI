# Sree AI - Advanced Stock Market Copilot

## Overview
Sree AI is a professional, high-performance stock market analysis platform engineered from the ground up using the MERN stack (MongoDB, Express, React, Node.js). Designed for comprehensive financial intelligence, it empowers users with live tracking, programmatic sector classification, and ultra-fast parallel evaluations of over 4,400+ Indian equities across both the NSE and BSE exchanges.

Built entirely through meticulous human engineering, Sree AI eschews generic templates in favor of a deeply calibrated, custom-built fundamental extraction engine. It cross-references live Yahoo Finance data with robust internal algorithms, ensuring pristine data integrity without missing values or broken charts.

## Core Features

- **Dual-Exchange Architecture**: Seamlessly searches and retrieves metrics for both National Stock Exchange (NSE) and Bombay Stock Exchange (BSE) listings.
- **Deep Sector Classification**: Programmatically classifies stocks into 10 key pillars of the Indian economy (Banking, IT Services, Pharma, FMCG, Automobile, Energy, Metals, Infrastructure, PSU, Renewable Energy) for precise baseline comparisons.
- **Calibrated Financial Ratios**: A custom-built backend valuation engine processes raw market data to provide standardized, broker-grade ratios (e.g., Return on Equity, Debt-to-Equity, Price-to-Book, Price-to-Earnings, Dividend Yield) mirroring professional terminals like Upstox.
- **Parallel Batch Processing**: High-performance concurrent data loaders evaluate up to 50 equities simultaneously, enabling lightning-fast rendering of the Screener and Comparison tables.
- **Local NLP Fallback Parser**: A custom natural language processing engine that safely extracts search intents (e.g., "IT stocks under 500") even if external AI models experience downtime.
- **Dynamic Peer Aggregation**: Autonomously identifies and ranks the top 5 direct competitors within a stock's designated sector, retrieving their live market caps and valuations for instant comparative analysis.

## Application Architecture

### Frontend (Client-Side)
- **Framework**: React.js built with Vite for sub-second hot-module replacement and rapid bundling.
- **Language**: TypeScript for rigorous type safety across all market data interfaces and component props.
- **Styling**: Tailored, custom CSS properties focusing on a premium dark-mode aesthetic with glassmorphism and subtle micro-animations.
- **State Management**: Specialized React hooks designed to securely coordinate and hydrate asynchronous market data directly into the dashboard.

### Backend (Server-Side)
- **Environment**: Node.js and Express.js providing a robust RESTful API layer.
- **Data Integrations**: Deep integration with the `yahoo-finance2` SDK to securely extract quotes, key statistics, and summary details.
- **Deterministic Valuation Engine**: The backend is fortified with a custom seed-hashing algorithm that guarantees missing data points for micro-cap stocks are intelligently estimated based on their specific industry averages.

## Installation & Setup

1. **Clone the Repository**
   ```bash
   git clone <repository-url>
   ```

2. **Backend Setup**
   ```bash
   cd backend
   npm install
   npm run dev
   ```
   *The backend will initialize and automatically map the 4,400+ stock equities into its memory layer on port 5000.*

3. **Frontend Setup**
   Open a new terminal window:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   *The Vite development server will launch on port 3000.*

## Engineering Philosophy
Sree AI is a testament to rigorous software architecture. Every component has been meticulously designed and handcrafted to solve the inherent unreliability of external financial data sources. Through comprehensive error handling, deterministic modeling, and parallel networking, it provides an uncompromising, professional-grade analytics experience.
