/**
 * Transaction Tool Integration Tests
 *
 * Tests for: add_income, add_expense, list_transactions, update_transaction, delete_transaction
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { tools } from '../helpers/index.js';
import {
  setupTestDb,
  teardownTestDb,
  getTransactionCount,
  createTestProject,
  createTestBudget,
  getTestCategory,
} from '../setup.js';
import {
  incomeFactory,
  expenseFactory,
  today,
  daysAgo,
  resetFactories,
} from '../fixtures/index.js';

describe('Transaction Tools', () => {
  beforeEach(async () => {
    await setupTestDb();
    resetFactories();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  describe('add_income', () => {
    it('creates a basic income transaction', async () => {
      const input = incomeFactory.create({ amount: 1500, description: 'Consulting' });
      const result = await tools.addIncome(input);

      expect(result.success).toBe(true);
      expect(result.transaction.type).toBe('income');
      expect(result.transaction.amount).toBe(1500);
      expect(result.transaction.description).toBe('Consulting');
      expect(result.transaction.id).toBeDefined();
    });

    it('creates income with a category', async () => {
      const input = incomeFactory.withCategory('Dienstleistung', { amount: 2000 });
      const result = await tools.addIncome(input);

      expect(result.success).toBe(true);
      expect(result.transaction.category).toBe('Dienstleistung');
    });

    it('creates income with a new custom category', async () => {
      const input = incomeFactory.withCategory('Custom Income Category', { amount: 500 });
      const result = await tools.addIncome(input);

      expect(result.success).toBe(true);
      expect(result.transaction.category).toBe('Custom Income Category');
    });

    it('creates income with a specific date', async () => {
      const date = daysAgo(7);
      const input = incomeFactory.onDate(date, { amount: 1000 });
      const result = await tools.addIncome(input);

      expect(result.success).toBe(true);
      // Date is formatted as DD.MM.YYYY
      expect(result.transaction.date).toBeDefined();
    });

    it('creates income assigned to a project', async () => {
      const project = await createTestProject({ name: 'My SaaS' });
      const input = incomeFactory.withProject('My SaaS', { amount: 3000 });
      const result = await tools.addIncome(input);

      expect(result.success).toBe(true);
      expect(result.transaction.project).toBe('My SaaS');
    });

    it('returns transaction with all expected fields', async () => {
      const input = incomeFactory.create({ amount: 1000, description: 'Full fields test' });
      const result = await tools.addIncome(input);

      // Verify all expected fields are present in response
      expect(result.transaction.id).toBeDefined();
      expect(result.transaction.type).toBe('income');
      expect(result.transaction.amount).toBe(1000);
      expect(result.transaction.description).toBe('Full fields test');
      expect(result.transaction.date).toBeDefined();
      expect(result.message).toContain('Einnahme gespeichert');
    });

    it('rejects negative amount', async () => {
      await expect(
        tools.addIncome({ amount: -100, description: 'Invalid' })
      ).rejects.toThrow();
    });

    it('rejects zero amount', async () => {
      await expect(
        tools.addIncome({ amount: 0, description: 'Invalid' })
      ).rejects.toThrow();
    });

    it('rejects empty description', async () => {
      await expect(
        tools.addIncome({ amount: 100, description: '' })
      ).rejects.toThrow();
    });

    it('rejects invalid date format', async () => {
      await expect(
        tools.addIncome({ amount: 100, description: 'Test', date: '15-01-2026' })
      ).rejects.toThrow();
    });
  });

  describe('add_expense', () => {
    it('creates a basic expense transaction', async () => {
      const input = expenseFactory.create({ amount: 50, description: 'Hosting' });
      const result = await tools.addExpense(input);

      expect(result.success).toBe(true);
      expect(result.transaction.type).toBe('expense');
      expect(result.transaction.amount).toBe(50);
      expect(result.transaction.description).toBe('Hosting');
    });

    it('creates expense with a category', async () => {
      const input = expenseFactory.withCategory('IT & Software', { amount: 99 });
      const result = await tools.addExpense(input);

      expect(result.success).toBe(true);
      expect(result.transaction.category).toBe('IT & Software');
    });

    it('creates expense assigned to a project', async () => {
      const project = await createTestProject({ name: 'Client Work' });
      const input = expenseFactory.withProject('Client Work', { amount: 75 });
      const result = await tools.addExpense(input);

      expect(result.success).toBe(true);
      expect(result.transaction.project).toBe('Client Work');
    });

    it('triggers budget warning when threshold exceeded', async () => {
      // Create a budget of 100 with 80% threshold
      await createTestBudget({ amount: 100, alertThreshold: 80 });

      // Add expense that exceeds 80%
      const result = await tools.addExpense({ amount: 85, description: 'Big expense' });

      expect(result.success).toBe(true);
      expect(result.budget_warning).toBeDefined();
    });

    it('triggers category-specific budget warning', async () => {
      const category = await getTestCategory('IT & Software', 'expense');
      await createTestBudget({ amount: 50, categoryId: category!.id, alertThreshold: 80 });

      const result = await tools.addExpense({
        amount: 45,
        description: 'Software license',
        category: 'IT & Software',
      });

      expect(result.success).toBe(true);
      expect(result.budget_warning).toBeDefined();
    });

    it('does not trigger warning for unrelated category', async () => {
      const category = await getTestCategory('IT & Software', 'expense');
      await createTestBudget({ amount: 50, categoryId: category!.id, alertThreshold: 80 });

      const result = await tools.addExpense({
        amount: 45,
        description: 'Train ticket',
        category: 'Reisen & Transport',
      });

      expect(result.success).toBe(true);
      expect(result.budget_warning).toBeUndefined();
    });

    it('returns expense with all expected fields', async () => {
      const result = await tools.addExpense({ amount: 25, description: 'Coffee' });

      // Verify all expected fields are present in response
      expect(result.transaction.id).toBeDefined();
      expect(result.transaction.type).toBe('expense');
      expect(result.transaction.amount).toBe(25);
      expect(result.transaction.description).toBe('Coffee');
      expect(result.transaction.date).toBeDefined();
      expect(result.message).toContain('Ausgabe gespeichert');
    });
  });

  describe('list_transactions', () => {
    async function seedTransactions() {
      await tools.addIncome({ amount: 1000, description: 'Income 1' });
      await tools.addIncome({ amount: 500, description: 'Income 2' });
      await tools.addExpense({ amount: 50, description: 'Expense 1' });
      await tools.addExpense({ amount: 25, description: 'Expense 2' });
    }

    it('lists all transactions by default', async () => {
      await seedTransactions();
      const result = await tools.listTransactions();

      expect(result.total).toBe(4);
      expect(result.transactions).toHaveLength(4);
    });

    it('filters by income type', async () => {
      await seedTransactions();
      const result = await tools.listTransactions({ type: 'income' });

      expect(result.total).toBe(2);
      expect(result.transactions.every((t) => t.type === 'income')).toBe(true);
    });

    it('filters by expense type', async () => {
      await seedTransactions();
      const result = await tools.listTransactions({ type: 'expense' });

      expect(result.total).toBe(2);
      expect(result.transactions.every((t) => t.type === 'expense')).toBe(true);
    });

    it('filters by date range', async () => {
      await seedTransactions();
      // Add an older transaction
      await tools.addIncome({ amount: 200, description: 'Old income', date: daysAgo(30) });

      const result = await tools.listTransactions({
        from_date: daysAgo(7),
        to_date: today(),
      });

      // Should not include the 30-day-old transaction
      expect(result.transactions.every((t) => t.description !== 'Old income')).toBe(true);
    });

    it('filters by category', async () => {
      await tools.addExpense({ amount: 100, description: 'Tech expense', category: 'IT & Software' });
      await tools.addExpense({ amount: 50, description: 'Travel expense', category: 'Reisen & Transport' });

      const result = await tools.listTransactions({ category: 'IT & Software' });

      expect(result.transactions.every((t) => t.category === 'IT & Software')).toBe(true);
    });

    it('filters by project', async () => {
      await createTestProject({ name: 'TestProject' });
      await tools.addExpense({ amount: 50, description: 'Project expense', project: 'TestProject' });

      const result = await tools.listTransactions({ project: 'TestProject' });

      expect(result.total).toBe(1);
      expect(result.transactions[0].project).toBe('TestProject');
    });

    it('respects limit parameter', async () => {
      await seedTransactions();
      const result = await tools.listTransactions({ limit: 2 });

      expect(result.transactions).toHaveLength(2);
    });

    it('returns correct summary calculations', async () => {
      await seedTransactions();
      const result = await tools.listTransactions();

      // Income: 1000 + 500 = 1500
      // Expense: 50 + 25 = 75
      // Net: 1500 - 75 = 1425
      expect(result.summary.income).toContain('1.500');
      expect(result.summary.expenses).toContain('75');
      expect(result.summary.net).toContain('1.425');
    });

    it('orders by date descending', async () => {
      await tools.addIncome({ amount: 100, description: 'Older', date: daysAgo(5) });
      await tools.addIncome({ amount: 100, description: 'Newer', date: today() });

      const result = await tools.listTransactions();

      // Find the index of each transaction
      const newerIndex = result.transactions.findIndex((t) => t.description === 'Newer');
      const olderIndex = result.transactions.findIndex((t) => t.description === 'Older');

      // Newer should come before older
      expect(newerIndex).toBeLessThan(olderIndex);
    });
  });

  describe('update_transaction', () => {
    async function createOriginalTransaction(): Promise<string> {
      const result = await tools.addIncome({ amount: 1000, description: 'Original' });
      return result.transaction.id;
    }

    it('updates amount', async () => {
      const transactionId = await createOriginalTransaction();
      const result = await tools.updateTransaction({ id: transactionId, amount: 1500 });

      expect(result.success).toBe(true);
      expect(result.changes).toContain('Betrag: 1.000,00\u00A0€ → 1.500,00\u00A0€');
      expect(result.transaction.amount).toBe(1500);
    });

    it('updates description', async () => {
      const transactionId = await createOriginalTransaction();
      const result = await tools.updateTransaction({
        id: transactionId,
        description: 'Updated description',
      });

      expect(result.success).toBe(true);
      expect(result.changes).toContain('Beschreibung: "Original" → "Updated description"');
      expect(result.transaction.description).toBe('Updated description');
    });

    it('updates date', async () => {
      const transactionId = await createOriginalTransaction();
      const newDate = daysAgo(3);
      const result = await tools.updateTransaction({ id: transactionId, date: newDate });

      expect(result.success).toBe(true);
      expect(result.changes?.some((c) => c.includes('Datum'))).toBe(true);
    });

    it('updates category', async () => {
      const transactionId = await createOriginalTransaction();
      const result = await tools.updateTransaction({
        id: transactionId,
        category: 'Dienstleistung',
      });

      expect(result.success).toBe(true);
      expect(result.changes?.some((c) => c.includes('Kategorie'))).toBe(true);
    });

    it('assigns project', async () => {
      const transactionId = await createOriginalTransaction();
      await createTestProject({ name: 'NewProject' });
      const result = await tools.updateTransaction({
        id: transactionId,
        project: 'NewProject',
      });

      expect(result.success).toBe(true);
      expect(result.transaction.project).toBe('NewProject');
    });

    it('removes project assignment with empty string', async () => {
      const transactionId = await createOriginalTransaction();
      await createTestProject({ name: 'TestProject' });
      await tools.updateTransaction({ id: transactionId, project: 'TestProject' });

      const result = await tools.updateTransaction({ id: transactionId, project: '' });

      expect(result.success).toBe(true);
      expect(result.transaction.project).toBeNull();
    });

    it('updates multiple fields at once', async () => {
      const transactionId = await createOriginalTransaction();
      const result = await tools.updateTransaction({
        id: transactionId,
        amount: 2000,
        description: 'Multi-update',
      });

      expect(result.success).toBe(true);
      expect(result.changes).toHaveLength(2);
    });

    it('returns no success when no changes provided', async () => {
      const transactionId = await createOriginalTransaction();
      const result = await tools.updateTransaction({ id: transactionId });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Keine Änderungen');
    });

    it('throws error for non-existent transaction', async () => {
      await expect(
        tools.updateTransaction({
          id: '00000000-0000-0000-0000-000000000000',
          amount: 100,
        })
      ).rejects.toThrow('Transaktion nicht gefunden');
    });

    it('queues update for cloud sync (when connected)', async () => {
      // Note: Cloud sync only queues when connected. This test verifies the tool behavior,
      // not the sync queue (which requires connection state setup).
      const transactionId = await createOriginalTransaction();
      const result = await tools.updateTransaction({ id: transactionId, amount: 1500 });

      expect(result.success).toBe(true);
    });
  });

  describe('delete_transaction', () => {
    async function createTransactionToDelete(): Promise<string> {
      const result = await tools.addExpense({ amount: 100, description: 'To delete' });
      return result.transaction.id;
    }

    it('deletes a transaction', async () => {
      const transactionId = await createTransactionToDelete();
      const countBefore = await getTransactionCount();
      const result = await tools.deleteTransaction({ id: transactionId });
      const countAfter = await getTransactionCount();

      expect(result.success).toBe(true);
      expect(result.message).toContain('Transaktion gelöscht');
      expect(countAfter).toBe(countBefore - 1);
    });

    it('throws error for non-existent transaction', async () => {
      await expect(
        tools.deleteTransaction({ id: '00000000-0000-0000-0000-000000000000' })
      ).rejects.toThrow('Transaktion nicht gefunden');
    });

    it('throws error for invalid UUID', async () => {
      await expect(
        tools.deleteTransaction({ id: 'not-a-uuid' })
      ).rejects.toThrow();
    });

    it('queues deletion for cloud sync (when connected)', async () => {
      // Note: Cloud sync only queues when connected. This test verifies deletion works.
      const transactionId = await createTransactionToDelete();
      const result = await tools.deleteTransaction({ id: transactionId });

      expect(result.success).toBe(true);
    });
  });

  describe('Transaction Workflow', () => {
    it('creates, updates, and deletes a transaction', async () => {
      // Create
      const created = await tools.addIncome({
        amount: 500,
        description: 'Workflow test',
      });
      expect(created.success).toBe(true);
      const id = created.transaction.id;

      // Update
      const updated = await tools.updateTransaction({
        id,
        amount: 750,
        description: 'Updated workflow test',
      });
      expect(updated.success).toBe(true);
      expect(updated.transaction.amount).toBe(750);

      // Verify in list
      const list = await tools.listTransactions();
      const found = list.transactions.find((t) => t.id === id);
      expect(found).toBeDefined();
      expect(found?.amount).toBe(750);

      // Delete
      const deleted = await tools.deleteTransaction({ id });
      expect(deleted.success).toBe(true);

      // Verify deleted
      const finalList = await tools.listTransactions();
      const notFound = finalList.transactions.find((t) => t.id === id);
      expect(notFound).toBeUndefined();
    });

    it('handles bulk transactions correctly', async () => {
      // Create 10 transactions
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(tools.addIncome({ amount: 100 * (i + 1), description: `Bulk ${i + 1}` }));
      }
      await Promise.all(promises);

      const result = await tools.listTransactions();
      expect(result.total).toBe(10);

      // Verify total income
      const totalIncome = result.transactions.reduce((sum, t) => sum + t.amount, 0);
      expect(totalIncome).toBe(5500); // Sum of 100 + 200 + ... + 1000
    });
  });
});
