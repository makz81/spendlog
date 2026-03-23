import {
  addIncome,
  addExpense,
  listTransactions,
  deleteTransaction,
  updateTransaction,
} from '../../src/tools/transactions.js';
import {
  getSummary,
  getCategoryBreakdown,
  comparePeriods,
  getTaxSummary,
} from '../../src/tools/summary.js';
import { getProfile, setProfile } from '../../src/tools/profile.js';
import {
  createInvoice,
  listInvoices,
  getInvoice,
  markInvoiceSent,
  markInvoicePaid,
  duplicateInvoice,
} from '../../src/tools/invoice.js';
import {
  exportTransactions,
  exportInvoices,
  exportForTaxAdvisor,
} from '../../src/tools/export.js';
import {
  listCategories,
  addCategory,
  deleteCategory,
} from '../../src/tools/categories.js';
import {
  createRecurring,
  listRecurring,
  deleteRecurring,
  processRecurring,
} from '../../src/tools/recurring.js';
import {
  connect,
  connectionStatus,
  disconnect,
  syncStatus,
  syncNow,
} from '../../src/tools/connection.js';
import { getNotifications } from '../../src/tools/notifications.js';
import {
  setBudget,
  getBudgetStatus,
  listBudgets,
  deleteBudget,
  updateBudget,
} from '../../src/tools/budget.js';
import {
  listProjects,
  renameProject,
  createProject,
  deleteProject,
} from '../../src/tools/projects.js';

type ToolHandler = (args: Record<string, unknown>) => Promise<unknown>;

const toolHandlers: Record<string, ToolHandler> = {
  // Transactions
  add_income: addIncome,
  add_expense: addExpense,
  list_transactions: listTransactions,
  delete_transaction: deleteTransaction,
  update_transaction: updateTransaction,
  // Summary
  get_summary: getSummary,
  get_category_breakdown: getCategoryBreakdown,
  compare_periods: comparePeriods,
  get_tax_summary: getTaxSummary,
  // Profile
  get_profile: getProfile,
  set_profile: setProfile,
  // Invoices
  create_invoice: createInvoice,
  list_invoices: listInvoices,
  get_invoice: getInvoice,
  mark_invoice_sent: markInvoiceSent,
  mark_invoice_paid: markInvoicePaid,
  duplicate_invoice: duplicateInvoice,
  // Export
  export_transactions: exportTransactions,
  export_invoices: exportInvoices,
  export_for_tax_advisor: exportForTaxAdvisor,
  // Categories
  list_categories: listCategories,
  add_category: addCategory,
  delete_category: deleteCategory,
  // Recurring
  create_recurring: createRecurring,
  list_recurring: listRecurring,
  delete_recurring: deleteRecurring,
  process_recurring: processRecurring,
  // Connection
  connect: connect,
  connection_status: connectionStatus,
  disconnect: disconnect,
  // Sync
  sync_status: syncStatus,
  sync_now: syncNow,
  // Notifications
  get_notifications: getNotifications,
  // Budgets
  set_budget: setBudget,
  get_budget_status: getBudgetStatus,
  list_budgets: listBudgets,
  delete_budget: deleteBudget,
  update_budget: updateBudget,
  // Projects
  list_projects: listProjects,
  rename_project: renameProject,
  create_project: createProject,
  delete_project: deleteProject,
};

export async function runTool<T = unknown>(
  toolName: string,
  args: Record<string, unknown> = {}
): Promise<T> {
  const handler = toolHandlers[toolName];

  if (!handler) {
    throw new Error(`Unknown tool: ${toolName}`);
  }

  return (await handler(args)) as T;
}

