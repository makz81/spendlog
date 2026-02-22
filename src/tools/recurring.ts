import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { AppDataSource } from '../db/index.js';
import { Recurring, type RecurringInterval } from '../entities/Recurring.js';
import { Transaction } from '../entities/Transaction.js';
import { Category } from '../entities/Category.js';
import { getCurrentUserId } from './index.js';
import { parseDate, formatDate } from '../utils/date.js';
import { formatCurrency } from '../utils/format.js';
import { t } from '../i18n/index.js';
import { z } from 'zod';
import {
  addWeeks,
  addMonths,
  addQuarters,
  addYears,
  isBefore,
  isAfter,
  startOfDay,
} from 'date-fns';

const createRecurringSchema = z.object({
  type: z.enum(['income', 'expense']),
  amount: z.number().positive(),
  description: z.string().min(1),
  category: z.string().optional(),
  interval: z.enum(['weekly', 'monthly', 'quarterly', 'yearly']),
  start_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  end_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

const deleteRecurringSchema = z.object({
  id: z.string().uuid(),
});

export function getRecurringToolDefinitions(): Tool[] {
  return [
    {
      name: 'create_recurring',
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
      description: t('recurring.createDesc'),
      inputSchema: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['income', 'expense'],
            description: t('recurring.typeDesc'),
          },
          amount: {
            type: 'number',
            description: t('recurring.amountDesc'),
          },
          description: {
            type: 'string',
            description: t('recurring.descriptionDesc'),
          },
          category: {
            type: 'string',
            description: t('recurring.categoryDesc'),
          },
          interval: {
            type: 'string',
            enum: ['weekly', 'monthly', 'quarterly', 'yearly'],
            description: t('recurring.intervalDesc'),
          },
          start_date: {
            type: 'string',
            description: t('recurring.startDateDesc'),
          },
          end_date: {
            type: 'string',
            description: t('recurring.endDateDesc'),
          },
        },
        required: ['type', 'amount', 'description', 'interval'],
      },
    },
    {
      name: 'list_recurring',
      annotations: { readOnlyHint: true },
      description: t('recurring.listDesc'),
      inputSchema: {
        type: 'object',
        properties: {
          active_only: {
            type: 'boolean',
            description: t('recurring.activeOnlyDesc'),
          },
        },
      },
    },
    {
      name: 'delete_recurring',
      annotations: { destructiveHint: true },
      description: t('recurring.deleteDesc'),
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: t('recurring.deleteIdDesc'),
          },
        },
        required: ['id'],
      },
    },
    {
      name: 'process_recurring',
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
      description: t('recurring.processDesc'),
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
  ];
}

function calculateNextDue(date: Date, interval: RecurringInterval): Date {
  switch (interval) {
    case 'weekly':
      return addWeeks(date, 1);
    case 'monthly':
      return addMonths(date, 1);
    case 'quarterly':
      return addQuarters(date, 1);
    case 'yearly':
      return addYears(date, 1);
  }
}

function getIntervalLabel(interval: RecurringInterval): string {
  return t(`intervals.${interval}`);
}

async function findOrCreateCategory(
  name: string,
  type: 'income' | 'expense',
  userId: string
): Promise<Category | null> {
  if (!name) return null;

  const categoryRepo = AppDataSource.getRepository(Category);

  let category = await categoryRepo.findOne({
    where: [
      { name, type, isDefault: true },
      { name, type, userId },
    ],
  });

  if (!category) {
    category = categoryRepo.create({
      name,
      type,
      userId,
      isDefault: false,
    });
    await categoryRepo.save(category);
  }

  return category;
}

export async function createRecurring(args: Record<string, unknown>): Promise<unknown> {
  const input = createRecurringSchema.parse(args);
  const userId = getCurrentUserId();
  const recurringRepo = AppDataSource.getRepository(Recurring);

  const startDate = input.start_date ? parseDate(input.start_date) : new Date();
  const endDate = input.end_date ? parseDate(input.end_date) : undefined;

  const category = input.category
    ? await findOrCreateCategory(input.category, input.type, userId)
    : null;

  const recurring = recurringRepo.create({
    userId,
    type: input.type,
    amount: input.amount,
    description: input.description,
    categoryId: category?.id,
    interval: input.interval,
    startDate,
    endDate,
    nextDue: startDate,
    active: true,
  });

  await recurringRepo.save(recurring);

  return {
    success: true,
    message: t('recurring.created', {
      type: input.type === 'income' ? t('common.income') : t('common.expense'),
      amount: formatCurrency(input.amount),
      interval: getIntervalLabel(input.interval),
    }),
    recurring: {
      id: recurring.id,
      type: input.type === 'income' ? t('common.income') : t('common.expense'),
      amount: formatCurrency(input.amount),
      description: input.description,
      interval: getIntervalLabel(input.interval),
      next_due: formatDate(recurring.nextDue!),
    },
  };
}

