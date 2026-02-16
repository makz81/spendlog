/**
 * Validation Schema Tests
 * Tests Zod schemas for input validation
 */
import { describe, it, expect } from 'vitest';
import {
  addIncomeSchema,
  addExpenseSchema,
  listTransactionsSchema,
  deleteTransactionSchema,
  updateTransactionSchema,
  getSummarySchema,
  getCategoryBreakdownSchema,
  comparePeriodsSchema,
  getTaxSummarySchema,
  createInvoiceSchema,
  setBudgetSchema,
  getBudgetStatusSchema,
  deleteBudgetSchema,
  updateBudgetSchema,
} from '../src/utils/validation.js';

describe('Transaction Validation', () => {
  describe('addIncomeSchema', () => {
    it('accepts valid income data', () => {
      const result = addIncomeSchema.parse({
        amount: 1000,
        description: 'Consulting work',
      });
      expect(result.amount).toBe(1000);
      expect(result.description).toBe('Consulting work');
    });

    it('accepts income with optional fields', () => {
      const result = addIncomeSchema.parse({
        amount: 500,
        description: 'Affiliate commission',
        category: 'Affiliate/Provision',
        date: '2026-01-15',
      });
      expect(result.category).toBe('Affiliate/Provision');
      expect(result.date).toBe('2026-01-15');
    });

    it('rejects negative amounts', () => {
      expect(() =>
        addIncomeSchema.parse({
          amount: -100,
          description: 'Invalid',
        })
      ).toThrow();
    });

    it('rejects zero amounts', () => {
      expect(() =>
        addIncomeSchema.parse({
          amount: 0,
          description: 'Invalid',
        })
      ).toThrow();
    });

    it('rejects empty description', () => {
      expect(() =>
        addIncomeSchema.parse({
          amount: 100,
          description: '',
        })
      ).toThrow();
    });

    it('rejects invalid date format', () => {
      expect(() =>
        addIncomeSchema.parse({
          amount: 100,
          description: 'Test',
          date: '15-01-2026', // Wrong format
        })
      ).toThrow();
    });
  });

  describe('addExpenseSchema', () => {
    it('accepts valid expense data', () => {
      const result = addExpenseSchema.parse({
        amount: 50,
        description: 'Software subscription',
      });
      expect(result.amount).toBe(50);
      expect(result.description).toBe('Software subscription');
    });

    it('accepts expense with category', () => {
      const result = addExpenseSchema.parse({
        amount: 29.99,
        description: 'Hosting',
        category: 'IT & Software',
      });
      expect(result.category).toBe('IT & Software');
    });
  });

  describe('listTransactionsSchema', () => {
    it('accepts empty object with defaults', () => {
      const result = listTransactionsSchema.parse({});
      expect(result.type).toBe('all');
      expect(result.limit).toBe(50);
    });

    it('accepts valid filters', () => {
      const result = listTransactionsSchema.parse({
        type: 'expense',
        from_date: '2026-01-01',
        to_date: '2026-01-31',
        category: 'IT & Software',
        limit: 100,
      });
      expect(result.type).toBe('expense');
      expect(result.from_date).toBe('2026-01-01');
      expect(result.limit).toBe(100);
    });

    it('rejects invalid type', () => {
      expect(() =>
        listTransactionsSchema.parse({
          type: 'invalid',
        })
      ).toThrow();
    });

    it('rejects limit over 500', () => {
      expect(() =>
        listTransactionsSchema.parse({
          limit: 501,
        })
      ).toThrow();
    });
  });

  describe('deleteTransactionSchema', () => {
    it('accepts valid UUID', () => {
      const result = deleteTransactionSchema.parse({
        id: '123e4567-e89b-12d3-a456-426614174000',
      });
      expect(result.id).toBe('123e4567-e89b-12d3-a456-426614174000');
    });

    it('rejects invalid UUID', () => {
      expect(() =>
        deleteTransactionSchema.parse({
          id: 'not-a-uuid',
        })
      ).toThrow();
    });
  });

  describe('updateTransactionSchema', () => {
    it('accepts ID with optional updates', () => {
      const result = updateTransactionSchema.parse({
        id: '123e4567-e89b-12d3-a456-426614174000',
        amount: 150,
        description: 'Updated description',
      });
      expect(result.amount).toBe(150);
      expect(result.description).toBe('Updated description');
    });

    it('accepts ID only', () => {
      const result = updateTransactionSchema.parse({
        id: '123e4567-e89b-12d3-a456-426614174000',
      });
      expect(result.id).toBeDefined();
      expect(result.amount).toBeUndefined();
    });
  });
});

