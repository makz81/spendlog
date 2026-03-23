/**
 * Utility Function Tests
 * Tests for format and date utilities
 */
import { describe, it, expect } from 'vitest';
import {
  formatCurrency,
  formatNumber,
  formatPercentage,
} from '../src/utils/format.js';
import {
  formatDate,
  formatDateISO,
  parseDate,
  getMonthName,
  getQuarterName,
  getYearName,
  getPeriodRange,
} from '../src/utils/date.js';

describe('Format Utilities', () => {
  describe('formatCurrency', () => {
    it('formats positive amounts in EUR', () => {
      const result = formatCurrency(1234.56);
      // German locale: 1.234,56 €
      expect(result).toContain('1.234,56');
      expect(result).toContain('€');
    });

    it('formats zero', () => {
      const result = formatCurrency(0);
      expect(result).toContain('0,00');
      expect(result).toContain('€');
    });

    it('formats negative amounts', () => {
      const result = formatCurrency(-500);
      expect(result).toContain('500,00');
      expect(result).toContain('€');
    });

    it('formats small amounts', () => {
      const result = formatCurrency(0.99);
      expect(result).toContain('0,99');
    });

    it('formats large amounts with thousand separators', () => {
      const result = formatCurrency(1000000);
      expect(result).toContain('1.000.000,00');
    });
  });

  describe('formatNumber', () => {
    it('formats with 2 decimal places by default', () => {
      const result = formatNumber(1234.5);
      expect(result).toBe('1.234,50');
    });

    it('formats with custom decimal places', () => {
      const result = formatNumber(1234.5678, 3);
      expect(result).toBe('1.234,568');
    });

    it('formats integers with decimals', () => {
      const result = formatNumber(100);
      expect(result).toBe('100,00');
    });
  });

  describe('formatPercentage', () => {
    it('formats percentage values', () => {
      const result = formatPercentage(50);
      expect(result).toBe('50,0\u00A0%'); // Non-breaking space in German locale
    });

    it('formats decimal percentages', () => {
      const result = formatPercentage(33.33);
      expect(result).toBe('33,3\u00A0%');
    });

    it('formats zero percent', () => {
      const result = formatPercentage(0);
      expect(result).toBe('0,0\u00A0%');
    });

    it('formats 100 percent', () => {
      const result = formatPercentage(100);
      expect(result).toBe('100,0\u00A0%');
    });
  });
});

describe('Date Utilities', () => {
  describe('formatDate', () => {
    it('formats date in German format (dd.MM.yyyy)', () => {
      const date = new Date(2026, 0, 15); // Jan 15, 2026
      const result = formatDate(date);
      expect(result).toBe('15.01.2026');
    });

    it('formats month with leading zero', () => {
      const date = new Date(2026, 5, 5); // Jun 5, 2026
      const result = formatDate(date);
      expect(result).toBe('05.06.2026');
    });
  });

  describe('formatDateISO', () => {
    it('formats date in ISO format (yyyy-MM-dd)', () => {
      const date = new Date(2026, 0, 15);
      const result = formatDateISO(date);
      expect(result).toBe('2026-01-15');
    });
  });

  describe('parseDate', () => {
    it('parses ISO date string', () => {
      const result = parseDate('2026-01-15');
      expect(result.getFullYear()).toBe(2026);
      expect(result.getMonth()).toBe(0); // January = 0
      expect(result.getDate()).toBe(15);
    });

    it('parses end of year', () => {
      const result = parseDate('2026-12-31');
      expect(result.getFullYear()).toBe(2026);
      expect(result.getMonth()).toBe(11); // December = 11
      expect(result.getDate()).toBe(31);
    });
  });

  describe('getMonthName', () => {
    it('returns German month name', () => {
      const date = new Date(2026, 0, 15); // January
      const result = getMonthName(date);
      expect(result).toBe('Januar 2026');
    });

    it('returns correct name for December', () => {
      const date = new Date(2026, 11, 1); // December
      const result = getMonthName(date);
      expect(result).toBe('Dezember 2026');
    });
  });

  describe('getQuarterName', () => {
    it('returns Q1 for January-March', () => {
      expect(getQuarterName(new Date(2026, 0, 1))).toBe('Q1 2026');
      expect(getQuarterName(new Date(2026, 1, 15))).toBe('Q1 2026');
      expect(getQuarterName(new Date(2026, 2, 31))).toBe('Q1 2026');
    });

    it('returns Q2 for April-June', () => {
      expect(getQuarterName(new Date(2026, 3, 1))).toBe('Q2 2026');
      expect(getQuarterName(new Date(2026, 5, 30))).toBe('Q2 2026');
    });

    it('returns Q3 for July-September', () => {
      expect(getQuarterName(new Date(2026, 6, 1))).toBe('Q3 2026');
      expect(getQuarterName(new Date(2026, 8, 30))).toBe('Q3 2026');
    });

    it('returns Q4 for October-December', () => {
      expect(getQuarterName(new Date(2026, 9, 1))).toBe('Q4 2026');
      expect(getQuarterName(new Date(2026, 11, 31))).toBe('Q4 2026');
    });
  });

  describe('getYearName', () => {
    it('returns year as string', () => {
      const date = new Date(2026, 5, 15);
      expect(getYearName(date)).toBe('2026');
    });
  });

  describe('getPeriodRange', () => {
    describe('month period', () => {
      it('returns correct range for current month', () => {
        const result = getPeriodRange('month', '2026-01-15');
        expect(formatDateISO(result.start)).toBe('2026-01-01');
        expect(formatDateISO(result.end)).toBe('2026-01-31');
        expect(result.label).toBe('Januar 2026');
      });

      it('handles February correctly', () => {
        const result = getPeriodRange('month', '2026-02-15');
        expect(formatDateISO(result.start)).toBe('2026-02-01');
        expect(formatDateISO(result.end)).toBe('2026-02-28');
      });

      it('handles leap year February', () => {
        const result = getPeriodRange('month', '2024-02-15');
        expect(formatDateISO(result.start)).toBe('2024-02-01');
        expect(formatDateISO(result.end)).toBe('2024-02-29');
      });
    });

    describe('quarter period', () => {
      it('returns correct range for Q1', () => {
        const result = getPeriodRange('quarter', '2026-02-15');
        expect(formatDateISO(result.start)).toBe('2026-01-01');
        expect(formatDateISO(result.end)).toBe('2026-03-31');
        expect(result.label).toBe('Q1 2026');
      });

      it('returns correct range for Q4', () => {
        const result = getPeriodRange('quarter', '2026-11-15');
        expect(formatDateISO(result.start)).toBe('2026-10-01');
        expect(formatDateISO(result.end)).toBe('2026-12-31');
        expect(result.label).toBe('Q4 2026');
      });
    });

    describe('year period', () => {
      it('returns correct range for year', () => {
        const result = getPeriodRange('year', '2026-06-15');
        expect(formatDateISO(result.start)).toBe('2026-01-01');
        expect(formatDateISO(result.end)).toBe('2026-12-31');
        expect(result.label).toBe('2026');
      });
    });

    describe('all period', () => {
      it('returns "Gesamt" as label', () => {
        const result = getPeriodRange('all', '2026-01-15');
        expect(result.label).toBe('Gesamt');
      });

      it('starts from epoch (all time)', () => {
        const result = getPeriodRange('all', '2026-06-15');
        expect(formatDateISO(result.start)).toBe('1970-01-01');
      });
    });
  });
});
