import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { AppDataSource } from '../db/index.js';
import { Budget } from '../entities/Budget.js';
import { Transaction } from '../entities/Transaction.js';
import { Category } from '../entities/Category.js';
import {
  setBudgetSchema,
  getBudgetStatusSchema,
  deleteBudgetSchema,
  updateBudgetSchema,
  type SetBudgetInput,
  type GetBudgetStatusInput,
  type DeleteBudgetInput,
  type UpdateBudgetInput,
} from '../utils/validation.js';
import { getPeriodRange } from '../utils/date.js';
import { formatCurrency, formatPercentage } from '../utils/format.js';
import { getCurrentUserId } from './index.js';
import { Between } from 'typeorm';
import { getUserTier } from '../services/freemium.js';
import { FREE_BUDGET_LIMIT, UPGRADE_URL } from '../constants.js';
import { t } from '../i18n/index.js';

export function getBudgetToolDefinitions(): Tool[] {
  return [
    {
      name: 'set_budget',
      description: t('budget.setDesc'),
      inputSchema: {
        type: 'object',
        properties: {
          amount: {
            type: 'number',
            description: t('budget.amountDesc'),
          },
          period: {
            type: 'string',
            enum: ['monthly', 'quarterly', 'yearly'],
            description: t('budget.periodDesc'),
          },
          category: {
            type: 'string',
            description: t('budget.categoryDesc'),
          },
          name: {
            type: 'string',
            description: t('budget.nameDesc'),
          },
          alert_threshold: {
            type: 'number',
            description: t('budget.alertDesc'),
          },
        },
        required: ['amount'],
      },
    },
    {
      name: 'get_budget_status',
      annotations: { readOnlyHint: true },
      description: t('budget.statusDesc'),
      inputSchema: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            description: t('budget.statusCategoryDesc'),
          },
        },
      },
    },
    {
      name: 'list_budgets',
      annotations: { readOnlyHint: true },
      description: t('budget.listDesc'),
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'delete_budget',
      annotations: { destructiveHint: true },
      description: t('budget.deleteDesc'),
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: t('budget.deleteIdDesc'),
          },
        },
        required: ['id'],
      },
    },
    {
      name: 'update_budget',
      description: t('budget.updateDesc'),
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: t('budget.updateIdDesc'),
          },
          amount: {
            type: 'number',
            description: t('budget.updateAmountDesc'),
          },
          alert_threshold: {
            type: 'number',
            description: t('budget.updateAlertDesc'),
          },
          active: {
            type: 'boolean',
            description: t('budget.updateActiveDesc'),
          },
        },
        required: ['id'],
      },
    },
  ];
}

function getPeriodForBudget(
  period: 'monthly' | 'quarterly' | 'yearly'
): 'month' | 'quarter' | 'year' {
  switch (period) {
    case 'monthly':
      return 'month';
    case 'quarterly':
      return 'quarter';
    case 'yearly':
      return 'year';
  }
}

function getPeriodLabel(period: 'monthly' | 'quarterly' | 'yearly'): string {
  switch (period) {
    case 'monthly':
      return t('common.monthly');
    case 'quarterly':
      return t('common.quarterly');
    case 'yearly':
      return t('common.yearly');
  }
}

async function findCategory(name: string, userId: string): Promise<Category | null> {
  const categoryRepo = AppDataSource.getRepository(Category);
  return categoryRepo.findOne({
    where: [
      { name, type: 'expense', isDefault: true },
      { name, type: 'expense', userId },
    ],
  });
}

async function calculateSpentForBudget(
  budget: Budget,
  userId: string
): Promise<{ spent: number; transactionCount: number }> {
  const transactionRepo = AppDataSource.getRepository(Transaction);
  const periodType = getPeriodForBudget(budget.period);
  const dateRange = getPeriodRange(periodType);

  const where: Record<string, unknown> = {
    userId,
    type: 'expense',
    date: Between(dateRange.start, dateRange.end),
  };

  if (budget.categoryId) {
    where.categoryId = budget.categoryId;
  }

  const transactions = await transactionRepo.find({ where: where as never });
  const spent = transactions.reduce((sum, t) => sum + Number(t.amount), 0);

  return { spent, transactionCount: transactions.length };
}