describe('Summary Validation', () => {
  describe('getSummarySchema', () => {
    it('accepts empty object with defaults', () => {
      const result = getSummarySchema.parse({});
      expect(result.period).toBe('month');
    });

    it('accepts all period types', () => {
      for (const period of ['month', 'quarter', 'year', 'all']) {
        const result = getSummarySchema.parse({ period });
        expect(result.period).toBe(period);
      }
    });

    it('accepts reference date', () => {
      const result = getSummarySchema.parse({
        period: 'month',
        date: '2026-01-15',
      });
      expect(result.date).toBe('2026-01-15');
    });
  });

  describe('getCategoryBreakdownSchema', () => {
    it('requires type parameter', () => {
      expect(() => getCategoryBreakdownSchema.parse({})).toThrow();
    });

    it('accepts income type', () => {
      const result = getCategoryBreakdownSchema.parse({ type: 'income' });
      expect(result.type).toBe('income');
    });

    it('accepts expense type', () => {
      const result = getCategoryBreakdownSchema.parse({ type: 'expense' });
      expect(result.type).toBe('expense');
    });
  });

  describe('comparePeriodsSchema', () => {
    it('requires period parameter', () => {
      expect(() => comparePeriodsSchema.parse({})).toThrow();
    });

    it('accepts valid period comparison', () => {
      const result = comparePeriodsSchema.parse({
        period: 'month',
        current_date: '2026-01-15',
        compare_date: '2025-12-15',
      });
      expect(result.period).toBe('month');
    });

    it('rejects "all" period (not valid for comparison)', () => {
      expect(() =>
        comparePeriodsSchema.parse({
          period: 'all',
        })
      ).toThrow();
    });
  });

  describe('getTaxSummarySchema', () => {
    it('requires year parameter', () => {
      expect(() => getTaxSummarySchema.parse({})).toThrow();
    });

    it('accepts year only', () => {
      const result = getTaxSummarySchema.parse({ year: 2026 });
      expect(result.year).toBe(2026);
      expect(result.quarter).toBeUndefined();
    });

    it('accepts year with quarter', () => {
      const result = getTaxSummarySchema.parse({ year: 2026, quarter: 1 });
      expect(result.year).toBe(2026);
      expect(result.quarter).toBe(1);
    });

    it('rejects invalid quarter', () => {
      expect(() =>
        getTaxSummarySchema.parse({ year: 2026, quarter: 5 })
      ).toThrow();
    });

    it('rejects year before 2020', () => {
      expect(() => getTaxSummarySchema.parse({ year: 2019 })).toThrow();
    });
  });
});

