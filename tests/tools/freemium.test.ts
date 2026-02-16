/**
 * Freemium Gate Tests
 *
 * Tests for: feature gates (invoice, export, connection, recurring), budget limits, PRO bypass
 * NOTE: These tests enable SPENDLOG_FREEMIUM=true via vi.stubEnv to test gate behavior.
 */
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';

// Enable freemium BEFORE importing modules that read the env var
vi.stubEnv('SPENDLOG_FREEMIUM', 'true');

// Dynamic imports so they pick up the stubbed env
const { tools } = await import('../helpers/index.js');
const { setupTestDb, teardownTestDb, TEST_USER_ID, TestDataSource } = await import(
  '../setup.js'
);
const { expenseFactory, profileFactory, resetFactories } = await import(
  '../fixtures/index.js'
);
const { User } = await import('../../src/entities/User.js');

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
    vi.unstubAllEnvs();
    await teardownTestDb();
  });

  describe('transaction limit', () => {
    it('allows transactions under limit', async () => {
      const result = await tools.addExpense(
        expenseFactory.create({ amount: 50, description: 'Normal expense' })
      );
      expect(result.success).toBe(true);
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
    it('allows up to 5 recurring for free tier', async () => {
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

    it('blocks 6th recurring for free tier', async () => {
      for (let i = 0; i < 5; i++) {
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
        description: 'Recurring 6',
        interval: 'monthly',
      });
      expect(result.success).toBe(false);
      expect(result.message).toContain('Limit');
    });

    it('PRO users can create unlimited recurring', async () => {
      await setUserTier('pro');
      for (let i = 0; i < 7; i++) {
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
    it('allows up to 3 budgets for free tier', async () => {
      const r1 = await tools.setBudget({ amount: 500 });
      expect(r1.success).toBe(true);
      const r2 = await tools.setBudget({ amount: 200, category: 'IT & Software' });
      expect(r2.success).toBe(true);
      const r3 = await tools.setBudget({ amount: 100, category: 'Marketing & Werbung' });
      expect(r3.success).toBe(true);
    });

    it('blocks 4th budget for free tier', async () => {
      await tools.setBudget({ amount: 500 });
      await tools.setBudget({ amount: 200, category: 'IT & Software' });
      await tools.setBudget({ amount: 100, category: 'Marketing & Werbung' });
      const result = await tools.setBudget({ amount: 50, category: 'Reisen & Transport' });
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
      await tools.setBudget({ amount: 200, category: 'IT & Software' });
      await tools.setBudget({ amount: 100, category: 'Marketing & Werbung' });
      const result = await tools.setBudget({ amount: 50, category: 'Reisen & Transport' });
      expect(result.success).toBe(true);
    });
  });
});
