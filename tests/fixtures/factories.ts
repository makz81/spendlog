/**
 * Test Data Factories
 *
 * Provides factory functions for creating test data consistently.
 * All factories return data objects that can be passed to tool runners or repositories.
 */

import { v4 as uuid } from 'uuid';

/**
 * Generate a unique ID for test entities
 */
export function generateId(): string {
  return uuid();
}

/**
 * Get today's date in ISO format (YYYY-MM-DD)
 */
export function today(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Get a date in the past
 * @param days - Number of days in the past
 */
export function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split('T')[0];
}

/**
 * Get a date in the future
 * @param days - Number of days in the future
 */
export function daysFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

/**
 * Get a date for a specific month/year
 */
export function dateFor(year: number, month: number, day: number = 15): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// Counter for generating unique names
let counter = 0;
function nextCounter(): number {
  return ++counter;
}

/**
 * Reset the counter (useful for test isolation)
 */
export function resetFactories(): void {
  counter = 0;
}

/**
 * Income transaction factory
 */
export const incomeFactory = {
  /**
   * Create a basic income transaction
   */
  create: (overrides: Partial<IncomeInput> = {}): IncomeInput => ({
    amount: 1000,
    description: `Consulting work #${nextCounter()}`,
    ...overrides,
  }),

  /**
   * Create income with a specific category
   */
  withCategory: (
    category: string,
    overrides: Partial<IncomeInput> = {}
  ): IncomeInput => ({
    ...incomeFactory.create(overrides),
    category,
  }),

  /**
   * Create income assigned to a project
   */
  withProject: (
    project: string,
    overrides: Partial<IncomeInput> = {}
  ): IncomeInput => ({
    ...incomeFactory.create(overrides),
    project,
  }),

  /**
   * Create income with a specific date
   */
  onDate: (date: string, overrides: Partial<IncomeInput> = {}): IncomeInput => ({
    ...incomeFactory.create(overrides),
    date,
  }),
};

/**
 * Expense transaction factory
 */
export const expenseFactory = {
  /**
   * Create a basic expense transaction
   */
  create: (overrides: Partial<ExpenseInput> = {}): ExpenseInput => ({
    amount: 50,
    description: `Software subscription #${nextCounter()}`,
    ...overrides,
  }),

  /**
   * Create expense with a specific category
   */
  withCategory: (
    category: string,
    overrides: Partial<ExpenseInput> = {}
  ): ExpenseInput => ({
    ...expenseFactory.create(overrides),
    category,
  }),

  /**
   * Create expense assigned to a project
   */
  withProject: (
    project: string,
    overrides: Partial<ExpenseInput> = {}
  ): ExpenseInput => ({
    ...expenseFactory.create(overrides),
    project,
  }),

  /**
   * Create expense with a specific date
   */
  onDate: (
    date: string,
    overrides: Partial<ExpenseInput> = {}
  ): ExpenseInput => ({
    ...expenseFactory.create(overrides),
    date,
  }),

  /**
   * Create a series of expenses that would trigger a budget warning
   */
  toBudgetLimit: (
    amount: number,
    category?: string
  ): ExpenseInput[] => {
    const expenses: ExpenseInput[] = [];
    // Create expenses that add up to the amount
    const chunk = Math.min(amount / 3, 100);
    let remaining = amount;

    while (remaining > 0) {
      const expenseAmount = Math.min(chunk, remaining);
      expenses.push({
        amount: expenseAmount,
        description: `Budget test expense #${nextCounter()}`,
        category,
      });
      remaining -= expenseAmount;
    }

    return expenses;
  },
};

/**
 * Project factory
 */
export const projectFactory = {
  /**
   * Create a basic project
   */
  create: (overrides: Partial<ProjectInput> = {}): ProjectInput => ({
    name: `Test Project ${nextCounter()}`,
    ...overrides,
  }),

  /**
   * Create a project with a budget
   */
  withBudget: (
    budget: number,
    overrides: Partial<ProjectInput> = {}
  ): ProjectInput => ({
    ...projectFactory.create(overrides),
    budget,
  }),

  /**
   * Create a project with description
   */
  withDescription: (
    description: string,
    overrides: Partial<ProjectInput> = {}
  ): ProjectInput => ({
    ...projectFactory.create(overrides),
    description,
  }),
};

/**
 * Budget factory
 */
export const budgetFactory = {
  /**
   * Create a basic monthly budget
   */
  create: (overrides: Partial<BudgetInput> = {}): BudgetInput => ({
    amount: 500,
    ...overrides,
  }),

  /**
   * Create a budget for a specific category
   */
  forCategory: (
    category: string,
    amount: number = 200,
    overrides: Partial<BudgetInput> = {}
  ): BudgetInput => ({
    amount,
    category,
    name: `${category} Budget`,
    ...overrides,
  }),

  /**
   * Create a quarterly budget
   */
  quarterly: (
    amount: number,
    overrides: Partial<BudgetInput> = {}
  ): BudgetInput => ({
    amount,
    period: 'quarterly',
    ...overrides,
  }),

  /**
   * Create a yearly budget
   */
  yearly: (
    amount: number,
    overrides: Partial<BudgetInput> = {}
  ): BudgetInput => ({
    amount,
    period: 'yearly',
    ...overrides,
  }),

  /**
   * Create a budget with custom alert threshold
   */
  withThreshold: (
    amount: number,
    threshold: number,
    overrides: Partial<BudgetInput> = {}
  ): BudgetInput => ({
    amount,
    alert_threshold: threshold,
    ...overrides,
  }),
};

