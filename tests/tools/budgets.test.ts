/**
 * Budget Tool Integration Tests
 *
 * Tests for: set_budget, get_budget_status, list_budgets, update_budget, delete_budget
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { tools } from '../helpers/index.js';
import {
  setupTestDb,
  teardownTestDb,
  getTestCategory,
  createTestBudget,
} from '../setup.js';
import {
  budgetFactory,
  expenseFactory,
  resetFactories,
} from '../fixtures/index.js';

describe('Budget Tools', () => {
  beforeEach(async () => {
    await setupTestDb();
    resetFactories();
    // Most budget tests need multiple budgets, set PRO tier
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  describe('set_budget', () => {
    it('creates a basic monthly budget', async () => {
      const input = budgetFactory.create({ amount: 500 });
      const result = await tools.setBudget(input);

      expect(result.success).toBe(true);
      expect(result.budget.amount).toBe(500);
      expect(result.budget.period).toBe('monthly');
      expect(result.message).toContain('500,00');
      expect(result.message).toContain('monatlich');
    });

    it('creates a quarterly budget', async () => {
      const input = budgetFactory.quarterly(1500);
      const result = await tools.setBudget(input);

      expect(result.success).toBe(true);
      expect(result.budget.period).toBe('quarterly');
      expect(result.message).toContain('pro Quartal');
    });

    it('creates a yearly budget', async () => {
      const input = budgetFactory.yearly(6000);
      const result = await tools.setBudget(input);

      expect(result.success).toBe(true);
      expect(result.budget.period).toBe('yearly');
      expect(result.message).toContain('pro Jahr');
    });

    it('creates a category-specific budget', async () => {
      const input = budgetFactory.forCategory('IT & Software', 200);
      const result = await tools.setBudget(input);

      expect(result.success).toBe(true);
      expect(result.budget.category).toBe('IT & Software');
      expect(result.message).toContain('IT & Software');
    });

    it('creates a named budget', async () => {
      const result = await tools.setBudget({
        amount: 300,
        name: 'Marketing Q1',
      });

      expect(result.success).toBe(true);
    });

    it('sets custom alert threshold', async () => {
      const input = budgetFactory.withThreshold(1000, 90);
      const result = await tools.setBudget(input);

      expect(result.success).toBe(true);
      // Threshold is stored but not returned in basic response
    });

    it('updates existing budget for same category/period', async () => {
      // Create initial budget
      await tools.setBudget({ amount: 500, category: 'IT & Software' });

      // Update with same category/period
      const result = await tools.setBudget({ amount: 750, category: 'IT & Software' });

      expect(result.success).toBe(true);
      expect(result.budget.amount).toBe(750);
      expect(result.message).toContain('aktualisiert');
    });

    it('returns error for non-existent category', async () => {
      const result = await tools.setBudget({
        amount: 200,
        category: 'Non-existent Category',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('nicht gefunden');
    });

    it('rejects negative amount', async () => {
      await expect(
        tools.setBudget({ amount: -100 })
      ).rejects.toThrow();
    });

    it('rejects zero amount', async () => {
      await expect(
        tools.setBudget({ amount: 0 })
      ).rejects.toThrow();
    });

    it('rejects invalid period', async () => {
      await expect(
        tools.setBudget({ amount: 500, period: 'weekly' as never })
      ).rejects.toThrow();
    });

    it('rejects alert threshold over 100', async () => {
      await expect(
        tools.setBudget({ amount: 500, alert_threshold: 150 })
      ).rejects.toThrow();
    });

    it('rejects alert threshold under 1', async () => {
      await expect(
        tools.setBudget({ amount: 500, alert_threshold: 0 })
      ).rejects.toThrow();
    });
  });

  describe('get_budget_status', () => {
    it('returns empty when no budgets exist', async () => {
      const result = await tools.getBudgetStatus();

      expect(result.success).toBe(true);
      expect(result.budgets).toHaveLength(0);
      expect(result.message).toContain('Keine aktiven Budgets');
    });

    it('returns status for single budget with no spending', async () => {
      await tools.setBudget({ amount: 500 });

      const result = await tools.getBudgetStatus();

      expect(result.success).toBe(true);
      expect(result.budgets).toHaveLength(1);
      expect(result.budgets[0].spent).toBe(0);
      expect(result.budgets[0].remaining).toBe(500);
      expect(result.budgets[0].percentage).toBe(0);
      expect(result.budgets[0].status).toBe('ok');
    });

    it('calculates spending correctly', async () => {
      await tools.setBudget({ amount: 1000 });
      await tools.addExpense({ amount: 300, description: 'Expense 1' });
      await tools.addExpense({ amount: 200, description: 'Expense 2' });

      const result = await tools.getBudgetStatus();

      expect(result.budgets[0].spent).toBe(500);
      expect(result.budgets[0].remaining).toBe(500);
      expect(result.budgets[0].percentage).toBe(50);
      expect(result.budgets[0].transaction_count).toBe(2);
    });

    it('shows warning status when threshold reached', async () => {
      await tools.setBudget({ amount: 100, alert_threshold: 80 });
      await tools.addExpense({ amount: 85, description: 'Big expense' });

      const result = await tools.getBudgetStatus();

      expect(result.budgets[0].status).toBe('warning');
      expect(result.summary).toContain('nähern sich');
    });

    it('shows over status when budget exceeded', async () => {
      await tools.setBudget({ amount: 100 });
      await tools.addExpense({ amount: 120, description: 'Overspend' });

      const result = await tools.getBudgetStatus();

      expect(result.budgets[0].status).toBe('over');
      expect(result.summary).toContain('überschritten');
    });

    it('filters by category', async () => {
      await tools.setBudget({ amount: 500, category: 'IT & Software' });
      await tools.setBudget({ amount: 200, category: 'Marketing & Werbung' });

      const result = await tools.getBudgetStatus({ category: 'IT & Software' });

      expect(result.budgets).toHaveLength(1);
      expect(result.budgets[0].category).toBe('IT & Software');
    });

    it('only includes active budgets', async () => {
      const createResult = await tools.setBudget({ amount: 500 });
      await tools.updateBudget({ id: createResult.budget.id, active: false });

      const result = await tools.getBudgetStatus();

      expect(result.budgets).toHaveLength(0);
    });

    it('calculates category-specific spending correctly', async () => {
      await tools.setBudget({ amount: 200, category: 'IT & Software' });
      await tools.addExpense({ amount: 50, description: 'Software', category: 'IT & Software' });
      await tools.addExpense({ amount: 30, description: 'Travel', category: 'Reisen & Transport' });

      const result = await tools.getBudgetStatus({ category: 'IT & Software' });

      expect(result.budgets[0].spent).toBe(50);
      expect(result.budgets[0].transaction_count).toBe(1);
    });
  });

  describe('list_budgets', () => {
    it('returns empty when no budgets exist', async () => {
      const result = await tools.listBudgets();

      expect(result.success).toBe(true);
      expect(result.budgets).toHaveLength(0);
      expect(result.message).toContain('Keine Budgets');
    });

    it('lists all budgets', async () => {
      await tools.setBudget({ amount: 500 });
      await tools.setBudget({ amount: 200, category: 'IT & Software' });
      await tools.setBudget({ amount: 1500, period: 'quarterly' });

      const result = await tools.listBudgets();

      expect(result.total).toBe(3);
      expect(result.budgets).toHaveLength(3);
    });

    it('includes active count', async () => {
      // Create two different budgets (different categories to avoid update logic)
      const budget1 = await tools.setBudget({ amount: 500 });
      await tools.setBudget({ amount: 200, category: 'IT & Software' });
      await tools.updateBudget({ id: budget1.budget.id, active: false });

      const result = await tools.listBudgets();

      expect(result.total).toBe(2);
      expect(result.active).toBe(1);
    });

    it('returns formatted amounts', async () => {
      await tools.setBudget({ amount: 1234.56 });

      const result = await tools.listBudgets();

      expect(result.budgets[0].amount_formatted).toContain('1.234,56');
    });

    it('includes period labels', async () => {
      await tools.setBudget({ amount: 500, period: 'quarterly' });

      const result = await tools.listBudgets();

      expect(result.budgets[0].period_label).toBe('pro Quartal');
    });
  });

  describe('update_budget', () => {
    let budgetId: string;

    async function createBaseBudget(): Promise<string> {
      const result = await tools.setBudget({ amount: 500 });
      return result.budget.id;
    }

    it('updates amount', async () => {
      budgetId = await createBaseBudget();
      const result = await tools.updateBudget({ id: budgetId, amount: 750 });

      expect(result.success).toBe(true);
      expect(result.budget.amount).toBe(750);
      expect(result.changes).toContain('Betrag: 500,00\u00A0€ → 750,00\u00A0€');
    });

    it('updates alert threshold', async () => {
      budgetId = await createBaseBudget();
      const result = await tools.updateBudget({ id: budgetId, alert_threshold: 90 });

      expect(result.success).toBe(true);
      expect(result.changes?.some((c) => c.includes('Warnschwelle'))).toBe(true);
    });

    it('deactivates budget', async () => {
      budgetId = await createBaseBudget();
      const result = await tools.updateBudget({ id: budgetId, active: false });

      expect(result.success).toBe(true);
      expect(result.budget.active).toBe(false);
      expect(result.changes?.some((c) => c.includes('inaktiv'))).toBe(true);
    });

    it('activates budget', async () => {
      budgetId = await createBaseBudget();
      await tools.updateBudget({ id: budgetId, active: false });

      const result = await tools.updateBudget({ id: budgetId, active: true });

      expect(result.success).toBe(true);
      expect(result.budget.active).toBe(true);
    });

    it('updates multiple fields at once', async () => {
      budgetId = await createBaseBudget();
      const result = await tools.updateBudget({
        id: budgetId,
        amount: 1000,
        alert_threshold: 95,
      });

      expect(result.success).toBe(true);
      expect(result.changes).toHaveLength(2);
    });

    it('returns error when no changes provided', async () => {
      budgetId = await createBaseBudget();
      const result = await tools.updateBudget({ id: budgetId });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Keine Änderungen');
    });

    it('returns error for non-existent budget', async () => {
      const result = await tools.updateBudget({
        id: '00000000-0000-0000-0000-000000000000',
        amount: 500,
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('nicht gefunden');
    });
  });

  describe('delete_budget', () => {
    it('deletes a budget', async () => {
      const createResult = await tools.setBudget({ amount: 500 });
      const result = await tools.deleteBudget({ id: createResult.budget.id });

      expect(result.success).toBe(true);
      expect(result.message).toContain('gelöscht');

      // Verify deletion
      const listResult = await tools.listBudgets();
      expect(listResult.budgets).toHaveLength(0);
    });

    it('returns error for non-existent budget', async () => {
      const result = await tools.deleteBudget({
        id: '00000000-0000-0000-0000-000000000000',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('nicht gefunden');
    });

    it('rejects invalid UUID', async () => {
      await expect(
        tools.deleteBudget({ id: 'not-a-uuid' })
      ).rejects.toThrow();
    });
  });

  describe('Budget Workflow', () => {
    it('creates, uses, and tracks a budget', async () => {
      // Create budget
      const createResult = await tools.setBudget({ amount: 1000, alert_threshold: 80 });
      expect(createResult.success).toBe(true);
      const budgetId = createResult.budget.id;

      // Add expenses
      await tools.addExpense({ amount: 300, description: 'Expense 1' });
      await tools.addExpense({ amount: 400, description: 'Expense 2' });

      // Check status (should be warning at 70%)
      const status1 = await tools.getBudgetStatus();
      expect(status1.budgets[0].percentage).toBe(70);
      expect(status1.budgets[0].status).toBe('ok');

      // Add more to hit threshold
      await tools.addExpense({ amount: 150, description: 'Expense 3' });

      // Should now be in warning
      const status2 = await tools.getBudgetStatus();
      expect(status2.budgets[0].percentage).toBe(85);
      expect(status2.budgets[0].status).toBe('warning');

      // Increase budget
      await tools.updateBudget({ id: budgetId, amount: 1500 });

      // Should be back to ok
      const status3 = await tools.getBudgetStatus();
      expect(status3.budgets[0].status).toBe('ok');
    });

    it('handles multiple budgets correctly', async () => {
      // Create total budget
      await tools.setBudget({ amount: 2000 });

      // Create category budget
      await tools.setBudget({ amount: 500, category: 'IT & Software' });

      // Add category expense
      await tools.addExpense({ amount: 300, description: 'Software', category: 'IT & Software' });

      // Check both budgets
      const status = await tools.getBudgetStatus();

      // Total budget should show the expense
      const totalBudget = status.budgets.find((b: unknown) => (b as { category: string | null }).category === null);
      expect(totalBudget?.spent).toBe(300);

      // Category budget should also show the expense
      const categoryBudget = status.budgets.find((b: unknown) => (b as { category: string | null }).category === 'IT & Software');
      expect(categoryBudget?.spent).toBe(300);
    });
  });
});
