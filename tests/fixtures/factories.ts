import { v4 as uuid } from 'uuid';

export function generateId(): string {
  return uuid();
}

export function today(): string {
  return new Date().toISOString().split('T')[0];
}

export function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split('T')[0];
}

export function daysFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

export function dateFor(year: number, month: number, day: number = 15): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// Counter for generating unique names
let counter = 0;
function nextCounter(): number {
  return ++counter;
}

export function resetFactories(): void {
  counter = 0;
}

export const incomeFactory = {
  create: (overrides: Partial<IncomeInput> = {}): IncomeInput => ({
    amount: 1000,
    description: `Consulting work #${nextCounter()}`,
    ...overrides,
  }),

  withCategory: (
    category: string,
    overrides: Partial<IncomeInput> = {}
  ): IncomeInput => ({
    ...incomeFactory.create(overrides),
    category,
  }),

  withProject: (
    project: string,
    overrides: Partial<IncomeInput> = {}
  ): IncomeInput => ({
    ...incomeFactory.create(overrides),
    project,
  }),

  onDate: (date: string, overrides: Partial<IncomeInput> = {}): IncomeInput => ({
    ...incomeFactory.create(overrides),
    date,
  }),
};

export const expenseFactory = {
  create: (overrides: Partial<ExpenseInput> = {}): ExpenseInput => ({
    amount: 50,
    description: `Software subscription #${nextCounter()}`,
    ...overrides,
  }),

  withCategory: (
    category: string,
    overrides: Partial<ExpenseInput> = {}
  ): ExpenseInput => ({
    ...expenseFactory.create(overrides),
    category,
  }),

  withProject: (
    project: string,
    overrides: Partial<ExpenseInput> = {}
  ): ExpenseInput => ({
    ...expenseFactory.create(overrides),
    project,
  }),

  onDate: (
    date: string,
    overrides: Partial<ExpenseInput> = {}
  ): ExpenseInput => ({
    ...expenseFactory.create(overrides),
    date,
  }),

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

export const projectFactory = {
  create: (overrides: Partial<ProjectInput> = {}): ProjectInput => ({
    name: `Test Project ${nextCounter()}`,
    ...overrides,
  }),

  withBudget: (
    budget: number,
    overrides: Partial<ProjectInput> = {}
  ): ProjectInput => ({
    ...projectFactory.create(overrides),
    budget,
  }),

  withDescription: (
    description: string,
    overrides: Partial<ProjectInput> = {}
  ): ProjectInput => ({
    ...projectFactory.create(overrides),
    description,
  }),
};

export const budgetFactory = {
  create: (overrides: Partial<BudgetInput> = {}): BudgetInput => ({
    amount: 500,
    ...overrides,
  }),

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

  quarterly: (
    amount: number,
    overrides: Partial<BudgetInput> = {}
  ): BudgetInput => ({
    amount,
    period: 'quarterly',
    ...overrides,
  }),

  yearly: (
    amount: number,
    overrides: Partial<BudgetInput> = {}
  ): BudgetInput => ({
    amount,
    period: 'yearly',
    ...overrides,
  }),

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

export const invoiceFactory = {
  create: (overrides: Partial<InvoiceInput> = {}): InvoiceInput => ({
    client_name: `Client ${nextCounter()}`,
    items: [{ description: 'Consulting services', amount: 1000 }],
    ...overrides,
  }),

  withItems: (
    items: Array<{ description: string; amount: number; quantity?: number }>,
    overrides: Partial<InvoiceInput> = {}
  ): InvoiceInput => ({
    client_name: `Client ${nextCounter()}`,
    items,
    ...overrides,
  }),

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

export const recurringFactory = {
  expense: (overrides: Partial<RecurringInput> = {}): RecurringInput => ({
    type: 'expense',
    amount: 29.99,
    description: `Monthly subscription #${nextCounter()}`,
    interval: 'monthly',
    ...overrides,
  }),

  income: (overrides: Partial<RecurringInput> = {}): RecurringInput => ({
    type: 'income',
    amount: 500,
    description: `Monthly retainer #${nextCounter()}`,
    interval: 'monthly',
    ...overrides,
  }),

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

export const categoryFactory = {
  income: (name?: string): CategoryInput => ({
    name: name ?? `Income Category ${nextCounter()}`,
    type: 'income',
  }),

  expense: (name?: string): CategoryInput => ({
    name: name ?? `Expense Category ${nextCounter()}`,
    type: 'expense',
  }),
};

export const profileFactory = {
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
