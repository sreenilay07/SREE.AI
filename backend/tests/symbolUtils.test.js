import { isValidSymbol, normalizeSymbol } from '../utils/symbolUtils.js';

describe('Symbol Utilities', () => {
  test('isValidSymbol validates allowable ticker symbols', () => {
    expect(isValidSymbol('RELIANCE')).toBe(true);
    expect(isValidSymbol('TCS.NS')).toBe(true);
    expect(isValidSymbol('M&M')).toBe(true);
    expect(isValidSymbol('TATAMOTORS-EQ')).toBe(true);
    
    // Invalid symbols
    expect(isValidSymbol('<script>alert(1)</script>')).toBe(false);
    expect(isValidSymbol('TOO_LONG_SYMBOL_NAME_THAT_EXCEEDS_20_CHARS')).toBe(false);
    expect(isValidSymbol('')).toBe(false);
  });

  test('normalizeSymbol parses BSE and NSE symbols', () => {
    expect(normalizeSymbol('RELIANCE')).toEqual({ rawSymbol: 'RELIANCE', cleanSymbol: 'RELIANCE', exchange: 'NSE' });
    expect(normalizeSymbol('TCS.BO')).toEqual({ rawSymbol: 'TCS.BO', cleanSymbol: 'TCS', exchange: 'BSE' });
    expect(normalizeSymbol('INFY.NS')).toEqual({ rawSymbol: 'INFY.NS', cleanSymbol: 'INFY', exchange: 'NSE' });
  });
});
