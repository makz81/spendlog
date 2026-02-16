/**
 * Freemium Gate Tests
 *
 * Tests for: feature gates (invoice, export, connection, recurring), budget limits, PRO bypass
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { tools } from '../helpers/index.js';
import {
  setupTestDb,
  teardownTestDb,
  TEST_USER_ID,
  TestDataSource,
} from '../setup.js';
import { expenseFactory, profileFactory, resetFactories } from '../fixtures/index.js';
import { User } from '../../src/entities/User.js';
import { Recurring } from '../../src/entities/Recurring.js';

async function setUserTier(tier: 'free' | 'pro'): Promise<void> {
  const userRepo = TestDataSource.getRepository(User);
  await userRepo.update(TEST_USER_ID, { tier });
}

describe('Freemium Gates', () => {
  beforeEach(async () => {
    await setupTestDb();
    resetFactories();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  describe('transactions (unlimited)', () => {
    it('allows transactions without limit', async () => {
      const result = await tools.addExpense(
        expenseFactory.create({ amount: 50, description: 'Normal expense' })
      );
      expect(result.success).toBe(true);
      expect(result.hints).toBeUndefined();
    });

    it('allows many transactions for free tier', async () => {
      // Add 60 transactions (was blocked at 50 before)
      for (let i = 0; i < 60; i++) {
        const result = await tools.addExpense(
          expenseFactory.create({ amount: 10, description: `Bulk tx ${i + 1}` })
        );
        expect(result.success).toBe(true);
      }
    });
  });

  describe('invoice PRO gate', () => {
    it('blocks create_invoice for free tier', async () => {
      await tools.setProfile(profileFactory.minimal());
      const result = await tools.createInvoice({
        client_name: 'Test Client',
        items: [{ description: 'Work', amount: 100 }],
      });
      expect(result.success).toBe(false);
      expect(result.message).toContain('PRO');
    });

    it('allows create_invoice for PRO tier', async () => {
      await setUserTier('pro');
      await tools.setProfile(profileFactory.minimal());
      const result = await tools.createInvoice({
        client_name: 'Test Client',
        items: [{ description: 'Work', amount: 100 }],
      });
      expect(result.success).toBe(true);
    });
  });

  describe('export PRO gate', () => {
    it('blocks export_transactions for free tier', async () => {
      await tools.addExpense(expenseFactory.create({ amount: 50 }));
      const result = await tools.exportTransactions({ format: 'csv' });
      expect(result.success).toBe(false);
      expect(result.message).toContain('PRO');
    });

    it('blocks export_invoices for free tier', async () => {
      const result = await tools.exportInvoices({});
      expect(result.success).toBe(false);
      expect(result.message).toContain('PRO');
    });

    it('allows export_transactions for PRO tier', async () => {
      await setUserTier('pro');
      await tools.addExpense(expenseFactory.create({ amount: 50 }));
      const result = await tools.exportTransactions({ format: 'csv' });
      expect(result.success).toBe(true);
    });
  });

  describe('connection PRO gate', () => {
    it('blocks connect for free tier', async () => {
      const result = await tools.connect({});
      expect(result.success).toBe(false);
      expect(result.message).toContain('PRO');
    });

    it('blocks sync_now for free tier', async () => {
      const result = await tools.syncNow({});
      expect(result.success).toBe(false);
      expect(result.message).toContain('PRO');
    });
  });

  describe('recurring limit', () => {
    it('allows up to 3 recurring for free tier', async () => {
      for (let i = 0; i < 3; i++) {
        const result = await tools.createRecurring({
          type: 'expense',
          amount: 10,
          description: `Recurring ${i + 1}`,
          interval: 'monthly',
        });
        expect(result.success).toBe(true);
      }
    });

    it('blocks 4th recurring for free tier', async () => {
      for (let i = 0; i < 3; i++) {
        await tools.createRecurring({
          type: 'expense',
          amount: 10,
          description: `Recurring ${i + 1}`,
          interval: 'monthly',
        });
      }

      const result = await tools.createRecurring({
        type: 'expense',
        amount: 10,
        description: 'Recurring 4',
        interval: 'monthly',
      });
      expect(result.success).toBe(false);
      expect(result.message).toContain('Limit');
    });

    it('PRO users can create unlimited recurring', async () => {
      await setUserTier('pro');
      for (let i = 0; i < 5; i++) {
        const result = await tools.createRecurring({
          type: 'expense',
          amount: 10,
          description: `Recurring ${i + 1}`,
          interval: 'monthly',
        });
        expect(result.success).toBe(true);
      }
    });
  });

  describe('budget limit', () => {
    it('allows first budget for free tier', async () => {
      const result = await tools.setBudget({ amount: 500 });
      expect(result.success).toBe(true);
    });

    it('blocks second budget for free tier', async () => {
      await tools.setBudget({ amount: 500 });
      const result = await tools.setBudget({ amount: 200, category: 'IT & Software' });
      expect(result.success).toBe(false);
      expect(result.message).toContain('Budget-Limit');
    });

    it('allows updating existing budget at limit', async () => {
      await tools.setBudget({ amount: 500 });
      // Updating same budget (same period, no category) should work
      const result = await tools.setBudget({ amount: 800 });
      expect(result.success).toBe(true);
      expect(result.message).toContain('aktualisiert');
    });

    it('PRO users can create multiple budgets', async () => {
      await setUserTier('pro');
      await tools.setBudget({ amount: 500 });
      const result = await tools.setBudget({ amount: 200, category: 'IT & Software' });
      expect(result.success).toBe(true);
    });
  });
});
