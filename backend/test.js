import yahooFinance from 'yahoo-finance2';
yahooFinance.quote('TCS.NS').then(q => console.log('PRICE:', q.regularMarketPrice)).catch(console.error);
