/**
 * Category Tool Integration Tests
 *
 * Tests for: list_categories, add_category, delete_category
 * Note: API returns einnahmen (income) and ausgaben (expense) arrays
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { tools } from '../helpers/index.js';
import {
  setupTestDb,
  teardownTestDb,
} from '../setup.js';
import {
  categoryFactory,
  resetFactories,
} from '../fixtures/index.js';

describe('Category Tools', () => {
  beforeEach(async () => {
    await setupTestDb();
    resetFactories();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  describe('list_categories', () => {
    it('lists all default categories', async () => {
      const result = await tools.listCategories();

      expect(result.total).toBeGreaterThan(0);
      expect(result.einnahmen.length).toBeGreaterThan(0);
      expect(result.ausgaben.length).toBeGreaterThan(0);
    });

    it('lists income categories', async () => {
      const result = await tools.listCategories({ type: 'income' });

      expect(result.einnahmen.some((c) => c.name === 'Dienstleistung')).toBe(true);
      expect(result.einnahmen.some((c) => c.name === 'Produktverkauf')).toBe(true);
    });

    it('lists expense categories', async () => {
      const result = await tools.listCategories({ type: 'expense' });

      expect(result.ausgaben.some((c) => c.name === 'IT & Software')).toBe(true);
      expect(result.ausgaben.some((c) => c.name === 'Marketing & Werbung')).toBe(true);
    });

    it('includes default income categories', async () => {
      const result = await tools.listCategories({ type: 'income' });

      const names = result.einnahmen.map((c) => c.name);
      expect(names).toContain('Dienstleistung');
      expect(names).toContain('Produktverkauf');
      expect(names).toContain('Affiliate/Provision');
      expect(names).toContain('Sonstiges');
    });

    it('includes default expense categories', async () => {
      const result = await tools.listCategories({ type: 'expense' });

      const names = result.ausgaben.map((c) => c.name);
      expect(names).toContain('IT & Software');
      expect(names).toContain('Marketing & Werbung');
      expect(names).toContain('Büro & Material');
      expect(names).toContain('Reisen & Transport');
    });

    it('marks default categories as standard', async () => {
      const result = await tools.listCategories();

      const allCategories = [...result.einnahmen, ...result.ausgaben];
      expect(allCategories.some((c) => c.standard === true)).toBe(true);
    });
  });

  describe('add_category', () => {
    it('adds a new income category', async () => {
      const input = categoryFactory.income('Consulting');
      const result = await tools.addCategory(input);

      expect(result.success).toBe(true);
      expect(result.category?.name).toBe('Consulting');
      expect(result.category?.type).toBe('Einnahme');
    });

    it('adds a new expense category', async () => {
      const input = categoryFactory.expense('Subscriptions');
      const result = await tools.addCategory(input);

      expect(result.success).toBe(true);
      expect(result.category?.name).toBe('Subscriptions');
      expect(result.category?.type).toBe('Ausgabe');
    });

    it('new category appears in list', async () => {
      await tools.addCategory({ name: 'NewCategory', type: 'income' });

      const result = await tools.listCategories({ type: 'income' });

      expect(result.einnahmen.some((c) => c.name === 'NewCategory')).toBe(true);
    });

    it('custom category is not marked as standard', async () => {
      await tools.addCategory({ name: 'Custom', type: 'expense' });

      const result = await tools.listCategories({ type: 'expense' });
      const customCategory = result.ausgaben.find((c) => c.name === 'Custom');

      expect(customCategory?.standard).toBe(false);
    });

    it('rejects duplicate category names', async () => {
      await tools.addCategory({ name: 'TestCategory', type: 'income' });
      const result = await tools.addCategory({ name: 'TestCategory', type: 'income' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('existiert bereits');
    });
  });

  describe('delete_category', () => {
    it('deletes a custom category', async () => {
      const addResult = await tools.addCategory({ name: 'ToDelete', type: 'income' });
      const result = await tools.deleteCategory({ id: addResult.category!.id });

      expect(result.success).toBe(true);
      expect(result.message).toContain('gelöscht');

      const list = await tools.listCategories({ type: 'income' });
      expect(list.einnahmen.every((c) => c.name !== 'ToDelete')).toBe(true);
    });

    it('throws error for non-existent category', async () => {
      await expect(
        tools.deleteCategory({ id: '00000000-0000-0000-0000-000000000000' })
      ).rejects.toThrow('nicht gefunden');
    });

    it('rejects invalid UUID', async () => {
      await expect(
        tools.deleteCategory({ id: 'not-a-uuid' })
      ).rejects.toThrow();
    });

    it('cannot delete default categories', async () => {
      const list = await tools.listCategories({ type: 'income' });
      const defaultCategory = list.einnahmen.find((c) => c.standard === true);

      expect(defaultCategory).toBeDefined();

      const result = await tools.deleteCategory({ id: defaultCategory!.id });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Standard-Kategorien');
    });

    it('cannot delete category used by transactions', async () => {
      // Create custom category
      const addResult = await tools.addCategory({ name: 'UsedCategory', type: 'expense' });

      // Use it in a transaction
      await tools.addExpense({ amount: 50, description: 'Test', category: 'UsedCategory' });

      // Try to delete
      const result = await tools.deleteCategory({ id: addResult.category!.id });

      expect(result.success).toBe(false);
      expect(result.error).toContain('wird von');
    });
  });

  describe('Category Workflow', () => {
    it('adds, uses in transaction, and lists category', async () => {
      // Add custom category
      const addResult = await tools.addCategory({ name: 'Freelance Work', type: 'income' });
      expect(addResult.success).toBe(true);

      // Use in transaction
      await tools.addIncome({ amount: 1000, description: 'Project', category: 'Freelance Work' });

      // List and verify
      const list = await tools.listCategories({ type: 'income' });
      expect(list.einnahmen.some((c) => c.name === 'Freelance Work')).toBe(true);
    });
  });
});
