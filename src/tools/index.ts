import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import {
  addIncome,
  addExpense,
  listTransactions,
  deleteTransaction,
  updateTransaction,
  getTransactionToolDefinitions,
} from './transactions.js';
import {
  getSummary,
  getCategoryBreakdown,
  comparePeriods,
  getTaxSummary,
  getSummaryToolDefinitions,
} from './summary.js';
import { getProfile, setProfile, getProfileToolDefinitions } from './profile.js';
import {
  createInvoice,
  listInvoices,
  getInvoice,
  markInvoiceSent,
  markInvoicePaid,
  deleteInvoice,
  duplicateInvoice,
  getInvoiceToolDefinitions,
} from './invoice.js';
import {
  exportTransactions,
  exportInvoices,
  exportForTaxAdvisor,
  getExportToolDefinitions,
} from './export.js';
import {
  listCategories,
  addCategory,
  deleteCategory,
  getCategoryToolDefinitions,
} from './categories.js';
import {
  createRecurring,
  listRecurring,
  deleteRecurring,
  processRecurring,
  getRecurringToolDefinitions,
} from './recurring.js';
import { getNotifications, getNotificationToolDefinitions } from './notifications.js';
import {
  setBudget,
  getBudgetStatus,
  listBudgets,
  deleteBudget,
  updateBudget,
  getBudgetToolDefinitions,
} from './budget.js';
import {
  listProjects,
  renameProject,
  createProject,
  deleteProject,
  getProjectToolDefinitions,
} from './projects.js';

// Global user context
let currentUserId: string;
let defaultProjectName: string | null = null;

export function registerTools(userId: string, projectName?: string): void {
  currentUserId = userId;
  defaultProjectName = projectName || null;
}

export function getCurrentUserId(): string {
  if (!currentUserId) {
    throw new Error('Tools not initialized. Call registerTools first.');
  }
  return currentUserId;
}

export function getDefaultProjectName(): string | null {
  return defaultProjectName;
}

export function getToolDefinitions(): Tool[] {
  return [
    ...getTransactionToolDefinitions(),
    ...getSummaryToolDefinitions(),
    ...getProfileToolDefinitions(),
    ...getInvoiceToolDefinitions(),
    ...getExportToolDefinitions(),
    ...getCategoryToolDefinitions(),
    ...getRecurringToolDefinitions(),
    ...getNotificationToolDefinitions(),
    ...getBudgetToolDefinitions(),
    ...getProjectToolDefinitions(),
  ];
}

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
  delete_invoice: deleteInvoice,
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

export async function handleToolCall(
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const handler = toolHandlers[name];

  if (!handler) {
    throw new Error(`Unknown tool: ${name}`);
  }

  return handler(args);
}
