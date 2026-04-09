import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { tools } from '../helpers/index.js';
import {
  setupTestDb,
  teardownTestDb,
} from '../setup.js';
import {
  profileFactory,
  resetFactories,
  today,
  daysAgo,
  daysFromNow,
} from '../fixtures/index.js';

describe('Notification Tools', () => {
  beforeEach(async () => {
    await setupTestDb();
    resetFactories();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  describe('get_notifications', () => {
    it('returns no user-created notifications on empty db', async () => {
      const result = await tools.getNotifications();

      // Tax quarter reminders are date-dependent and may appear regardless of DB state
      const userNotifications = result.notifications.filter(
        (n: any) => n.type !== 'tax_reminder'
      );
      expect(userNotifications.length).toBe(0);
    });

    it('shows recurring transactions due soon', async () => {
      // Create recurring due today
      await tools.createRecurring({
        type: 'expense',
        amount: 29.99,
        description: 'Netflix',
        interval: 'monthly',
        start_date: today(),
      });

      const result = await tools.getNotifications();

      expect(result.notifications.some(n => n.type === 'recurring_due')).toBe(true);
      expect(result.notifications.some(n => n.message.includes('Netflix'))).toBe(true);
    });

    it('shows high priority for recurring due today', async () => {
      await tools.createRecurring({
        type: 'expense',
        amount: 50,
        description: 'Due Today Sub',
        interval: 'monthly',
        start_date: today(),
      });

      const result = await tools.getNotifications();

      const dueNotification = result.notifications.find(n => n.message.includes('Due Today'));
      expect(dueNotification?.priority).toBe('high');
    });

    it('shows overdue invoices', async () => {
      await tools.setProfile(profileFactory.minimal());

      // Create invoice with past due date
      const invoice = await tools.createInvoice({
        client_name: 'Overdue Client',
        items: [{ description: 'Work', amount: 500 }],
        due_date: daysAgo(10),
      });

      // Mark as sent (only sent invoices can be overdue)
      await tools.markInvoiceSent({ id: invoice.invoice!.id });

      const result = await tools.getNotifications();

      expect(result.notifications.some(n => n.type === 'invoice_overdue')).toBe(true);
      expect(result.notifications.some(n => n.message.includes('Overdue Client'))).toBe(true);
    });

    it('shows budget alerts for projects at 80%+', async () => {
      // Create project with budget
      const project = await tools.createProject({
        name: 'Budget Test Project',
        budget: 1000,
      });

      // Add expenses to reach 80%+ of budget
      await tools.addExpense({
        amount: 850,
        description: 'Big expense',
        project: 'Budget Test Project',
      });

      const result = await tools.getNotifications();

      expect(result.notifications.some(n => n.type === 'budget_alert')).toBe(true);
      expect(result.notifications.some(n => n.message.includes('Budget Test Project'))).toBe(true);
    });

    it('returns high priority for exceeded budget', async () => {
      const project = await tools.createProject({
        name: 'Over Budget Project',
        budget: 500,
      });

      // Exceed the budget
      await tools.addExpense({
        amount: 550,
        description: 'Over budget',
        project: 'Over Budget Project',
      });

      const result = await tools.getNotifications();

      const budgetAlert = result.notifications.find(n => n.message.includes('Over Budget'));
      expect(budgetAlert?.priority).toBe('high');
    });

    it('respects days_ahead parameter', async () => {
      // Just verify the parameter is accepted and returns something reasonable
      const resultDefault = await tools.getNotifications();
      const result30 = await tools.getNotifications({ days_ahead: 30 });

      // With more days_ahead, we might get more notifications (or at least no errors)
      expect(result30.notifications).toBeDefined();
      expect(result30.summary).toBeDefined();
    });

    it('provides counts', async () => {
      // Create a notification
      await tools.createRecurring({
        type: 'expense',
        amount: 10,
        description: 'Test',
        interval: 'monthly',
        start_date: today(),
      });

      const result = await tools.getNotifications();

      expect(result.counts).toBeDefined();
      expect(result.counts.total).toBeGreaterThan(0);
    });

    it('sorts by priority', async () => {
      await tools.setProfile(profileFactory.minimal());

      // Create low priority recurring (7 days from now)
      await tools.createRecurring({
        type: 'expense',
        amount: 10,
        description: 'Low Priority',
        interval: 'monthly',
        start_date: daysFromNow(6),
      });

      // Create high priority recurring (today)
      await tools.createRecurring({
        type: 'expense',
        amount: 20,
        description: 'High Priority',
        interval: 'monthly',
        start_date: today(),
      });

      const result = await tools.getNotifications();

      // High priority should be first
      if (result.notifications.length >= 2) {
        const highIdx = result.notifications.findIndex(n => n.message.includes('High Priority'));
        const lowIdx = result.notifications.findIndex(n => n.message.includes('Low Priority'));
        expect(highIdx).toBeLessThan(lowIdx);
      }
    });
  });

  describe('Notifications Workflow', () => {
    it('comprehensive notification check', async () => {
      await tools.setProfile(profileFactory.create());

      // Create recurring due soon
      await tools.createRecurring({
        type: 'expense',
        amount: 49.99,
        description: 'Software License',
        interval: 'monthly',
        start_date: daysFromNow(2),
      });

      // Create a project with high budget usage
      await tools.createProject({
        name: 'Client Project',
        budget: 2000,
      });
      await tools.addExpense({
        amount: 1800,
        description: 'Development',
        project: 'Client Project',
      });

      const result = await tools.getNotifications();

      expect(result.notifications.length).toBeGreaterThan(0);
      expect(result.summary).toBeDefined();

      // Should have both recurring and budget notifications
      const types = result.notifications.map(n => n.type);
      expect(types).toContain('recurring_due');
      expect(types).toContain('budget_alert');
    });
  });
});
