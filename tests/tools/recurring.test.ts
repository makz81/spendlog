import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { tools } from '../helpers/index.js';
import {
  setupTestDb,
  teardownTestDb,
} from '../setup.js';
import {
  recurringFactory,
  resetFactories,
  today,
  daysAgo,
} from '../fixtures/index.js';

describe('Recurring Tools', () => {
  beforeEach(async () => {
    await setupTestDb();
    resetFactories();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  describe('create_recurring', () => {
    it('creates monthly recurring expense', async () => {
      const result = await tools.createRecurring({
        type: 'expense',
        amount: 29.99,
        description: 'Hosting',
        interval: 'monthly',
      });

      expect(result.success).toBe(true);
      expect(result.recurring).toBeDefined();
      expect(result.recurring?.description).toBe('Hosting');
      expect(result.recurring?.interval).toBe('monatlich');
    });

    it('creates monthly recurring income', async () => {
      const result = await tools.createRecurring({
        type: 'income',
        amount: 500,
        description: 'Retainer',
        interval: 'monthly',
      });

      expect(result.success).toBe(true);
      expect(result.recurring?.type).toBe('Einnahme');
    });

    it('creates quarterly recurring', async () => {
      const result = await tools.createRecurring({
        type: 'expense',
        amount: 100,
        description: 'Quarterly Fee',
        interval: 'quarterly',
      });

      expect(result.recurring?.interval).toBe('vierteljährlich');
    });

    it('creates yearly recurring', async () => {
      const result = await tools.createRecurring({
        type: 'expense',
        amount: 199,
        description: 'Annual License',
        interval: 'yearly',
      });

      expect(result.recurring?.interval).toBe('jährlich');
    });

    it('creates with category', async () => {
      const result = await tools.createRecurring({
        type: 'expense',
        amount: 10,
        description: 'Netflix',
        interval: 'monthly',
        category: 'IT & Software',
      });

      expect(result.success).toBe(true);
    });

    it('creates with custom start date', async () => {
      const result = await tools.createRecurring({
        type: 'expense',
        amount: 50,
        description: 'Future Sub',
        interval: 'monthly',
        start_date: '2026-02-01',
      });

      expect(result.recurring?.next_due).toContain('01.02.2026');
    });

    it('sets next due to start date', async () => {
      const result = await tools.createRecurring({
        type: 'expense',
        amount: 25,
        description: 'Service',
        interval: 'monthly',
        start_date: today(),
      });

      expect(result.recurring?.next_due).toBeDefined();
    });

    it('returns formatted amount', async () => {
      const result = await tools.createRecurring({
        type: 'expense',
        amount: 1000,
        description: 'Big Expense',
        interval: 'yearly',
      });

      expect(result.recurring?.amount).toContain('1.000');
    });
  });

  describe('list_recurring', () => {
    it('lists empty when no recurring', async () => {
      const result = await tools.listRecurring();

      expect(result.total).toBe(0);
      expect(result.recurring.length).toBe(0);
    });

    it('lists all recurring', async () => {
      await tools.createRecurring(recurringFactory.expense());
      await tools.createRecurring(recurringFactory.income());

      const result = await tools.listRecurring();

      expect(result.total).toBe(2);
    });

    it('includes monthly projection', async () => {
      await tools.createRecurring({
        type: 'income',
        amount: 1000,
        description: 'Monthly Income',
        interval: 'monthly',
      });
      await tools.createRecurring({
        type: 'expense',
        amount: 200,
        description: 'Monthly Expense',
        interval: 'monthly',
      });

      const result = await tools.listRecurring();

      expect(result.monthly_projection).toBeDefined();
      expect(result.monthly_projection.income).toContain('1.000');
      expect(result.monthly_projection.expenses).toContain('200');
    });

    it('calculates monthly projection for quarterly', async () => {
      await tools.createRecurring({
        type: 'expense',
        amount: 300,
        description: 'Quarterly',
        interval: 'quarterly',
      });

      const result = await tools.listRecurring();

      // 300/3 = 100 per month
      expect(result.monthly_projection.expenses).toContain('100');
    });

    it('calculates monthly projection for yearly', async () => {
      await tools.createRecurring({
        type: 'expense',
        amount: 1200,
        description: 'Yearly',
        interval: 'yearly',
      });

      const result = await tools.listRecurring();

      // 1200/12 = 100 per month
      expect(result.monthly_projection.expenses).toContain('100');
    });

    it('shows category', async () => {
      await tools.createRecurring({
        type: 'expense',
        amount: 10,
        description: 'Streaming',
        interval: 'monthly',
        category: 'IT & Software',
      });

      const result = await tools.listRecurring();

      expect(result.recurring[0].category).toBe('IT & Software');
    });

    it('shows active status', async () => {
      await tools.createRecurring({
        type: 'expense',
        amount: 10,
        description: 'Active Sub',
        interval: 'monthly',
      });

      const result = await tools.listRecurring();

      expect(result.recurring[0].active).toBe(true);
    });
  });

  describe('delete_recurring', () => {
    it('deletes recurring', async () => {
      const created = await tools.createRecurring({
        type: 'expense',
        amount: 50,
        description: 'To Delete',
        interval: 'monthly',
      });

      const result = await tools.deleteRecurring({ id: created.recurring!.id });

      expect(result.success).toBe(true);
      expect(result.message).toContain('gelöscht');
    });

    it('removes from list after delete', async () => {
      const created = await tools.createRecurring({
        type: 'expense',
        amount: 50,
        description: 'Delete Me',
        interval: 'monthly',
      });

      await tools.deleteRecurring({ id: created.recurring!.id });

      const list = await tools.listRecurring();
      expect(list.total).toBe(0);
    });

    it('throws for non-existent recurring', async () => {
      await expect(
        tools.deleteRecurring({ id: '00000000-0000-0000-0000-000000000000' })
      ).rejects.toThrow('nicht gefunden');
    });

    it('rejects invalid UUID', async () => {
      await expect(
        tools.deleteRecurring({ id: 'not-a-uuid' })
      ).rejects.toThrow();
    });
  });

  describe('process_recurring', () => {
    it('returns empty when no due transactions', async () => {
      // Create recurring starting far in the future
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const futureDateStr = futureDate.toISOString().split('T')[0];

      await tools.createRecurring({
        type: 'expense',
        amount: 50,
        description: 'Future',
        interval: 'monthly',
        start_date: futureDateStr,
      });

      const result = await tools.processRecurring();

      expect(result.success).toBe(true);
      expect(result.processed).toBe(0);
    });

    it('processes due recurring', async () => {
      // Create recurring that's due today
      await tools.createRecurring({
        type: 'expense',
        amount: 29.99,
        description: 'Due Today',
        interval: 'monthly',
        start_date: today(),
      });

      const result = await tools.processRecurring();

      expect(result.success).toBe(true);
      expect(result.processed).toBe(1);
      expect(result.transactions?.length).toBe(1);
    });

    it('creates transaction when processing', async () => {
      await tools.createRecurring({
        type: 'expense',
        amount: 100,
        description: 'Processed Expense',
        interval: 'monthly',
        start_date: today(),
      });

      await tools.processRecurring();

      // Verify transaction was created
      const transactions = await tools.listTransactions({ type: 'expense' });
      expect(transactions.transactions.some(t => t.description === 'Processed Expense')).toBe(true);
    });

    it('updates next due date after processing', async () => {
      // Use a fixed past date to avoid flaky behavior on certain days of the month
      const fixedStart = '2026-01-15';
      const created = await tools.createRecurring({
        type: 'expense',
        amount: 50,
        description: 'Monthly Sub',
        interval: 'monthly',
        start_date: fixedStart,
      });

      await tools.processRecurring();

      const list = await tools.listRecurring();
      const recurring = list.recurring.find(r => r.id === created.recurring!.id);

      // Next due should have advanced past the original start date
      expect(recurring?.next_due).not.toContain('15.01.2026');
      expect(recurring?.next_due).toBeDefined();
    });

    it('processes income recurring', async () => {
      await tools.createRecurring({
        type: 'income',
        amount: 500,
        description: 'Monthly Retainer',
        interval: 'monthly',
        start_date: today(),
      });

      const result = await tools.processRecurring();

      expect(result.processed).toBe(1);

      // Verify income transaction created
      const transactions = await tools.listTransactions({ type: 'income' });
      expect(transactions.transactions.some(t => t.description === 'Monthly Retainer')).toBe(true);
    });
  });

  describe('Recurring Workflow', () => {
    it('full recurring lifecycle', async () => {
      // Create recurring
      const created = await tools.createRecurring({
        type: 'expense',
        amount: 29.99,
        description: 'Monthly Service',
        interval: 'monthly',
        start_date: today(),
        category: 'IT & Software',
      });
      expect(created.success).toBe(true);

      // List shows it
      let list = await tools.listRecurring();
      expect(list.total).toBe(1);
      expect(list.monthly_projection.expenses).toContain('29,99');

      // Process it
      const processed = await tools.processRecurring();
      expect(processed.processed).toBe(1);

      // Verify transaction created with category
      const transactions = await tools.listTransactions({ type: 'expense' });
      const tx = transactions.transactions.find(t => t.description === 'Monthly Service');
      expect(tx).toBeDefined();
      expect(tx?.category).toBe('IT & Software');

      // Delete it
      await tools.deleteRecurring({ id: created.recurring!.id });

      list = await tools.listRecurring();
      expect(list.total).toBe(0);
    });

    it('multiple recurring transactions', async () => {
      // Create various subscriptions
      await tools.createRecurring({
        type: 'expense',
        amount: 10,
        description: 'Netflix',
        interval: 'monthly',
      });
      await tools.createRecurring({
        type: 'expense',
        amount: 12,
        description: 'Spotify',
        interval: 'monthly',
      });
      await tools.createRecurring({
        type: 'income',
        amount: 2000,
        description: 'Salary',
        interval: 'monthly',
      });

      const list = await tools.listRecurring();

      expect(list.total).toBe(3);
      expect(list.monthly_projection.income).toContain('2.000');
      // 10 + 12 = 22
      expect(list.monthly_projection.expenses).toContain('22');
      // 2000 - 22 = 1978
      expect(list.monthly_projection.net).toContain('1.978');
    });
  });
});
