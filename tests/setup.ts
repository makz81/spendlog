/**
 * Test Setup
 * Provides test database and utilities for all tests
 */
import { DataSource } from 'typeorm';
import { User } from '../src/entities/User.js';
import { Profile } from '../src/entities/Profile.js';
import { Category } from '../src/entities/Category.js';
import { Transaction } from '../src/entities/Transaction.js';
import { Invoice } from '../src/entities/Invoice.js';
import { Recurring } from '../src/entities/Recurring.js';
import { Project } from '../src/entities/Project.js';
import { SyncQueue } from '../src/entities/SyncQueue.js';
import { Budget } from '../src/entities/Budget.js';
import { registerTools } from '../src/tools/index.js';
import { setDataSource, resetDataSource } from '../src/db/index.js';

// Test database - in-memory SQLite
export const TestDataSource = new DataSource({
  type: 'better-sqlite3',
  database: ':memory:',
  entities: [User, Profile, Category, Transaction, Invoice, Recurring, Project, SyncQueue, Budget],
  synchronize: true,
  logging: false,
});

// Test user ID
export const TEST_USER_ID = 'test-user-00000000-0000-0000-0000-000000000001';

/**
 * Initialize test database and seed with default data.
 * This sets the test data source as the active data source
 * so that tool calls use the test DB instead of production.
 */
export async function setupTestDb(): Promise<DataSource> {
  if (!TestDataSource.isInitialized) {
    await TestDataSource.initialize();
  }

  // Set the test data source as active
  setDataSource(TestDataSource);

  // Clear all tables (order matters due to foreign keys)
  // First clear entities that reference other entities
  await TestDataSource.getRepository(SyncQueue).clear();
  await TestDataSource.getRepository(Transaction).clear();
  await TestDataSource.getRepository(Invoice).clear();
  await TestDataSource.getRepository(Recurring).clear();
  await TestDataSource.getRepository(Budget).clear();
  // Then clear the referenced entities
  await TestDataSource.getRepository(Category).clear();
  await TestDataSource.getRepository(Profile).clear();
  await TestDataSource.getRepository(Project).clear();
  await TestDataSource.getRepository(User).clear();

  // Create test user
  const userRepo = TestDataSource.getRepository(User);
  await userRepo.save({
    id: TEST_USER_ID,
    name: 'Test User',
    isDefault: true,
  });

  // Seed default categories
  await seedTestCategories();

  // Register tools with test user
  registerTools(TEST_USER_ID);

  return TestDataSource;
}

/**
 * Seed default categories for testing
 */
async function seedTestCategories(): Promise<void> {
  const categoryRepo = TestDataSource.getRepository(Category);

  const incomeCategories = [
    'Dienstleistung',
    'Produktverkauf',
    'Affiliate/Provision',
    'Sonstiges',
  ];

  const expenseCategories = [
    'IT & Software',
    'Marketing & Werbung',
    'Büro & Material',
    'Reisen & Transport',
    'Weiterbildung',
    'Telefon & Internet',
    'Versicherungen',
    'Sonstiges',
  ];

  for (const name of incomeCategories) {
    await categoryRepo.save({
      name,
      type: 'income',
      isDefault: true,
    });
  }

  for (const name of expenseCategories) {
    await categoryRepo.save({
      name,
      type: 'expense',
      isDefault: true,
    });
  }
}

/**
 * Close test database and reset to production data source
 */
export async function teardownTestDb(): Promise<void> {
  resetDataSource();
  if (TestDataSource.isInitialized) {
    await TestDataSource.destroy();
  }
}

/**
 * Helper to create a test transaction directly in DB
 */
export async function createTestTransaction(data: {
  type: 'income' | 'expense';
  amount: number;
  description: string;
  date?: Date;
  categoryId?: string;
  projectId?: string;
}): Promise<Transaction> {
  const transactionRepo = TestDataSource.getRepository(Transaction);

  const transaction = transactionRepo.create({
    userId: TEST_USER_ID,
    type: data.type,
    amount: data.amount,
    description: data.description,
    date: data.date || new Date(),
    categoryId: data.categoryId,
    projectId: data.projectId,
  });

  return transactionRepo.save(transaction);
}

/**
 * Helper to create a test project directly in DB
 */
