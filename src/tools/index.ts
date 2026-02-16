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
import {
  connect,
  connectionStatus,
  disconnect,
  syncStatus,
  syncNow,
  getConnectionToolDefinitions,
} from './connection.js';
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
import {
  isConnected,
  getConnectionHint,
  getConnectionHintForSummary,
  getDeeplink,
} from '../services/connection.js';

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
    ...getConnectionToolDefinitions(),
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

// Tools that should always show connection hint when not connected
const SUMMARY_TOOLS = [
  'get_summary',
  'get_category_breakdown',
  'compare_periods',
  'get_tax_summary',
  'list_transactions',
  'list_invoices',
];

// Tools that benefit from deeplinks when connected
const DEEPLINK_TOOLS: Record<
  string,
  'dashboard' | 'transaction' | 'invoices' | 'settings' | 'analytics'
> = {
  get_summary: 'dashboard',
  get_category_breakdown: 'dashboard',
  compare_periods: 'analytics',
  list_transactions: 'transaction',
  list_invoices: 'invoices',
  create_invoice: 'invoices',
  get_invoice: 'invoices',
};

export async function handleToolCall(
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const handler = toolHandlers[name];

  if (!handler) {
    throw new Error(`Unknown tool: ${name}`);
  }

  const result = await handler(args);

  // Skip connection wrapper for connection/sync tools themselves
  if (['connect', 'connection_status', 'disconnect', 'sync_status', 'sync_now'].includes(name)) {
    return result;
  }

  // Wrap response with connection info
  return wrapWithConnectionInfo(name, result);
}

function wrapWithConnectionInfo(toolName: string, result: unknown): Record<string, unknown> {
  // If result is not an object, wrap it
  const response: Record<string, unknown> =
    typeof result === 'object' && result !== null
      ? { ...(result as Record<string, unknown>) }
      : { data: result };

  if (isConnected()) {
    // Add deeplink for connected users
    const deeplinkType = DEEPLINK_TOOLS[toolName];
    if (deeplinkType) {
      const deeplink = getDeeplink(deeplinkType);
      if (deeplink) {
        response.web_dashboard = deeplink;
      }
    }
  } else {
    // Add hint for non-connected users
    let hint: string | null = null;

    if (SUMMARY_TOOLS.includes(toolName)) {
      // Always show hint for summary/list tools
      hint = getConnectionHintForSummary();
    } else {
      // Random hint for other tools (~30% chance)
      hint = getConnectionHint();
    }

    if (hint) {
      response.hint = hint;
    }
  }

  return response;
}