export const tools = {
  // Transactions
  addIncome: (args: {
    amount: number;
    description: string;
    category?: string;
    date?: string;
    project?: string;
  }) => runTool<TransactionResponse>('add_income', args),

  addExpense: (args: {
    amount: number;
    description: string;
    category?: string;
    date?: string;
    project?: string;
  }) => runTool<ExpenseResponse>('add_expense', args),

  listTransactions: (args?: {
    type?: 'income' | 'expense' | 'all';
    from_date?: string;
    to_date?: string;
    category?: string;
    project?: string;
    limit?: number;
  }) => runTool<ListTransactionsResponse>('list_transactions', args ?? {}),

  deleteTransaction: (args: { id: string }) =>
    runTool<SuccessResponse>('delete_transaction', args),

  updateTransaction: (args: {
    id: string;
    amount?: number;
    description?: string;
    category?: string;
    date?: string;
    project?: string;
  }) => runTool<UpdateTransactionResponse>('update_transaction', args),

  // Summary
  getSummary: (args?: { period?: string; date?: string }) =>
    runTool<SummaryResponse>('get_summary', args ?? {}),

  getCategoryBreakdown: (args: {
    type: 'income' | 'expense';
    period?: string;
    date?: string;
  }) => runTool<CategoryBreakdownResponse>('get_category_breakdown', args),

  comparePeriods: (args: {
    period: 'month' | 'quarter' | 'year';
    current_date?: string;
    compare_date?: string;
  }) => runTool<ComparePeriodsResponse>('compare_periods', args),

  getTaxSummary: (args: { year: number; quarter?: number }) =>
    runTool<TaxSummaryResponse>('get_tax_summary', args),

  // Profile
  getProfile: () => runTool<ProfileGetResponse>('get_profile', {}),

  setProfile: (args: {
    company_name: string;
    address: string;
    tax_id?: string;
    is_kleinunternehmer?: boolean;
    bank_details?: string;
    email?: string;
    phone?: string;
  }) => runTool<ProfileSetResponse>('set_profile', args),

  // Invoices
  createInvoice: (args: {
    client_name: string;
    items: Array<{ description: string; amount: number; quantity?: number }>;
    client_address?: string;
    date?: string;
    due_date?: string;
    notes?: string;
  }) => runTool<InvoiceResponse>('create_invoice', args),

  listInvoices: (args?: { status?: string; limit?: number }) =>
    runTool<ListInvoicesResponse>('list_invoices', args ?? {}),

  getInvoice: (args: { id: string; format?: string }) =>
    runTool<InvoiceDetailResponse>('get_invoice', args),

  markInvoiceSent: (args: { id: string }) =>
    runTool<InvoiceResponse>('mark_invoice_sent', args),

  markInvoicePaid: (args: { id: string; date?: string }) =>
    runTool<InvoiceResponse>('mark_invoice_paid', args),

  duplicateInvoice: (args: { id: string; client_name?: string }) =>
    runTool<InvoiceResponse>('duplicate_invoice', args),

  // Export
  exportTransactions: (args?: {
    format?: string;
    from_date?: string;
    to_date?: string;
    type?: string;
  }) => runTool<ExportResponse>('export_transactions', args ?? {}),

  exportInvoices: (args?: {
    format?: string;
    from_date?: string;
    to_date?: string;
    status?: string;
  }) => runTool<ExportResponse>('export_invoices', args ?? {}),

  exportForTaxAdvisor: (args: { year: number; quarter?: number }) =>
    runTool<TaxExportResponse>('export_for_tax_advisor', args),

  // Categories
  listCategories: (args?: { type?: 'income' | 'expense' | 'all' }) =>
    runTool<ListCategoriesResponse>('list_categories', args ?? {}),

  addCategory: (args: { name: string; type: 'income' | 'expense' }) =>
    runTool<CategoryResponse>('add_category', args),

  deleteCategory: (args: { id: string }) =>
    runTool<SuccessResponse>('delete_category', args),

  // Recurring
  createRecurring: (args: {
    type: 'income' | 'expense';
    amount: number;
    description: string;
    interval: 'monthly' | 'quarterly' | 'yearly';
    category?: string;
    start_date?: string;
    project?: string;
  }) => runTool<RecurringResponse>('create_recurring', args),

  listRecurring: (args?: { type?: 'income' | 'expense' | 'all' }) =>
    runTool<ListRecurringResponse>('list_recurring', args ?? {}),

  deleteRecurring: (args: { id: string }) =>
    runTool<SuccessResponse>('delete_recurring', args),

  processRecurring: () =>
    runTool<ProcessRecurringResponse>('process_recurring', {}),

  // Connection
  connect: (args: { email: string; password: string }) =>
    runTool<ConnectionResponse>('connect', args),

  connectionStatus: () =>
    runTool<ConnectionStatusResponse>('connection_status', {}),

  disconnect: () => runTool<SuccessResponse>('disconnect', {}),

  // Sync
  syncStatus: () => runTool<SyncStatusResponse>('sync_status', {}),

  syncNow: () => runTool<SyncResponse>('sync_now', {}),

  // Notifications
  getNotifications: () =>
    runTool<NotificationsResponse>('get_notifications', {}),

  // Budgets
  setBudget: (args: {
    amount: number;
    period?: 'monthly' | 'quarterly' | 'yearly';
    category?: string;
    name?: string;
    alert_threshold?: number;
  }) => runTool<BudgetResponse>('set_budget', args),

  getBudgetStatus: (args?: { category?: string }) =>
    runTool<BudgetStatusResponse>('get_budget_status', args ?? {}),

  listBudgets: (args?: { active_only?: boolean }) =>
    runTool<ListBudgetsResponse>('list_budgets', args ?? {}),

  deleteBudget: (args: { id: string }) =>
    runTool<SuccessResponse>('delete_budget', args),

  updateBudget: (args: {
    id: string;
    amount?: number;
    name?: string;
    alert_threshold?: number;
    active?: boolean;
  }) => runTool<BudgetResponse>('update_budget', args),

  // Projects
  listProjects: (args?: {
    status?: 'active' | 'completed' | 'archived' | 'all';
  }) => runTool<ListProjectsResponse>('list_projects', args ?? {}),

  createProject: (args: {
    name: string;
    description?: string;
    budget?: number;
  }) => runTool<ProjectResponse>('create_project', args),

  renameProject: (args: { project: string; new_name: string }) =>
    runTool<ProjectResponse>('rename_project', args),

  deleteProject: (args: { project: string }) =>
    runTool<SuccessResponse>('delete_project', args),
};