describe('Invoice Validation', () => {
  describe('createInvoiceSchema', () => {
    it('accepts valid invoice data', () => {
      const result = createInvoiceSchema.parse({
        client_name: 'Acme Corp',
        items: [{ description: 'Consulting', amount: 1000 }],
      });
      expect(result.client_name).toBe('Acme Corp');
      expect(result.items).toHaveLength(1);
    });

    it('accepts invoice with all fields', () => {
      const result = createInvoiceSchema.parse({
        client_name: 'Acme Corp',
        client_address: 'Street 123\n12345 City',
        items: [
          { description: 'Consulting', amount: 1000, quantity: 10 },
          { description: 'Development', amount: 500, quantity: 5 },
        ],
        date: '2026-01-15',
        due_date: '2026-01-29',
        notes: 'Payment within 14 days',
      });
      expect(result.items).toHaveLength(2);
      expect(result.items[0].quantity).toBe(10);
    });

    it('rejects invoice without items', () => {
      expect(() =>
        createInvoiceSchema.parse({
          client_name: 'Acme Corp',
          items: [],
        })
      ).toThrow();
    });

    it('rejects invoice without client name', () => {
      expect(() =>
        createInvoiceSchema.parse({
          items: [{ description: 'Work', amount: 100 }],
        })
      ).toThrow();
    });

    it('sets default quantity to 1', () => {
      const result = createInvoiceSchema.parse({
        client_name: 'Client',
        items: [{ description: 'Item', amount: 100 }],
      });
      expect(result.items[0].quantity).toBe(1);
    });
  });
});

describe('Budget Validation', () => {
  describe('setBudgetSchema', () => {
    it('accepts valid budget with amount only', () => {
      const result = setBudgetSchema.parse({ amount: 500 });
      expect(result.amount).toBe(500);
      expect(result.period).toBe('monthly');
      expect(result.alert_threshold).toBe(80);
    });

    it('accepts budget with all options', () => {
      const result = setBudgetSchema.parse({
        amount: 1000,
        period: 'quarterly',
        category: 'IT & Software',
        name: 'Tech Budget',
        alert_threshold: 90,
      });
      expect(result.period).toBe('quarterly');
      expect(result.category).toBe('IT & Software');
      expect(result.alert_threshold).toBe(90);
    });

    it('rejects negative amounts', () => {
      expect(() => setBudgetSchema.parse({ amount: -100 })).toThrow();
    });

    it('rejects invalid period', () => {
      expect(() =>
        setBudgetSchema.parse({ amount: 500, period: 'weekly' })
      ).toThrow();
    });

    it('rejects alert threshold over 100', () => {
      expect(() =>
        setBudgetSchema.parse({ amount: 500, alert_threshold: 150 })
      ).toThrow();
    });

    it('rejects alert threshold under 1', () => {
      expect(() =>
        setBudgetSchema.parse({ amount: 500, alert_threshold: 0 })
      ).toThrow();
    });
  });

  describe('getBudgetStatusSchema', () => {
    it('accepts empty object', () => {
      const result = getBudgetStatusSchema.parse({});
      expect(result.category).toBeUndefined();
    });

    it('accepts category filter', () => {
      const result = getBudgetStatusSchema.parse({ category: 'IT & Software' });
      expect(result.category).toBe('IT & Software');
    });
  });

  describe('deleteBudgetSchema', () => {
    it('accepts valid UUID', () => {
      const result = deleteBudgetSchema.parse({
        id: '123e4567-e89b-12d3-a456-426614174000',
      });
      expect(result.id).toBe('123e4567-e89b-12d3-a456-426614174000');
    });

    it('rejects invalid UUID', () => {
      expect(() => deleteBudgetSchema.parse({ id: 'invalid' })).toThrow();
    });
  });

  describe('updateBudgetSchema', () => {
    it('accepts ID with updates', () => {
      const result = updateBudgetSchema.parse({
        id: '123e4567-e89b-12d3-a456-426614174000',
        amount: 750,
        alert_threshold: 85,
        active: false,
      });
      expect(result.amount).toBe(750);
      expect(result.alert_threshold).toBe(85);
      expect(result.active).toBe(false);
    });

    it('accepts ID only', () => {
      const result = updateBudgetSchema.parse({
        id: '123e4567-e89b-12d3-a456-426614174000',
      });
      expect(result.id).toBeDefined();
      expect(result.amount).toBeUndefined();
    });
  });
});
