/**
 * Summary Tool Integration Tests
 *
 * Tests for: get_summary, get_category_breakdown, compare_periods, get_tax_summary
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { tools } from '../helpers/index.js';
import {
  setupTestDb,
  teardownTestDb,
} from '../setup.js';
import {
  today,
  resetFactories,
} from '../fixtures/index.js';

describe('Summary Tools', () => {
  beforeEach(async () => {
    await setupTestDb();
    resetFactories();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  describe('get_summary', () => {
    it('returns empty summary when no transactions', async () => {
      const result = await tools.getSummary();

      expect(result.period).toBeDefined();
      expect(result.income.total).toBe(0);
      expect(result.expenses.total).toBe(0);
      expect(result.transaction_count).toBe(0);
    });

    it('calculates income correctly', async () => {
      await tools.addIncome({ amount: 1000, description: 'Income 1' });
      await tools.addIncome({ amount: 500, description: 'Income 2' });

      const result = await tools.getSummary();

      expect(result.income.total).toBe(1500);
      expect(result.income.count).toBe(2);
      expect(result.income.formatted).toContain('1.500');
    });

    it('calculates expenses correctly', async () => {
      await tools.addExpense({ amount: 200, description: 'Expense 1' });
      await tools.addExpense({ amount: 100, description: 'Expense 2' });

      const result = await tools.getSummary();

      expect(result.expenses.total).toBe(300);
      expect(result.expenses.count).toBe(2);
    });

    it('calculates net profit correctly', async () => {
      await tools.addIncome({ amount: 1000, description: 'Income' });
      await tools.addExpense({ amount: 300, description: 'Expense' });

      const result = await tools.getSummary();

      expect(result.net.total).toBe(700);
      expect(result.net.positive).toBe(true);
    });

    it('handles negative net (loss)', async () => {
      await tools.addIncome({ amount: 100, description: 'Income' });
      await tools.addExpense({ amount: 500, description: 'Expense' });

      const result = await tools.getSummary();

      expect(result.net.total).toBe(-400);
      expect(result.net.positive).toBe(false);
    });

    it('groups income by category', async () => {
      await tools.addIncome({ amount: 1000, description: 'Work', category: 'Dienstleistung' });
      await tools.addIncome({ amount: 500, description: 'Commission', category: 'Affiliate/Provision' });

      const result = await tools.getSummary();

      expect(result.income.by_category['Dienstleistung']).toBeDefined();
      expect(result.income.by_category['Affiliate/Provision']).toBeDefined();
    });

    it('groups expenses by category', async () => {
      await tools.addExpense({ amount: 100, description: 'Software', category: 'IT & Software' });
      await tools.addExpense({ amount: 50, description: 'Ads', category: 'Marketing & Werbung' });

      const result = await tools.getSummary();

      expect(result.expenses.by_category['IT & Software']).toBeDefined();
      expect(result.expenses.by_category['Marketing & Werbung']).toBeDefined();
    });

    it('respects period filter', async () => {
      const result = await tools.getSummary({ period: 'quarter' });

      expect(result.period).toContain('Q');
    });

    it('respects year period', async () => {
      const result = await tools.getSummary({ period: 'year' });

      expect(result.period).toContain('2026');
    });
  });

  describe('get_category_breakdown', () => {
    it('returns empty breakdown when no transactions', async () => {
      const result = await tools.getCategoryBreakdown({ type: 'expense' });

      expect(result.type).toBe('Ausgaben');
      expect(result.categories.length).toBe(0);
    });

    it('breaks down expenses by category', async () => {
      await tools.addExpense({ amount: 100, description: 'Software', category: 'IT & Software' });
      await tools.addExpense({ amount: 50, description: 'Ads', category: 'Marketing & Werbung' });

      const result = await tools.getCategoryBreakdown({ type: 'expense' });

      expect(result.categories.length).toBe(2);
      expect(result.categories.some((c) => c.name === 'IT & Software')).toBe(true);
      expect(result.categories.some((c) => c.name === 'Marketing & Werbung')).toBe(true);
    });

    it('breaks down income by category', async () => {
      await tools.addIncome({ amount: 1000, description: 'Work', category: 'Dienstleistung' });
      await tools.addIncome({ amount: 500, description: 'Commission', category: 'Affiliate/Provision' });

      const result = await tools.getCategoryBreakdown({ type: 'income' });

      expect(result.type).toBe('Einnahmen');
      expect(result.categories.length).toBe(2);
    });

    it('calculates percentages correctly', async () => {
      await tools.addExpense({ amount: 750, description: 'Software', category: 'IT & Software' });
      await tools.addExpense({ amount: 250, description: 'Travel', category: 'Reisen & Transport' });

      const result = await tools.getCategoryBreakdown({ type: 'expense' });

      const itCategory = result.categories.find((c) => c.name === 'IT & Software');
      expect(itCategory?.percentage).toBe(75);
    });

    it('sorts by amount descending', async () => {
      await tools.addExpense({ amount: 100, description: 'Travel', category: 'Reisen & Transport' });
      await tools.addExpense({ amount: 500, description: 'Software', category: 'IT & Software' });
      await tools.addExpense({ amount: 50, description: 'Ads', category: 'Marketing & Werbung' });

      const result = await tools.getCategoryBreakdown({ type: 'expense' });

      expect(result.categories[0].name).toBe('IT & Software');
      expect(result.categories[1].name).toBe('Reisen & Transport');
      expect(result.categories[2].name).toBe('Marketing & Werbung');
    });

    it('requires type parameter', async () => {
      await expect(
        tools.getCategoryBreakdown({} as never)
      ).rejects.toThrow();
    });
  });

  describe('compare_periods', () => {
    it('compares two months', async () => {
      const result = await tools.comparePeriods({ period: 'month' });

      expect(result.comparison).toBeDefined();
      expect(result.comparison.current_period).toBeDefined();
      expect(result.comparison.compare_period).toBeDefined();
    });

    it('shows change data', async () => {
      await tools.addIncome({ amount: 1000, description: 'Current', date: today() });

      const result = await tools.comparePeriods({ period: 'month' });

      expect(result.income).toBeDefined();
      expect(result.income.change).toBeDefined();
      expect(result.expenses).toBeDefined();
      expect(result.net).toBeDefined();
    });

    it('requires period parameter', async () => {
      await expect(
        tools.comparePeriods({} as never)
      ).rejects.toThrow();
    });

    it('rejects "all" period', async () => {
      await expect(
        tools.comparePeriods({ period: 'all' as never })
      ).rejects.toThrow();
    });
  });

  describe('get_tax_summary', () => {
    beforeEach(async () => {
    });

    it('returns tax summary for a year', async () => {
      await tools.addIncome({ amount: 5000, description: 'Revenue' });
      await tools.addExpense({ amount: 1000, description: 'Costs' });

      const result = await tools.getTaxSummary({ year: 2026 });

      expect(result.zeitraum).toContain('2026');
      expect(result.einnahmen_ueberschuss_rechnung).toBeDefined();
      expect(result.einnahmen_ueberschuss_rechnung.betriebseinnahmen).toBeDefined();
      expect(result.einnahmen_ueberschuss_rechnung.betriebsausgaben).toBeDefined();
      expect(result.einnahmen_ueberschuss_rechnung.gewinn_verlust).toBeDefined();
    });

    it('returns tax summary for a quarter', async () => {
      const result = await tools.getTaxSummary({ year: 2026, quarter: 1 });

      expect(result.zeitraum).toContain('Q1');
    });

    it('requires year parameter', async () => {
      await expect(
        tools.getTaxSummary({} as never)
      ).rejects.toThrow();
    });

    it('rejects invalid quarter', async () => {
      await expect(
        tools.getTaxSummary({ year: 2026, quarter: 5 })
      ).rejects.toThrow();
    });

    it('rejects year before 2020', async () => {
      await expect(
        tools.getTaxSummary({ year: 2019 })
      ).rejects.toThrow();
    });
  });

  describe('Summary Workflow', () => {
    it('calculates comprehensive financial overview', async () => {
      // Add various transactions
      await tools.addIncome({ amount: 3000, description: 'Client A', category: 'Dienstleistung' });
      await tools.addIncome({ amount: 1500, description: 'Client B', category: 'Dienstleistung' });
      await tools.addExpense({ amount: 500, description: 'Software', category: 'IT & Software' });
      await tools.addExpense({ amount: 200, description: 'Hosting', category: 'IT & Software' });
      await tools.addExpense({ amount: 100, description: 'Ads', category: 'Marketing & Werbung' });

      // Get summary
      const summary = await tools.getSummary();
      expect(summary.income.total).toBe(4500);
      expect(summary.expenses.total).toBe(800);
      expect(summary.net.total).toBe(3700);
      expect(summary.transaction_count).toBe(5);

      // Get category breakdown
      const expenseBreakdown = await tools.getCategoryBreakdown({ type: 'expense' });
      expect(expenseBreakdown.total).toContain('800');

      const itExpenses = expenseBreakdown.categories.find((c) => c.name === 'IT & Software');
      expect(itExpenses?.total).toBe(700); // 500 + 200
    });
  });
});