// Response types
interface SuccessResponse {
  success: boolean;
  message: string;
}

interface TransactionResponse extends SuccessResponse {
  transaction: {
    id: string;
    type: 'income' | 'expense';
    amount: number;
    description: string;
    category: string;
    project: string | null;
    date: string;
  };
}

interface ExpenseResponse extends TransactionResponse {
  budget_warning?: string;
  budget_status?: unknown;
}

interface UpdateTransactionResponse extends SuccessResponse {
  changes?: string[];
  transaction: {
    id: string;
    type: string;
    amount: number;
    description: string;
    project: string | null;
    date: string;
  };
}

interface ListTransactionsResponse {
  transactions: Array<{
    id: string;
    type: 'income' | 'expense';
    amount: number;
    description: string;
    category: string;
    project: string | null;
    date: string;
    formatted_amount: string;
  }>;
  total: number;
  summary: {
    income: string;
    expenses: string;
    net: string;
  };
}

interface SummaryResponse {
  period: string;
  income: { total: number; formatted: string; count: number; by_category: Record<string, string> };
  expenses: { total: number; formatted: string; count: number; by_category: Record<string, string> };
  net: { total: number; formatted: string; positive: boolean };
  transaction_count: number;
}

interface CategoryBreakdownResponse {
  type: string;
  period: string;
  total: string;
  categories: Array<{
    name: string;
    total: number;
    formatted: string;
    percentage: number;
    formatted_percentage: string;
  }>;
}

interface ComparePeriodsResponse {
  comparison: { current_period: string; compare_period: string };
  income: {
    current: string;
    previous: string;
    change: string;
    change_absolute: string;
    change_percentage: string;
    direction: 'up' | 'down' | 'same';
  };
  expenses: {
    current: string;
    previous: string;
    change: string;
    change_absolute: string;
    change_percentage: string;
    direction: 'up' | 'down' | 'same';
  };
  net: {
    current: string;
    previous: string;
    change: string;
    change_absolute: string;
    change_percentage: string;
    direction: 'up' | 'down' | 'same';
  };
  ratio: {
    current: string;
    previous: string;
    health: string;
  };
  transaction_count: { current: number; previous: number };
  top_expenses_current: Array<{ description: string; amount: number; category: string }>;
}

interface TaxSummaryResponse {
  jahr: number;
  zeitraum: string;
  einnahmen_ueberschuss_rechnung: {
    betriebseinnahmen: {
      gesamt: number;
      formatted: string;
      nach_kategorie: Array<{ kategorie: string; betrag: number; formatted: string }>;
    };
    betriebsausgaben: {
      gesamt: number;
      formatted: string;
      nach_kategorie: Array<{ kategorie: string; betrag: number; formatted: string }>;
    };
    gewinn_verlust: {
      betrag: number;
      formatted: string;
      status: 'Gewinn' | 'Verlust';
    };
  };
  quartale: Array<{
    quartal: string;
    einnahmen: string;
    ausgaben: string;
    ergebnis: string;
    einnahmen_raw: number;
    ausgaben_raw: number;
    ergebnis_raw: number;
  }>;
  hinweis: string;
  export_tipp: string;
}

interface ProfileGetResponse {
  exists: boolean;
  message?: string;
  profile?: {
    company_name: string;
    address: string;
    tax_id?: string | null;
    is_kleinunternehmer: boolean;
    bank_details?: string | null;
    email?: string | null;
    phone?: string | null;
  };
}

interface ProfileSetResponse {
  success: boolean;
  message: string;
  profile: {
    company_name: string;
    address: string;
    tax_id?: string | null;
    is_kleinunternehmer: boolean;
    bank_details?: string | null;
    email?: string | null;
    phone?: string | null;
  };
}

interface InvoiceResponse {
  success: boolean;
  message?: string;
  error?: string;
  invoice?: {
    id: string;
    number: string;
    client: string;
    status: string;
    total: string;
    date: string;
    pdf_generated?: boolean;
  };
  original?: {
    number: string;
  };
}

interface InvoiceDetailResponse {
  id: string;
  number: string;
  client: {
    name: string;
    address: string | null;
  };
  items: Array<{
    description: string;
    quantity: number;
    unit_price: string;
    total: string;
  }>;
  total: string;
  date: string;
  due_date: string | null;
  notes: string | null;
  status: string;
  status_de: string;
  has_pdf: boolean;
}

