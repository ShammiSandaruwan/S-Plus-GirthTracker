import { describe, it, expect } from 'vitest';
import { 
  parseCaliperBuffer, 
  calculateGirth, 
  validateReading, 
  escCsv, 
  filterDisplayBuffer 
} from './utils';

describe('Caliper Buffer Parsing', () => {
  it('parses standard float values', () => {
    expect(parseCaliperBuffer('1.23')).toBe(1.23);
    expect(parseCaliperBuffer(' 12.34 ')).toBe(12.34);
  });

  it('handles comma as decimal separator', () => {
    expect(parseCaliperBuffer('1,23')).toBe(1.23);
  });

  it('strips non-numeric characters (units, etc.)', () => {
    expect(parseCaliperBuffer('1.23in')).toBe(1.23);
    expect(parseCaliperBuffer('mm1.23')).toBe(1.23);
    expect(parseCaliperBuffer(' 1.23 inch ')).toBe(1.23);
  });

  it('corrects missing decimals for large integers (caliper quirk)', () => {
    // Some calipers send 16385 instead of 1.6385
    expect(parseCaliperBuffer('16385')).toBe(1.6385);
    expect(parseCaliperBuffer('20000')).toBe(2.0000);
  });

  it('returns null for invalid or negative inputs', () => {
    expect(parseCaliperBuffer('')).toBeNull();
    expect(parseCaliperBuffer('abc')).toBeNull();
    expect(parseCaliperBuffer('-1.23')).toBeNull();
    expect(parseCaliperBuffer('0')).toBeNull();
  });
});

describe('Girth Calculation', () => {
  it('calculates girth as diameter * PI, rounded to 2 decimals', () => {
    // 10 * PI = 31.4159... -> 31.42
    expect(calculateGirth(10)).toBe(31.42);
    // 1 * PI = 3.14159... -> 3.14
    expect(calculateGirth(1)).toBe(3.14);
  });
});

describe('Reading Validation', () => {
  it('validates readings within range', () => {
    expect(validateReading(1).valid).toBe(true);
    expect(validateReading(29).valid).toBe(true);
  });

  it('rejects readings below MIN_READING (0.5)', () => {
    const res = validateReading(0.4);
    expect(res.valid).toBe(false);
    expect(res.reason).toMatch(/below minimum/);
  });

  it('rejects readings above MAX_READING (30)', () => {
    const res = validateReading(31);
    expect(res.valid).toBe(false);
    expect(res.reason).toMatch(/exceeds maximum/);
  });

  it('rejects NaN or negative', () => {
    expect(validateReading(NaN).valid).toBe(false);
    expect(validateReading(-5).valid).toBe(false);
  });
});

describe('CSV Escaping', () => {
  it('wraps values in quotes', () => {
    expect(escCsv('hello')).toBe('"hello"');
    expect(escCsv(123)).toBe('"123"');
  });

  it('escapes internal quotes', () => {
    expect(escCsv('hello "world"')).toBe('"hello ""world"""');
  });
});

describe('Display Buffer Filtering', () => {
  it('leaves only numbers and decimals', () => {
    expect(filterDisplayBuffer('1.23in')).toBe('1.23');
    expect(filterDisplayBuffer('1,23')).toBe('123'); // Commas aren't preserved in filter, that's fine since it's just for display
    expect(filterDisplayBuffer('abc')).toBe('');
  });
});