export async function createTestProject(data: {
  name: string;
  description?: string;
  budget?: number;
  status?: 'active' | 'completed' | 'archived';
}): Promise<Project> {
  const projectRepo = TestDataSource.getRepository(Project);

  const project = projectRepo.create({
    userId: TEST_USER_ID,
    name: data.name,
    description: data.description,
    budget: data.budget,
    status: data.status || 'active',
  });

  return projectRepo.save(project);
}

/**
 * Helper to create a test budget directly in DB
 */
export async function createTestBudget(data: {
  amount: number;
  period?: 'monthly' | 'quarterly' | 'yearly';
  categoryId?: string;
  name?: string;
  alertThreshold?: number;
  active?: boolean;
}): Promise<Budget> {
  const budgetRepo = TestDataSource.getRepository(Budget);

  const budget = budgetRepo.create({
    userId: TEST_USER_ID,
    amount: data.amount,
    period: data.period || 'monthly',
    categoryId: data.categoryId,
    name: data.name,
    alertThreshold: data.alertThreshold ?? 80,
    active: data.active ?? true,
  });

  return budgetRepo.save(budget);
}

/**
 * Helper to create a test invoice directly in DB
 */
export async function createTestInvoice(data: {
  invoiceNumber?: string;
  clientName: string;
  clientAddress?: string;
  items: string;
  total: number;
  status?: 'draft' | 'sent' | 'paid' | 'cancelled';
  date?: Date;
  dueDate?: Date;
  notes?: string;
}): Promise<Invoice> {
  const invoiceRepo = TestDataSource.getRepository(Invoice);

  const invoice = invoiceRepo.create({
    userId: TEST_USER_ID,
    invoiceNumber: data.invoiceNumber || `INV-${Date.now()}`,
    clientName: data.clientName,
    clientAddress: data.clientAddress,
    items: data.items,
    total: data.total,
    status: data.status || 'draft',
    date: data.date || new Date(),
    dueDate: data.dueDate || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    notes: data.notes,
  });

  return invoiceRepo.save(invoice);
}

/**
 * Helper to create a test recurring transaction directly in DB
 */
export async function createTestRecurring(data: {
  type: 'income' | 'expense';
  amount: number;
  description: string;
  interval: 'monthly' | 'quarterly' | 'yearly';
  categoryId?: string;
  projectId?: string;
  nextDate?: Date;
  active?: boolean;
}): Promise<Recurring> {
  const recurringRepo = TestDataSource.getRepository(Recurring);

  const recurring = recurringRepo.create({
    userId: TEST_USER_ID,
    type: data.type,
    amount: data.amount,
    description: data.description,
    interval: data.interval,
    categoryId: data.categoryId,
    projectId: data.projectId,
    nextDate: data.nextDate || new Date(),
    active: data.active ?? true,
  });

  return recurringRepo.save(recurring);
}

/**
 * Helper to get a category by name and type
 */
export async function getTestCategory(
  name: string,
  type: 'income' | 'expense'
): Promise<Category | null> {
  const categoryRepo = TestDataSource.getRepository(Category);
  return categoryRepo.findOne({ where: { name, type } });
}

/**
 * Helper to get transaction count
 */
export async function getTransactionCount(): Promise<number> {
  const transactionRepo = TestDataSource.getRepository(Transaction);
  return transactionRepo.count({ where: { userId: TEST_USER_ID } });
}

/**
 * Helper to get all transactions for test user
 */
export async function getAllTransactions(): Promise<Transaction[]> {
  const transactionRepo = TestDataSource.getRepository(Transaction);
  return transactionRepo.find({
    where: { userId: TEST_USER_ID },
    relations: ['category', 'project'],
    order: { date: 'DESC' },
  });
}

/**
 * Helper to set user tier (free/pro) for testing freemium gates
 */
export async function setTestUserTier(tier: 'free' | 'pro'): Promise<void> {
  const userRepo = TestDataSource.getRepository(User);
  await userRepo.update(TEST_USER_ID, { tier });
}

/**
 * Helper to get sync queue entries
 */
export async function getSyncQueue(): Promise<SyncQueue[]> {
  const syncQueueRepo = TestDataSource.getRepository(SyncQueue);
  return syncQueueRepo.find({ order: { createdAt: 'ASC' } });
}