/**
 * Invoice factory
 */
export const invoiceFactory = {
  /**
   * Create a basic invoice
   */
  create: (overrides: Partial<InvoiceInput> = {}): InvoiceInput => ({
    client_name: `Client ${nextCounter()}`,
    items: [{ description: 'Consulting services', amount: 1000 }],
    ...overrides,
  }),

  /**
   * Create an invoice with multiple items
   */
  withItems: (
    items: Array<{ description: string; amount: number; quantity?: number }>,
    overrides: Partial<InvoiceInput> = {}
  ): InvoiceInput => ({
    client_name: `Client ${nextCounter()}`,
    items,
    ...overrides,
  }),

  /**
   * Create an invoice with full details
   */
  detailed: (overrides: Partial<InvoiceInput> = {}): InvoiceInput => ({
    client_name: `Enterprise Client ${nextCounter()}`,
    client_address: '123 Business St\n12345 City',
    items: [
      { description: 'Development work', amount: 150, quantity: 10 },
      { description: 'Consulting', amount: 200, quantity: 5 },
    ],
    date: today(),
    due_date: daysFromNow(14),
    notes: 'Payment within 14 days',
    ...overrides,
  }),
};

/**
 * Recurring transaction factory
 */
export const recurringFactory = {
  /**
   * Create a basic recurring expense
   */
  expense: (overrides: Partial<RecurringInput> = {}): RecurringInput => ({
    type: 'expense',
    amount: 29.99,
    description: `Monthly subscription #${nextCounter()}`,
    interval: 'monthly',
    ...overrides,
  }),

  /**
   * Create a basic recurring income
   */
  income: (overrides: Partial<RecurringInput> = {}): RecurringInput => ({
    type: 'income',
    amount: 500,
    description: `Monthly retainer #${nextCounter()}`,
    interval: 'monthly',
    ...overrides,
  }),

  /**
   * Create a quarterly recurring transaction
   */
  quarterly: (
    type: 'income' | 'expense',
    amount: number,
    overrides: Partial<RecurringInput> = {}
  ): RecurringInput => ({
    type,
    amount,
    description: `Quarterly payment #${nextCounter()}`,
    interval: 'quarterly',
    ...overrides,
  }),

  /**
   * Create a yearly recurring transaction
   */
  yearly: (
    type: 'income' | 'expense',
    amount: number,
    overrides: Partial<RecurringInput> = {}
  ): RecurringInput => ({
    type,
    amount,
    description: `Yearly payment #${nextCounter()}`,
    interval: 'yearly',
    ...overrides,
  }),
};

/**
 * Category factory
 */
export const categoryFactory = {
  /**
   * Create an income category
   */
  income: (name?: string): CategoryInput => ({
    name: name ?? `Income Category ${nextCounter()}`,
    type: 'income',
  }),

  /**
   * Create an expense category
   */
  expense: (name?: string): CategoryInput => ({
    name: name ?? `Expense Category ${nextCounter()}`,
    type: 'expense',
  }),
};

/**
 * Profile factory - using actual API field names
 */
export const profileFactory = {
  /**
   * Create a complete business profile (requires company_name and address)
   */
  create: (overrides: Partial<ProfileInput> = {}): ProfileInput => ({
    company_name: 'Test Business GmbH',
    address: 'Teststraße 123\n12345 Berlin',
    tax_id: 'DE123456789',
    is_kleinunternehmer: false,
    bank_details: 'DE89370400440532013000 / Deutsche Bank',
    email: 'test@business.de',
    phone: '+49 123 456789',
    ...overrides,
  }),

  /**
   * Create a minimal profile (required fields only)
   */
  minimal: (overrides: Partial<ProfileInput> = {}): ProfileInput => ({
    company_name: 'Minimal Business',
    address: 'Test Address 1\n12345 City',
    ...overrides,
  }),
};

// Input types
interface IncomeInput {
  amount: number;
  description: string;
  category?: string;
  date?: string;
  project?: string;
}

interface ExpenseInput {
  amount: number;
  description: string;
  category?: string;
  date?: string;
  project?: string;
}

interface ProjectInput {
  name: string;
  description?: string;
  budget?: number;
}

interface BudgetInput {
  amount: number;
  period?: 'monthly' | 'quarterly' | 'yearly';
  category?: string;
  name?: string;
  alert_threshold?: number;
}

interface InvoiceInput {
  client_name: string;
  items: Array<{ description: string; amount: number; quantity?: number }>;
  client_address?: string;
  date?: string;
  due_date?: string;
  notes?: string;
}

interface RecurringInput {
  type: 'income' | 'expense';
  amount: number;
  description: string;
  interval: 'monthly' | 'quarterly' | 'yearly';
  category?: string;
  start_date?: string;
  project?: string;
}

interface CategoryInput {
  name: string;
  type: 'income' | 'expense';
}

interface ProfileInput {
  company_name: string;
  address: string;
  tax_id?: string;
  is_kleinunternehmer?: boolean;
  bank_details?: string;
  phone?: string;
  email?: string;
}
