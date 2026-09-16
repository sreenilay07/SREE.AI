# Sree AI - Indian Stock Market Intelligence & AI Analysis Platform

## Overview
Sree AI is a professional, high-performance stock market analysis platform engineered for Indian equity markets (NSE & BSE). Powered by the **Upstox Developer API** for real-time market data and **Groq AI** for deep financial reasoning and multi-layer stock intelligence.

The market-data layer operates on an **instrument-key based architecture** (e.g., `NSE_EQ|INE002A01018`), providing authoritative live quotes, 5-year daily historical candle data, intraday OHLCV candles (375 minute bars per session), mathematical technical indicator calculations (RSI, MACD, Moving Averages, Pivot Points), and optimized batch quote fetching.

## Primary Architecture

```
Frontend (React + TypeScript + Lightweight Charts)
       ↓
SREE.AI Express Backend
       ↓
Mathematical Technical Indicator Engine (Node.js) + MarketDataService Abstraction
       ↓
Upstox Developer API (Real Market Truth) + Groq AI (Reasoning & Interpretation)
```

- **Market Data Provider**: Upstox Developer API (V3 / V2).
- **Technical Analysis Engine**: Built-in mathematical calculation of RSI, SMA (20, 50, 200), EMA (12, 26, 9), MACD, and Pivot Levels from Upstox candle data.
- **AI Intelligence Engine**: Groq AI (`llama-3.3-70b-versatile`) for deep reasoning and narrative interpretation.
- **Data Integrity**: Zero synthetic metric fabrication, zero fake candle generators. Fundamental metrics not provided by Upstox market APIs evaluate strictly to `null` or `"N/A"`.

## Key Features

- **Upstox Instrument Resolution Layer**: Converts stock symbols (`RELIANCE`, `TCS`, `INFY`, `HDFCBANK.BO`) into precise Upstox instrument keys (`NSE_EQ|...`, `BSE_EQ|...`) with in-memory master caching.
- **Batch Quote Optimization**: Uses Upstox batch market quote endpoints to fetch live quotes for portfolio views, sector peers, stock comparisons, and screeners.
- **Real Historical & Intraday Charts**: Backed by Upstox historical candles (1-minute, 15-minute, daily) with strict IST timezone formatting and 375 minute bars per full trading session.
- **Mathematical Technical Analysis**: Computes real RSI, MACD, 50/200 SMA, and Pivot Points before passing context to Groq AI.
- **Dynamic Score & Confidence Engine**: Calculates overall scores and confidence levels from active signal agreement across indicators.
- **Strict Verdict Enforcer**: Restricts verdicts strictly to `BUY`, `HOLD`, or `SELL`.

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and supply your credentials:

```env
PORT=5000
UPSTOX_ACCESS_TOKEN=your_upstox_access_token_here
GROQ_API_KEY=your_groq_api_key_here
```

> [!IMPORTANT]
> `UPSTOX_ACCESS_TOKEN` and `GROQ_API_KEY` are kept strictly on the backend server and are never exposed to the frontend React bundle.

## Quick Start

### 1. Backend Setup
```bash
cd backend
npm install
npm run dev
```
*The backend runs on `http://localhost:5000`.*

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
*The frontend runs on `http://localhost:3000` (or `http://localhost:5173`).*

## Security & Reliability
- **Credential Protection**: All API keys reside server-side in `backend/.env`.
- **Request Deduplication & Caching**: Live quotes are cached for 5 seconds and historical candles for 5 minutes to prevent unnecessary Upstox rate limits.
- **Graceful Failovers**: Fallback handling for network errors, invalid instrument keys, or expired access tokens.
