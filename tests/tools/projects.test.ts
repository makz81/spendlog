/**
 * Project Tool Integration Tests
 *
 * Tests for: list_projects, create_project, rename_project, delete_project
 * Critical: Tests the 3-project freemium limit enforcement
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { tools } from '../helpers/index.js';
import {
  setupTestDb,
  teardownTestDb,
  createTestProject,
  TestDataSource,
  TEST_USER_ID,
} from '../setup.js';
import { Transaction } from '../../src/entities/Transaction.js';
import {
  projectFactory,
  resetFactories,
} from '../fixtures/index.js';

describe('Project Tools', () => {
  beforeEach(async () => {
    await setupTestDb();
    resetFactories();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  describe('create_project', () => {
    it('creates a basic project', async () => {
      const input = projectFactory.create({ name: 'My SaaS' });
      const result = await tools.createProject(input);

      expect(result.success).toBe(true);
      expect(result.project.name).toBe('My SaaS');
      expect(result.project.status).toBe('active');
      expect(result.message).toContain('My SaaS');
    });

    it('creates a project with description', async () => {
      const input = projectFactory.withDescription('A productivity app', { name: 'My SaaS' });
      const result = await tools.createProject(input);

      expect(result.success).toBe(true);
      expect(result.project.description).toBe('A productivity app');
    });

    it('creates a project with budget', async () => {
      const input = projectFactory.withBudget(200, { name: 'My SaaS' });
      const result = await tools.createProject(input);

      expect(result.success).toBe(true);
      expect(result.project.budget).toBe(200);
    });

    it('creates multiple projects up to limit', async () => {
      await tools.createProject({ name: 'Project 1' });
      await tools.createProject({ name: 'Project 2' });
      const result = await tools.createProject({ name: 'Project 3' });

      expect(result.success).toBe(true);

      const listResult = await tools.listProjects({ status: 'all' });
      expect(listResult.total).toBe(3);
    });

    it('enforces 3-project limit (CRITICAL)', async () => {
      await tools.createProject({ name: 'Project 1' });
      await tools.createProject({ name: 'Project 2' });
      await tools.createProject({ name: 'Project 3' });

      // Fourth project should fail
      await expect(
        tools.createProject({ name: 'Project 4' })
      ).rejects.toThrow(/Projekt-Limit erreicht|3 Projekte/);
    });

    it('shows helpful error message when limit reached', async () => {
      await tools.createProject({ name: 'Project 1' });
      await tools.createProject({ name: 'Project 2' });
      await tools.createProject({ name: 'Project 3' });

      try {
        await tools.createProject({ name: 'Project 4' });
        expect.fail('Should have thrown');
      } catch (error) {
        expect((error as Error).message).toContain('3');
        expect((error as Error).message).toContain('Lösche ein bestehendes Projekt');
      }
    });

    it('rejects duplicate project names', async () => {
      await tools.createProject({ name: 'My SaaS' });

      await expect(
        tools.createProject({ name: 'My SaaS' })
      ).rejects.toThrow(/existiert bereits/);
    });

    it('rejects project without name', async () => {
      await expect(
        tools.createProject({ name: '' })
      ).rejects.toThrow();
    });
  });

  describe('list_projects', () => {
    it('returns empty when no projects exist', async () => {
      const result = await tools.listProjects();

      expect(result.total).toBe(0);
      expect(result.projects).toHaveLength(0);
    });

    it('lists active projects by default', async () => {
      await createTestProject({ name: 'Active Project', status: 'active' });
      await createTestProject({ name: 'Completed Project', status: 'completed' });

      const result = await tools.listProjects();

      expect(result.total).toBe(1);
      expect(result.projects[0].name).toBe('Active Project');
    });

    it('lists all projects when requested', async () => {
      await createTestProject({ name: 'Active', status: 'active' });
      await createTestProject({ name: 'Completed', status: 'completed' });
      await createTestProject({ name: 'Archived', status: 'archived' });

      const result = await tools.listProjects({ status: 'all' });

      expect(result.total).toBe(3);
    });

    it('filters by specific status', async () => {
      await createTestProject({ name: 'Active', status: 'active' });
      await createTestProject({ name: 'Completed', status: 'completed' });

      const result = await tools.listProjects({ status: 'completed' });

      expect(result.total).toBe(1);
      expect(result.projects[0].name).toBe('Completed');
    });

    it('shows project limit information', async () => {
      await tools.createProject({ name: 'Project 1' });
      await tools.createProject({ name: 'Project 2' });

      const result = await tools.listProjects({ status: 'all' });

      expect(result.limit.used).toBe(2);
      expect(result.limit.max).toBe(3);
      expect(result.limit.remaining).toBe(1);
      expect(result.limit.tier).toBe('free');
    });

    it('calculates project spending correctly', async () => {
      await tools.createProject({ name: 'My SaaS' });
      await tools.addExpense({ amount: 50, description: 'Hosting', project: 'My SaaS' });
      await tools.addExpense({ amount: 25, description: 'Domain', project: 'My SaaS' });
      await tools.addIncome({ amount: 1000, description: 'Sale', project: 'My SaaS' });

      const result = await tools.listProjects();

      expect(result.projects[0].spent).toBe(75);
      expect(result.projects[0].earned).toBe(1000);
      expect(result.projects[0].transactions).toBe(3);
    });

    it('shows formatted budget and spending', async () => {
      await tools.createProject({ name: 'My SaaS', budget: 200 });
      await tools.addExpense({ amount: 50, description: 'Test', project: 'My SaaS' });

      const result = await tools.listProjects();

      expect(result.projects[0].formatted_budget).toContain('200,00');
      expect(result.projects[0].formatted_spent).toContain('50,00');
    });
  });

  describe('rename_project', () => {
    it('renames a project', async () => {
      await tools.createProject({ name: 'OldName' });
      const result = await tools.renameProject({ project: 'OldName', new_name: 'NewName' });

      expect(result.success).toBe(true);
      expect(result.project.name).toBe('NewName');
      expect(result.message).toContain('OldName');
      expect(result.message).toContain('NewName');
    });

    it('finds project by partial name', async () => {
      await tools.createProject({ name: 'My SaaS Project' });
      const result = await tools.renameProject({ project: 'My SaaS', new_name: 'NewMy SaaS' });

      expect(result.success).toBe(true);
      expect(result.project.name).toBe('NewMy SaaS');
    });

    it('preserves transactions after rename', async () => {
      await tools.createProject({ name: 'OldName' });
      await tools.addExpense({ amount: 50, description: 'Test', project: 'OldName' });

      await tools.renameProject({ project: 'OldName', new_name: 'NewName' });

      const transactions = await tools.listTransactions({ project: 'NewName' });
      expect(transactions.total).toBe(1);
    });

    it('throws error for non-existent project', async () => {
      await expect(
        tools.renameProject({ project: 'NonExistent', new_name: 'NewName' })
      ).rejects.toThrow('nicht gefunden');
    });

    it('requires both project and new_name', async () => {
      await tools.createProject({ name: 'TestProject' });

      await expect(
        tools.renameProject({ project: '', new_name: 'NewName' })
      ).rejects.toThrow();
    });
  });

  describe('delete_project', () => {
    it('deletes a project', async () => {
      await tools.createProject({ name: 'ToDelete' });
      const result = await tools.deleteProject({ project: 'ToDelete' });

      expect(result.success).toBe(true);
      expect(result.message).toContain('gelöscht');

      // Verify deletion
      const listResult = await tools.listProjects({ status: 'all' });
      expect(listResult.total).toBe(0);
    });

    it('frees up project slot after deletion', async () => {
      await tools.createProject({ name: 'Project 1' });
      await tools.createProject({ name: 'Project 2' });
      await tools.createProject({ name: 'Project 3' });

      // At limit
      await expect(
        tools.createProject({ name: 'Project 4' })
      ).rejects.toThrow();

      // Delete one
      await tools.deleteProject({ project: 'Project 2' });

      // Now we can create a new one
      const result = await tools.createProject({ name: 'Project 4' });
      expect(result.success).toBe(true);
    });

    it('preserves transactions but removes assignment (CRITICAL)', async () => {
      await tools.createProject({ name: 'ToDelete' });
      await tools.addExpense({ amount: 50, description: 'Expense 1', project: 'ToDelete' });
      await tools.addIncome({ amount: 100, description: 'Income 1', project: 'ToDelete' });

      await tools.deleteProject({ project: 'ToDelete' });

      // Transactions should still exist
      const transactions = await tools.listTransactions();
      expect(transactions.total).toBe(2);

      // But no longer assigned to project
      expect(transactions.transactions.every((t) => t.project === null)).toBe(true);
    });

    it('verifies transactions exist in database after delete', async () => {
      await tools.createProject({ name: 'ToDelete' });
      const expense = await tools.addExpense({ amount: 50, description: 'Keep me', project: 'ToDelete' });

      await tools.deleteProject({ project: 'ToDelete' });

      // Verify directly in database
      const transactionRepo = TestDataSource.getRepository(Transaction);
      const transaction = await transactionRepo.findOne({
        where: { id: expense.transaction.id },
      });

      expect(transaction).not.toBeNull();
      expect(transaction?.projectId).toBeNull();
    });

    it('finds project by partial name', async () => {
      await tools.createProject({ name: 'My SaaS Project' });
      const result = await tools.deleteProject({ project: 'My SaaS' });

      expect(result.success).toBe(true);
    });

    it('throws error for non-existent project', async () => {
      await expect(
        tools.deleteProject({ project: 'NonExistent' })
      ).rejects.toThrow('nicht gefunden');
    });
  });

  describe('Project Workflow', () => {
    it('creates project, tracks expenses, and deletes', async () => {
      // Create project
      const createResult = await tools.createProject({ name: 'TestProject', budget: 500 });
      expect(createResult.success).toBe(true);

      // Add expenses
      await tools.addExpense({ amount: 100, description: 'Expense 1', project: 'TestProject' });
      await tools.addExpense({ amount: 150, description: 'Expense 2', project: 'TestProject' });

      // Check project status
      const listResult = await tools.listProjects();
      expect(listResult.projects[0].spent).toBe(250);
      expect(listResult.projects[0].budget).toBe(500);

      // Rename
      await tools.renameProject({ project: 'TestProject', new_name: 'RenamedProject' });

      // Verify transactions follow
      const transactions = await tools.listTransactions({ project: 'RenamedProject' });
      expect(transactions.total).toBe(2);

      // Delete
      await tools.deleteProject({ project: 'RenamedProject' });

      // Verify project gone
      const finalList = await tools.listProjects({ status: 'all' });
      expect(finalList.total).toBe(0);

      // Verify transactions preserved
      const allTransactions = await tools.listTransactions();
      expect(allTransactions.total).toBe(2);
    });

    it('manages project limit throughout lifecycle', async () => {
      // Start with 0 projects
      let list = await tools.listProjects({ status: 'all' });
      expect(list.limit.remaining).toBe(3);

      // Create 3 projects
      await tools.createProject({ name: 'P1' });
      await tools.createProject({ name: 'P2' });
      await tools.createProject({ name: 'P3' });

      list = await tools.listProjects({ status: 'all' });
      expect(list.limit.remaining).toBe(0);

      // Delete one
      await tools.deleteProject({ project: 'P2' });

      list = await tools.listProjects({ status: 'all' });
      expect(list.limit.remaining).toBe(1);

      // Create replacement
      const result = await tools.createProject({ name: 'P4' });
      expect(result.success).toBe(true);

      list = await tools.listProjects({ status: 'all' });
      expect(list.limit.remaining).toBe(0);
    });
  });
});
