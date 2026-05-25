import { YahooFinance } from 'yahoo-finance2';
const yahooFinance = new YahooFinance();
yahooFinance.quote('TCS.NS').then(q => console.log('PRICE:', q.regularMarketPrice)).catch(console.error);
