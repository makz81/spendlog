/**
 * Default Project (Multi-Project Support) Tests
 *
 * Tests for: SPENDLOG_PROJECT env var, auto-assign, auto-create, dynamic descriptions
 * PRD-031: Multi-Project Support
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
import { Project } from '../../src/entities/Project.js';
import { registerTools, getDefaultProjectName } from '../../src/tools/index.js';
import { getTransactionToolDefinitions } from '../../src/tools/transactions.js';
import { resetFactories } from '../fixtures/index.js';

describe('Default Project (Multi-Project Support)', () => {
  beforeEach(async () => {
    await setupTestDb();
    resetFactories();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  describe('registerTools with project name', () => {
    it('stores default project name', () => {
      registerTools(TEST_USER_ID, 'TestProject');
      expect(getDefaultProjectName()).toBe('TestProject');
    });

    it('clears default project when not provided', () => {
      registerTools(TEST_USER_ID, 'TestProject');
      registerTools(TEST_USER_ID);
      expect(getDefaultProjectName()).toBeNull();
    });

    it('clears default project when empty string', () => {
      registerTools(TEST_USER_ID, '');
      expect(getDefaultProjectName()).toBeNull();
    });
  });

  describe('dynamic tool descriptions', () => {
    it('includes project hint when default is set', () => {
      registerTools(TEST_USER_ID, 'Spendlog');
      const defs = getTransactionToolDefinitions();

      const addIncome = defs.find(d => d.name === 'add_income');
      const addExpense = defs.find(d => d.name === 'add_expense');

      expect(addIncome?.description).toContain('Spendlog');
      expect(addExpense?.description).toContain('Spendlog');
      expect(addIncome?.description).toContain('automatisch');
      expect(addExpense?.description).toContain('automatisch');
    });

    it('has no project hint when default is not set', () => {
      registerTools(TEST_USER_ID);
      const defs = getTransactionToolDefinitions();

      const addIncome = defs.find(d => d.name === 'add_income');
      const addExpense = defs.find(d => d.name === 'add_expense');

      expect(addIncome?.description).not.toContain('automatisch');
      expect(addExpense?.description).not.toContain('automatisch');
    });

    it('does not affect list/delete/update descriptions', () => {
      registerTools(TEST_USER_ID, 'TestProject');
      const defs = getTransactionToolDefinitions();

      const list = defs.find(d => d.name === 'list_transactions');
      const del = defs.find(d => d.name === 'delete_transaction');
      const update = defs.find(d => d.name === 'update_transaction');

      expect(list?.description).not.toContain('TestProject');
      expect(del?.description).not.toContain('TestProject');
      expect(update?.description).not.toContain('TestProject');
    });
  });

  describe('auto-assign default project', () => {
    it('auto-assigns expense to default project', async () => {
      await createTestProject({ name: 'DefaultProject' });
      registerTools(TEST_USER_ID, 'DefaultProject');

      const result = await tools.addExpense({ amount: 50, description: 'Test expense' });

      expect(result.success).toBe(true);
      expect(result.transaction.project).toBe('DefaultProject');
    });

    it('auto-assigns income to default project', async () => {
      await createTestProject({ name: 'DefaultProject' });
      registerTools(TEST_USER_ID, 'DefaultProject');

      const result = await tools.addIncome({ amount: 1000, description: 'Test income' });

      expect(result.success).toBe(true);
      expect(result.transaction.project).toBe('DefaultProject');
    });

    it('explicit project overrides default', async () => {
      await createTestProject({ name: 'DefaultProject' });
      await createTestProject({ name: 'ExplicitProject' });
      registerTools(TEST_USER_ID, 'DefaultProject');

      const result = await tools.addExpense({
        amount: 50,
        description: 'Test expense',
        project: 'ExplicitProject',
      });

      expect(result.success).toBe(true);
      expect(result.transaction.project).toBe('ExplicitProject');
    });

    it('no project when default is not set and none provided', async () => {
      registerTools(TEST_USER_ID);

      const result = await tools.addExpense({ amount: 50, description: 'No project' });

      expect(result.success).toBe(true);
      expect(result.transaction.project).toBeNull();
    });
  });

  describe('auto-create project', () => {
    it('auto-creates project when default project does not exist', async () => {
      registerTools(TEST_USER_ID, 'NewAutoProject');

      const result = await tools.addExpense({ amount: 25, description: 'Auto-create test' });

      expect(result.success).toBe(true);
      expect(result.transaction.project).toBe('NewAutoProject');

      // Verify project was created in DB
      const projectRepo = TestDataSource.getRepository(Project);
      const project = await projectRepo.findOne({
        where: { userId: TEST_USER_ID, name: 'NewAutoProject' },
      });
      expect(project).not.toBeNull();
      expect(project?.status).toBe('active');
    });

    it('auto-creates project for explicit param too', async () => {
      registerTools(TEST_USER_ID);

      const result = await tools.addExpense({
        amount: 25,
        description: 'Explicit auto-create',
        project: 'BrandNewProject',
      });

      expect(result.success).toBe(true);
      expect(result.transaction.project).toBe('BrandNewProject');
    });

    it('does not duplicate existing project on auto-create', async () => {
      await createTestProject({ name: 'ExistingProject' });
      registerTools(TEST_USER_ID, 'ExistingProject');

      await tools.addExpense({ amount: 25, description: 'Test 1' });
      await tools.addExpense({ amount: 50, description: 'Test 2' });

      const projectRepo = TestDataSource.getRepository(Project);
      const projects = await projectRepo.find({
        where: { userId: TEST_USER_ID },
      });
      // Should still have only 1 project, not duplicated
      const matching = projects.filter(p => p.name === 'ExistingProject');
      expect(matching).toHaveLength(1);
    });

    it('silently skips auto-create when at project limit', async () => {
      // Create 3 projects (the free limit)
      await createTestProject({ name: 'Project 1' });
      await createTestProject({ name: 'Project 2' });
      await createTestProject({ name: 'Project 3' });

      registerTools(TEST_USER_ID, 'FourthProject');

      // Should still succeed but without project assignment
      const result = await tools.addExpense({ amount: 25, description: 'Over limit' });

      expect(result.success).toBe(true);
      expect(result.transaction.project).toBeNull();

      // Verify no 4th project was created
      const projectRepo = TestDataSource.getRepository(Project);
      const count = await projectRepo.count({ where: { userId: TEST_USER_ID } });
      expect(count).toBe(3);
    });
  });

  describe('config precedence', () => {
    it('explicit param > env var > null', async () => {
      await createTestProject({ name: 'EnvProject' });
      await createTestProject({ name: 'ExplicitProject' });
      registerTools(TEST_USER_ID, 'EnvProject');

      // Explicit param wins over env var
      const withExplicit = await tools.addExpense({
        amount: 10,
        description: 'Explicit',
        project: 'ExplicitProject',
      });
      expect(withExplicit.transaction.project).toBe('ExplicitProject');

      // Env var used when no explicit param
      const withDefault = await tools.addExpense({
        amount: 20,
        description: 'Default',
      });
      expect(withDefault.transaction.project).toBe('EnvProject');

      // No project when nothing set
      registerTools(TEST_USER_ID);
      const withNothing = await tools.addExpense({
        amount: 30,
        description: 'Nothing',
      });
      expect(withNothing.transaction.project).toBeNull();
    });
  });
});