export async function setBudget(args: Record<string, unknown>): Promise<unknown> {
  const input = setBudgetSchema.parse(args) as SetBudgetInput;
  const userId = getCurrentUserId();
  const budgetRepo = AppDataSource.getRepository(Budget);

  let category: Category | null = null;
  if (input.category) {
    category = await findCategory(input.category, userId);
    if (!category) {
      return {
        success: false,
        message: t('budget.categoryNotFound', { category: input.category }),
      };
    }
  }

  // Check if budget for this category/period already exists
  const existingBudget = await budgetRepo.findOne({
    where: {
      userId,
      period: input.period,
      categoryId: category?.id || undefined,
    },
  });

  if (existingBudget) {
    // Update existing budget
    existingBudget.amount = input.amount;
    existingBudget.alertThreshold = input.alert_threshold;
    if (input.name) existingBudget.name = input.name;
    existingBudget.active = true;
    await budgetRepo.save(existingBudget);

    const catSuffix = category ? ` für ${category.name}` : ` (${t('budget.totalBudget')})`;

    return {
      success: true,
      message: t('budget.budgetUpdated', {
        amount: formatCurrency(input.amount),
        period: getPeriodLabel(input.period),
        category: catSuffix,
      }),
      budget: {
        id: existingBudget.id,
        amount: input.amount,
        period: input.period,
        category: category?.name || null,
      },
    };
  }

  // Check free tier budget limit before creating
  const tier = await getUserTier(userId);
  if (tier === 'free') {
    const budgetCount = await budgetRepo.count({ where: { userId, active: true } });
    if (budgetCount >= FREE_BUDGET_LIMIT) {
      return {
        success: false,
        message: t('budget.limitReached', { limit: String(FREE_BUDGET_LIMIT), url: UPGRADE_URL }),
      };
    }
  }

  // Create new budget
  const budget = budgetRepo.create({
    userId,
    amount: input.amount,
    period: input.period,
    categoryId: category?.id,
    name: input.name,
    alertThreshold: input.alert_threshold,
    active: true,
  });

  await budgetRepo.save(budget);

  const catSuffix = category ? ` für ${category.name}` : ` (${t('budget.totalBudget')})`;

  return {
    success: true,
    message: t('budget.budgetCreated', {
      amount: formatCurrency(input.amount),
      period: getPeriodLabel(input.period),
      category: catSuffix,
    }),
    budget: {
      id: budget.id,
      amount: input.amount,
      period: input.period,
      category: category?.name || null,
    },
  };
}

export async function getBudgetStatus(args: Record<string, unknown>): Promise<unknown> {
  const input = getBudgetStatusSchema.parse(args) as GetBudgetStatusInput;
  const userId = getCurrentUserId();
  const budgetRepo = AppDataSource.getRepository(Budget);

  const where: Record<string, unknown> = { userId, active: true };

  if (input.category) {
    const category = await findCategory(input.category, userId);
    if (!category) {
      return {
        success: false,
        message: t('budget.categoryNotFound', { category: input.category }),
      };
    }
    where.categoryId = category.id;
  }

  const budgets = await budgetRepo.find({
    where: where as never,
    relations: ['category'],
  });

  if (budgets.length === 0) {
    return {
      success: true,
      message: t('budget.noBudgets'),
      budgets: [],
    };
  }

  const budgetStatuses = await Promise.all(
    budgets.map(async (budget) => {
      const { spent, transactionCount } = await calculateSpentForBudget(budget, userId);
      const remaining = Number(budget.amount) - spent;
      const percentage = (spent / Number(budget.amount)) * 100;
      const periodRange = getPeriodRange(getPeriodForBudget(budget.period));

      let status: 'ok' | 'warning' | 'over';
      let statusEmoji: string;
      if (percentage >= 100) {
        status = 'over';
        statusEmoji = '🔴';
      } else if (percentage >= budget.alertThreshold) {
        status = 'warning';
        statusEmoji = '🟡';
      } else {
        status = 'ok';
        statusEmoji = '🟢';
      }

      return {
        id: budget.id,
        name:
          budget.name ||
          (budget.category?.name ? `Budget ${budget.category.name}` : t('budget.totalBudget')),
        category: budget.category?.name || null,
        period: budget.period,
        period_label: periodRange.label,
        budget_amount: Number(budget.amount),
        budget_formatted: formatCurrency(Number(budget.amount)),
        spent: spent,
        spent_formatted: formatCurrency(spent),
        remaining: remaining,
        remaining_formatted: formatCurrency(remaining),
        percentage: Math.round(percentage * 10) / 10,
        percentage_formatted: formatPercentage(percentage),
        transaction_count: transactionCount,
        status,
        status_display: `${statusEmoji} ${formatCurrency(spent)} / ${formatCurrency(Number(budget.amount))} (${Math.round(percentage)}%)`,
        alert_threshold: budget.alertThreshold,
      };
    })
  );

  // Summary message
  const overBudget = budgetStatuses.filter((b) => b.status === 'over');
  const warnings = budgetStatuses.filter((b) => b.status === 'warning');

  let summaryMessage = '';
  if (overBudget.length > 0) {
    summaryMessage = t('budget.overBudget', { count: String(overBudget.length) });
  } else if (warnings.length > 0) {
    summaryMessage = t('budget.warningBudget', { count: String(warnings.length) });
  } else {
    summaryMessage = t('budget.allGood');
  }

  return {
    success: true,
    summary: summaryMessage,
    budgets: budgetStatuses,
  };
}