interface ListInvoicesResponse {
  invoices: Array<{
    id: string;
    number: string;
    client: string;
    status: string;
    status_de: string;
    total: string;
    date: string;
  }>;
  total: number;
  summary: {
    total_value: string;
    draft: number;
    sent: number;
    paid: number;
  };
}

interface ExportResponse {
  success: boolean;
  message: string;
  export?: {
    format: string;
    filename: string;
    path: string;
    transactions?: number;
    invoices?: number;
    total_value?: string;
    summary?: {
      einnahmen: string;
      ausgaben: string;
      saldo: string;
    };
    by_status?: {
      entwurf: number;
      versendet: number;
      bezahlt: number;
    };
  };
}

interface TaxExportResponse {
  success: boolean;
  message: string;
  disclaimer?: string;
  export?: {
    format: string;
    filename: string;
    path: string;
    zeitraum: string;
    kontenrahmen: string;
  };
  zusammenfassung?: {
    transaktionen: number;
    einnahmen: string;
    ausgaben: string;
    gewinn: string;
    einnahmen_kategorien: number;
    ausgaben_kategorien: number;
    euer_zeilen_einnahmen: number;
    euer_zeilen_ausgaben: number;
  };
}

interface ListCategoriesResponse {
  total: number;
  einnahmen: Array<{
    id: string;
    name: string;
    standard: boolean;
  }>;
  ausgaben: Array<{
    id: string;
    name: string;
    standard: boolean;
  }>;
}

interface CategoryResponse {
  success: boolean;
  message?: string;
  error?: string;
  category?: {
    id: string;
    name: string;
    type: string;
  };
}

interface RecurringResponse {
  success: boolean;
  message: string;
  recurring?: {
    id: string;
    type: string;
    amount: string;
    description: string;
    interval: string;
    next_due: string;
  };
}

interface ListRecurringResponse {
  recurring: Array<{
    id: string;
    type: string;
    amount: string;
    description: string;
    category: string;
    interval: string;
    next_due: string;
    active: boolean;
  }>;
  total: number;
  monthly_projection: {
    income: string;
    expenses: string;
    net: string;
  };
}

interface ProcessRecurringResponse {
  success: boolean;
  message: string;
  processed: number;
  transactions?: Array<{ description: string; amount: string; type: string }>;
}

interface ConnectionResponse {
  success: boolean;
  message: string;
  connect_url?: string;
  instructions?: string[];
  hint?: string;
  error?: string;
}

interface ConnectionStatusResponse {
  connected: boolean;
  message?: string;
  local_only?: boolean;
  hint?: string;
  features_available_after_connect?: string[];
  user_id?: string;
  dashboard_url?: string;
}

interface SyncStatusResponse {
  connected: boolean;
  message?: string;
  hint?: string;
  last_sync?: string;
  stats?: {
    pending: number;
    synced?: number;
    errors?: number;
  };
}

interface SyncResponse {
  success: boolean;
  message: string;
  hint?: string;
  stats?: {
    processed: number;
    succeeded: number;
    failed: number;
  };
}

interface NotificationsResponse {
  notifications: Array<{
    type: string;
    title: string;
    message: string;
    priority: 'high' | 'medium' | 'low';
    data: Record<string, unknown>;
  }>;
  summary: string;
  counts?: {
    total: number;
    high: number;
    medium: number;
    low: number;
  };
}

interface BudgetResponse extends SuccessResponse {
  budget: {
    id: string;
    name?: string;
    amount: number;
    period: string;
    category?: string;
    alert_threshold: number;
    active: boolean;
  };
}

interface BudgetStatusResponse {
  budgets: Array<{
    id: string;
    name?: string;
    amount: string;
    spent: string;
    remaining: string;
    percentage: number;
    status: 'ok' | 'warning' | 'exceeded';
    category?: string;
    period: string;
  }>;
}

interface ListBudgetsResponse {
  budgets: Array<{
    id: string;
    name?: string;
    amount: number;
    period: string;
    category?: string;
    alert_threshold: number;
    active: boolean;
  }>;
  total: number;
}

interface ProjectResponse extends SuccessResponse {
  project: {
    id: string;
    name: string;
    description?: string | null;
    budget?: number | null;
    status: string;
  };
}

interface ListProjectsResponse {
  projects: Array<{
    id: string;
    name: string;
    description?: string | null;
    status: string;
    budget?: number | null;
    spent: number;
    earned: number;
    transactions: number;
    formatted_budget?: string | null;
    formatted_spent: string;
  }>;
  total: number;
  limit: {
    used: number;
    max: number;
    remaining: number;
    tier: string;
  };
}