export async function listRecurring(args: Record<string, unknown>): Promise<unknown> {
  const activeOnly = args.active_only !== false;
  const userId = getCurrentUserId();
  const recurringRepo = AppDataSource.getRepository(Recurring);

  const where: Record<string, unknown> = { userId };
  if (activeOnly) {
    where.active = true;
  }

  const recurrings = await recurringRepo.find({
    where,
    relations: ['category'],
    order: { nextDue: 'ASC' },
  });

  const formatted = recurrings.map((r) => ({
    id: r.id,
    type: r.type === 'income' ? t('common.income') : t('common.expense'),
    amount: formatCurrency(Number(r.amount)),
    description: r.description,
    category: r.category?.name || t('common.noCategory'),
    interval: getIntervalLabel(r.interval),
    next_due: r.nextDue ? formatDate(r.nextDue) : '-',
    active: r.active,
  }));

  const monthlyIncome = recurrings
    .filter((r) => r.type === 'income' && r.active)
    .reduce((sum, r) => {
      const amount = Number(r.amount);
      switch (r.interval) {
        case 'weekly':
          return sum + amount * 4.33;
        case 'monthly':
          return sum + amount;
        case 'quarterly':
          return sum + amount / 3;
        case 'yearly':
          return sum + amount / 12;
      }
    }, 0);

  const monthlyExpense = recurrings
    .filter((r) => r.type === 'expense' && r.active)
    .reduce((sum, r) => {
      const amount = Number(r.amount);
      switch (r.interval) {
        case 'weekly':
          return sum + amount * 4.33;
        case 'monthly':
          return sum + amount;
        case 'quarterly':
          return sum + amount / 3;
        case 'yearly':
          return sum + amount / 12;
      }
    }, 0);

  return {
    recurring: formatted,
    total: recurrings.length,
    monthly_projection: {
      income: formatCurrency(monthlyIncome),
      expenses: formatCurrency(monthlyExpense),
      net: formatCurrency(monthlyIncome - monthlyExpense),
    },
  };
}

export async function deleteRecurring(args: Record<string, unknown>): Promise<unknown> {
  const input = deleteRecurringSchema.parse(args);
  const userId = getCurrentUserId();
  const recurringRepo = AppDataSource.getRepository(Recurring);

  const recurring = await recurringRepo.findOne({
    where: { id: input.id, userId },
  });

  if (!recurring) {
    throw new Error(t('recurring.notFound'));
  }

  await recurringRepo.remove(recurring);

  return {
    success: true,
    message: t('recurring.deleted', { description: recurring.description }),
  };
}

export async function processRecurring(_args: Record<string, unknown>): Promise<unknown> {
  const userId = getCurrentUserId();
  const recurringRepo = AppDataSource.getRepository(Recurring);
  const transactionRepo = AppDataSource.getRepository(Transaction);

  const today = startOfDay(new Date());

  const dueRecurrings = await recurringRepo.find({
    where: { userId, active: true },
  });

  const processed: Array<{ description: string; amount: string; type: string }> = [];

  for (const recurring of dueRecurrings) {
    if (!recurring.nextDue) continue;

    // Check if end date passed
    if (recurring.endDate && isAfter(today, recurring.endDate)) {
      recurring.active = false;
      await recurringRepo.save(recurring);
      continue;
    }

    // Process all due dates up to today
    let nextDue = startOfDay(new Date(recurring.nextDue));

    while (isBefore(nextDue, today) || nextDue.getTime() === today.getTime()) {
      // Create transaction
      const transaction = transactionRepo.create({
        userId,
        type: recurring.type,
        amount: recurring.amount,
        description: recurring.description,
        categoryId: recurring.categoryId || undefined,
        date: nextDue,
      });
      await transactionRepo.save(transaction);

      processed.push({
        description: recurring.description,
        amount: formatCurrency(Number(recurring.amount)),
        type: recurring.type === 'income' ? t('common.income') : t('common.expense'),
      });

      // Calculate next due date
      recurring.lastProcessed = nextDue;
      nextDue = calculateNextDue(nextDue, recurring.interval);

      // Check if next due exceeds end date
      if (recurring.endDate && isAfter(nextDue, recurring.endDate)) {
        recurring.active = false;
        recurring.nextDue = undefined;
        break;
      }

      recurring.nextDue = nextDue;
    }

    await recurringRepo.save(recurring);
  }

  if (processed.length === 0) {
    return {
      success: true,
      message: t('recurring.nothingDue'),
      processed: 0,
    };
  }

  return {
    success: true,
    message: t('recurring.processed', { count: String(processed.length) }),
    processed: processed.length,
    transactions: processed,
  };
}