export async function listBudgets(_args: Record<string, unknown>): Promise<unknown> {
  const userId = getCurrentUserId();
  const budgetRepo = AppDataSource.getRepository(Budget);

  const budgets = await budgetRepo.find({
    where: { userId },
    relations: ['category'],
    order: { createdAt: 'DESC' },
  });

  if (budgets.length === 0) {
    return {
      success: true,
      message: t('budget.noBudgetsList'),
      budgets: [],
    };
  }

  const formattedBudgets = budgets.map((budget) => ({
    id: budget.id,
    name:
      budget.name ||
      (budget.category?.name ? `Budget ${budget.category.name}` : t('budget.totalBudget')),
    amount: Number(budget.amount),
    amount_formatted: formatCurrency(Number(budget.amount)),
    period: budget.period,
    period_label: getPeriodLabel(budget.period),
    category: budget.category?.name || null,
    active: budget.active,
    alert_threshold: budget.alertThreshold,
  }));

  return {
    success: true,
    total: budgets.length,
    active: budgets.filter((b) => b.active).length,
    budgets: formattedBudgets,
  };
}

export async function deleteBudget(args: Record<string, unknown>): Promise<unknown> {
  const input = deleteBudgetSchema.parse(args) as DeleteBudgetInput;
  const userId = getCurrentUserId();
  const budgetRepo = AppDataSource.getRepository(Budget);

  const budget = await budgetRepo.findOne({
    where: { id: input.id, userId },
    relations: ['category'],
  });

  if (!budget) {
    return {
      success: false,
      message: t('budget.budgetNotFound'),
    };
  }

  const budgetName = budget.name || budget.category?.name || t('budget.totalBudget');
  await budgetRepo.remove(budget);

  return {
    success: true,
    message: t('budget.budgetDeleted', { name: budgetName }),
  };
}

export async function updateBudget(args: Record<string, unknown>): Promise<unknown> {
  const input = updateBudgetSchema.parse(args) as UpdateBudgetInput;
  const userId = getCurrentUserId();
  const budgetRepo = AppDataSource.getRepository(Budget);

  const budget = await budgetRepo.findOne({
    where: { id: input.id, userId },
    relations: ['category'],
  });

  if (!budget) {
    return {
      success: false,
      message: t('budget.budgetNotFound'),
    };
  }

  const changes: string[] = [];

  if (input.amount !== undefined) {
    changes.push(
      t('budget.changeAmount', {
        old: formatCurrency(Number(budget.amount)),
        new: formatCurrency(input.amount),
      })
    );
    budget.amount = input.amount;
  }

  if (input.alert_threshold !== undefined) {
    changes.push(
      t('budget.changeThreshold', {
        old: String(budget.alertThreshold),
        new: String(input.alert_threshold),
      })
    );
    budget.alertThreshold = input.alert_threshold;
  }

  if (input.active !== undefined) {
    changes.push(
      t('budget.changeStatus', {
        old: budget.active ? t('common.active') : t('common.inactive'),
        new: input.active ? t('common.active') : t('common.inactive'),
      })
    );
    budget.active = input.active;
  }

  if (changes.length === 0) {
    return {
      success: false,
      message: t('budget.noChanges'),
    };
  }

  await budgetRepo.save(budget);

  return {
    success: true,
    message: t('budget.budgetUpdatedMsg'),
    changes,
    budget: {
      id: budget.id,
      name: budget.name || budget.category?.name || t('budget.totalBudget'),
      amount: Number(budget.amount),
      active: budget.active,
    },
  };
}

/**
 * Check budget status after adding an expense (used internally)
 */
export async function checkBudgetAfterExpense(
  userId: string,
  _amount: number,
  categoryId?: string
): Promise<{ warning: string | null; budgetStatus: unknown | null }> {
  const budgetRepo = AppDataSource.getRepository(Budget);

  // Find relevant budgets (category-specific or total)
  const budgets = await budgetRepo.find({
    where: [
      { userId, categoryId, active: true },
      { userId, categoryId: undefined, active: true },
    ],
    relations: ['category'],
  });

  if (budgets.length === 0) {
    return { warning: null, budgetStatus: null };
  }

  const warnings: string[] = [];
  const statuses: unknown[] = [];

  for (const budget of budgets) {
    const { spent } = await calculateSpentForBudget(budget, userId);
    const percentage = (spent / Number(budget.amount)) * 100;
    const remaining = Number(budget.amount) - spent;

    const budgetName = budget.category?.name || t('budget.totalBudget');

    if (percentage >= 100) {
      warnings.push(
        t('budget.budgetExceeded', {
          name: budgetName,
          spent: formatCurrency(spent),
          budget: formatCurrency(Number(budget.amount)),
        })
      );
    } else if (percentage >= budget.alertThreshold) {
      warnings.push(
        t('budget.budgetWarning', {
          name: budgetName,
          percentage: String(Math.round(percentage)),
          remaining: formatCurrency(remaining),
        })
      );
    }

    statuses.push({
      name: budgetName,
      spent: formatCurrency(spent),
      budget: formatCurrency(Number(budget.amount)),
      percentage: `${Math.round(percentage)}%`,
      remaining: formatCurrency(remaining),
    });
  }

  return {
    warning: warnings.length > 0 ? warnings.join('\n') : null,
    budgetStatus: statuses.length > 0 ? statuses : null,
  };
}
