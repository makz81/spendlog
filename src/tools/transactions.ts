import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { AppDataSource } from '../db/index.js';
import { Transaction } from '../entities/Transaction.js';
import { Category } from '../entities/Category.js';
import { Project } from '../entities/Project.js';
import {
  addIncomeSchema,
  addExpenseSchema,
  listTransactionsSchema,
  deleteTransactionSchema,
  updateTransactionSchema,
  type AddIncomeInput,
  type AddExpenseInput,
  type ListTransactionsInput,
  type UpdateTransactionInput,
} from '../utils/validation.js';
import { parseDate, formatDate } from '../utils/date.js';
import { formatCurrency } from '../utils/format.js';
import { getCurrentUserId, getDefaultProjectName } from './index.js';
import { Between, FindOptionsWhere, In } from 'typeorm';
import { queueForSync } from '../services/sync.js';
import { FREE_PROJECT_LIMIT, FREE_TRANSACTION_LIMIT, isFreemiumEnabled, UPGRADE_URL } from '../constants.js';
import { t } from '../i18n/index.js';

export function getTransactionToolDefinitions(): Tool[] {
  const defaultProject = getDefaultProjectName();
  const projectHint = defaultProject
    ? t('transactions.addIncomeProjectHint', { project: defaultProject })
    : '';

  return [
    {
      name: 'add_income',
      description: `${t('transactions.addIncomeDesc')}${projectHint}`,
      inputSchema: {
        type: 'object',
        properties: {
          amount: {
            type: 'number',
            description: t('transactions.amountDesc'),
          },
          description: {
            type: 'string',
            description: t('transactions.incomeDescriptionDesc'),
          },
          category: {
            type: 'string',
            description: t('transactions.incomeCategoryDesc'),
          },
          date: {
            type: 'string',
            description: t('transactions.dateDesc'),
          },
          project: {
            type: 'string',
            description: t('transactions.projectDesc'),
          },
        },
        required: ['amount', 'description'],
      },
    },
    {
      name: 'add_expense',
      description: `${t('transactions.addExpenseDesc')}${projectHint}`,
      inputSchema: {
        type: 'object',
        properties: {
          amount: {
            type: 'number',
            description: t('transactions.amountDesc'),
          },
          description: {
            type: 'string',
            description: t('transactions.expenseDescriptionDesc'),
          },
          category: {
            type: 'string',
            description: t('transactions.expenseCategoryDesc'),
          },
          date: {
            type: 'string',
            description: t('transactions.dateDesc'),
          },
          project: {
            type: 'string',
            description: t('transactions.projectDesc'),
          },
        },
        required: ['amount', 'description'],
      },
    },
    {
      name: 'list_transactions',
      annotations: { readOnlyHint: true },
      description: t('transactions.listDesc'),
      inputSchema: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['income', 'expense', 'all'],
            description: t('transactions.typeDesc'),
          },
          from_date: {
            type: 'string',
            description: t('transactions.fromDateDesc'),
          },
          to_date: {
            type: 'string',
            description: t('transactions.toDateDesc'),
          },
          category: {
            type: 'string',
            description: t('transactions.categoryFilterDesc'),
          },
          project: {
            type: 'string',
            description: t('transactions.projectFilterDesc'),
          },
          limit: {
            type: 'number',
            description: t('transactions.limitDesc'),
          },
        },
      },
    },
    {
      name: 'delete_transaction',
      annotations: { destructiveHint: true },
      description: t('transactions.deleteDesc'),
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: t('transactions.idDesc'),
          },
        },
        required: ['id'],
      },
    },
    {
      name: 'update_transaction',
      description: t('transactions.updateDesc'),
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: t('transactions.idDesc'),
          },
          amount: {
            type: 'number',
            description: t('transactions.newAmountDesc'),
          },
          description: {
            type: 'string',
            description: t('transactions.newDescriptionDesc'),
          },
          category: {
            type: 'string',
            description: t('transactions.newCategoryDesc'),
          },
          date: {
            type: 'string',
            description: t('transactions.newDateDesc'),
          },
          project: {
            type: 'string',
            description: t('transactions.updateProjectDesc'),
          },
        },
        required: ['id'],
      },
    },
  ];
}

interface FindOrCreateResult<T> {
  entity: T | null;
  created: boolean;
  skipped?: boolean;
}

async function findOrCreateCategory(
  name: string,
  type: 'income' | 'expense',
  userId: string
): Promise<FindOrCreateResult<Category>> {
  if (!name) return { entity: null, created: false };

  const categoryRepo = AppDataSource.getRepository(Category);

  // First, try to find an existing category (default or user-specific)
  const category = await categoryRepo.findOne({
    where: [
      { name, type, isDefault: true },
      { name, type, userId },
    ],
  });

  if (category) {
    return { entity: category, created: false };
  }

  // If not found, create a user-specific category
  const newCategory = categoryRepo.create({
    name,
    type,
    userId,
    isDefault: false,
  });
  await categoryRepo.save(newCategory);

  return { entity: newCategory, created: true };
}

// FREE_PROJECT_LIMIT imported from constants.ts

async function findProjectByName(name: string, userId: string): Promise<Project | null> {
  if (!name) return null;

  const projectRepo = AppDataSource.getRepository(Project);

  // Search by name (case-insensitive) - supports both full name and codename
  const project = await projectRepo
    .createQueryBuilder('project')
    .where('project.userId = :userId', { userId })
    .andWhere('LOWER(project.name) LIKE LOWER(:name)', { name: `%${name}%` })
    .getOne();

  return project;
}

async function findOrCreateProjectByName(
  name: string,
  userId: string
): Promise<FindOrCreateResult<Project>> {
  if (!name) return { entity: null, created: false };

  // Try to find existing project first
  const existing = await findProjectByName(name, userId);
  if (existing) return { entity: existing, created: false };

  // Auto-create if not found (respects free limit)
  const projectRepo = AppDataSource.getRepository(Project);
  const projectCount = await projectRepo.count({ where: { userId } });

  if (isFreemiumEnabled() && projectCount >= FREE_PROJECT_LIMIT) {
    // At limit — don't block the transaction, but flag it
    return { entity: null, created: false, skipped: true };
  }

  const project = projectRepo.create({
    userId,
    name,
    status: 'active',
  });

  await projectRepo.save(project);
  return { entity: project, created: true };
}

async function checkTransactionLimit(userId: string): Promise<{ allowed: boolean; message?: string }> {
  if (!isFreemiumEnabled()) return { allowed: true };
  const transactionRepo = AppDataSource.getRepository(Transaction);
  const count = await transactionRepo.count({ where: { userId } });
  if (count >= FREE_TRANSACTION_LIMIT) {
    return {
      allowed: false,
      message: t('transactions.limitReached', { limit: String(FREE_TRANSACTION_LIMIT), url: UPGRADE_URL }),
    };
  }
  return { allowed: true };
}

export async function addIncome(args: Record<string, unknown>): Promise<unknown> {
  const input = addIncomeSchema.parse(args) as AddIncomeInput;
  const userId = getCurrentUserId();

  const limitCheck = await checkTransactionLimit(userId);
  if (!limitCheck.allowed) return { success: false, message: limitCheck.message };

  const transactionRepo = AppDataSource.getRepository(Transaction);

  const categoryResult = input.category
    ? await findOrCreateCategory(input.category, 'income', userId)
    : { entity: null, created: false };

  const projectName = input.project || getDefaultProjectName();
  const projectResult = projectName
    ? await findOrCreateProjectByName(projectName, userId)
    : { entity: null, created: false };

  const category = categoryResult.entity;
  const project = projectResult.entity;

  const transaction = transactionRepo.create({
    userId,
    type: 'income',
    amount: input.amount,
    description: input.description,
    categoryId: category?.id,
    projectId: project?.id,
    date: input.date ? parseDate(input.date) : new Date(),
  });

  await transactionRepo.save(transaction);

  // Queue for cloud sync
  queueForSync('transaction', transaction.id, 'create').catch(() => {});

  // Build feedback hints
  const hints: string[] = [];
  if (categoryResult.created && input.category) {
    hints.push(t('transactions.newCategoryCreated', { category: input.category }));
  }
  if (projectResult.created && projectName) {
    hints.push(t('transactions.newProjectCreated', { project: projectName }));
  }
  if (projectResult.skipped && projectName) {
    hints.push(
      t('transactions.projectLimitSkipped', {
        project: projectName,
        limit: String(FREE_PROJECT_LIMIT),
      })
    );
  }

  let message = t('transactions.incomeSaved', {
    amount: formatCurrency(input.amount),
    description: input.description,
  });
  if (project) message += ` (Projekt: ${project.name})`;

  return {
    success: true,
    message,
    hints: hints.length > 0 ? hints : undefined,
    transaction: {
      id: transaction.id,
      type: 'income',
      amount: input.amount,
      description: input.description,
      category: category?.name || t('common.noCategory'),
      project: project?.name || null,
      date: formatDate(transaction.date),
    },
  };
}

export async function addExpense(args: Record<string, unknown>): Promise<unknown> {
  const input = addExpenseSchema.parse(args) as AddExpenseInput;
  const userId = getCurrentUserId();

  const limitCheck = await checkTransactionLimit(userId);
  if (!limitCheck.allowed) return { success: false, message: limitCheck.message };

  const transactionRepo = AppDataSource.getRepository(Transaction);

  const categoryResult = input.category
    ? await findOrCreateCategory(input.category, 'expense', userId)
    : { entity: null, created: false };

  const projectName = input.project || getDefaultProjectName();
  const projectResult = projectName
    ? await findOrCreateProjectByName(projectName, userId)
    : { entity: null, created: false };

  const category = categoryResult.entity;
  const project = projectResult.entity;

  const transaction = transactionRepo.create({
    userId,
    type: 'expense',
    amount: input.amount,
    description: input.description,
    categoryId: category?.id,
    projectId: project?.id,
    date: input.date ? parseDate(input.date) : new Date(),
  });

  await transactionRepo.save(transaction);

  // Queue for cloud sync
  queueForSync('transaction', transaction.id, 'create').catch(() => {});

  // Check budget status after expense
  const { checkBudgetAfterExpense } = await import('./budget.js');
  const budgetCheck = await checkBudgetAfterExpense(userId, input.amount, category?.id);

  // Build feedback hints
  const hints: string[] = [];
  if (categoryResult.created && input.category) {
    hints.push(t('transactions.newCategoryCreated', { category: input.category }));
  }
  if (projectResult.created && projectName) {
    hints.push(t('transactions.newProjectCreated', { project: projectName }));
  }
  if (projectResult.skipped && projectName) {
    hints.push(
      t('transactions.projectLimitSkipped', {
        project: projectName,
        limit: String(FREE_PROJECT_LIMIT),
      })
    );
  }

  let expenseMessage = t('transactions.expenseSaved', {
    amount: formatCurrency(input.amount),
    description: input.description,
  });
  if (project) expenseMessage += ` (Projekt: ${project.name})`;

  const response: Record<string, unknown> = {
    success: true,
    message: expenseMessage,
    hints: hints.length > 0 ? hints : undefined,
    transaction: {
      id: transaction.id,
      type: 'expense',
      amount: input.amount,
      description: input.description,
      category: category?.name || t('common.noCategory'),
      project: project?.name || null,
      date: formatDate(transaction.date),
    },
  };

  // Add budget warning if applicable
  if (budgetCheck.warning) {
    response.budget_warning = budgetCheck.warning;
  }
  if (budgetCheck.budgetStatus) {
    response.budget_status = budgetCheck.budgetStatus;
  }

  return response;
}

export async function listTransactions(args: Record<string, unknown>): Promise<unknown> {
  const input = listTransactionsSchema.parse(args) as ListTransactionsInput;
  const userId = getCurrentUserId();
  const transactionRepo = AppDataSource.getRepository(Transaction);

  const where: FindOptionsWhere<Transaction> = { userId };

  if (input.type && input.type !== 'all') {
    where.type = input.type;
  }

  // Date filtering
  if (input.from_date && input.to_date) {
    where.date = Between(parseDate(input.from_date), parseDate(input.to_date));
  }

  // Category filtering (need to join)
  let categoryIds: string[] | undefined;
  if (input.category) {
    const categoryRepo = AppDataSource.getRepository(Category);
    const categories = await categoryRepo.find({
      where: { name: input.category },
    });
    categoryIds = categories.map((c) => c.id);
    if (categoryIds.length > 0) {
      where.categoryId = In(categoryIds);
    }
  }

  // Project filtering
  if (input.project) {
    const project = await findProjectByName(input.project, userId);
    if (project) {
      where.projectId = project.id;
    }
  }

  const transactions = await transactionRepo.find({
    where,
    relations: ['category', 'project'],
    order: { date: 'DESC', createdAt: 'DESC' },
    take: input.limit,
  });

  const formattedTransactions = transactions.map((tx) => ({
    id: tx.id,
    type: tx.type,
    amount: Number(tx.amount),
    description: tx.description,
    category: tx.category?.name || t('common.noCategory'),
    project: tx.project?.name || null,
    date: formatDate(tx.date),
    formatted_amount: formatCurrency(Number(tx.amount)),
  }));

  const totalIncome = transactions
    .filter((tx) => tx.type === 'income')
    .reduce((sum, tx) => sum + Number(tx.amount), 0);

  const totalExpense = transactions
    .filter((tx) => tx.type === 'expense')
    .reduce((sum, tx) => sum + Number(tx.amount), 0);

  return {
    transactions: formattedTransactions,
    total: transactions.length,
    summary: {
      income: formatCurrency(totalIncome),
      expenses: formatCurrency(totalExpense),
      net: formatCurrency(totalIncome - totalExpense),
    },
  };
}

export async function deleteTransaction(args: Record<string, unknown>): Promise<unknown> {
  const input = deleteTransactionSchema.parse(args);
  const userId = getCurrentUserId();
  const transactionRepo = AppDataSource.getRepository(Transaction);

  const transaction = await transactionRepo.findOne({
    where: { id: input.id, userId },
  });

  if (!transaction) {
    throw new Error(t('transactions.notFound'));
  }

  const transactionId = transaction.id;
  const amount = Number(transaction.amount);
  const description = transaction.description;

  // Queue for cloud sync BEFORE removing locally
  await queueForSync('transaction', transactionId, 'delete');

  await transactionRepo.remove(transaction);

  return {
    success: true,
    message: t('transactions.deleted', { amount: formatCurrency(amount), description }),
  };
}

export async function updateTransaction(args: Record<string, unknown>): Promise<unknown> {
  const input = updateTransactionSchema.parse(args) as UpdateTransactionInput;
  const userId = getCurrentUserId();
  const transactionRepo = AppDataSource.getRepository(Transaction);

  const transaction = await transactionRepo.findOne({
    where: { id: input.id, userId },
    relations: ['category', 'project'],
  });

  if (!transaction) {
    throw new Error(t('transactions.notFound'));
  }

  const changes: string[] = [];

  if (input.amount !== undefined) {
    changes.push(
      t('transactions.changeAmount', {
        old: formatCurrency(Number(transaction.amount)),
        new: formatCurrency(input.amount),
      })
    );
    transaction.amount = input.amount;
  }

  if (input.description !== undefined) {
    changes.push(
      t('transactions.changeDescription', { old: transaction.description, new: input.description })
    );
    transaction.description = input.description;
  }

  if (input.date !== undefined) {
    changes.push(
      t('transactions.changeDate', { old: formatDate(transaction.date), new: input.date })
    );
    transaction.date = parseDate(input.date);
  }

  if (input.category !== undefined) {
    const categoryResult = await findOrCreateCategory(input.category, transaction.type, userId);
    const oldCategoryName = transaction.category?.name || t('common.noCategory');
    changes.push(
      t('transactions.changeCategory', {
        old: oldCategoryName,
        new: categoryResult.entity?.name || t('common.noCategory'),
      })
    );
    if (categoryResult.created) {
      changes.push(t('transactions.changeCategoryCreated', { category: input.category }));
    }
    transaction.categoryId = categoryResult.entity?.id || undefined;
  }

  if (input.project !== undefined) {
    const oldProjectName = transaction.project?.name || t('common.noProject');
    if (input.project === '') {
      // Remove project assignment - set both the ID and the relation to null
      changes.push(
        t('transactions.changeProject', { old: oldProjectName, new: t('common.noProject') })
      );
      transaction.projectId = null as unknown as string | undefined;
      transaction.project = undefined;
    } else {
      const newProject = await findProjectByName(input.project, userId);
      if (newProject) {
        changes.push(
          t('transactions.changeProject', { old: oldProjectName, new: newProject.name })
        );
        transaction.projectId = newProject.id;
        transaction.project = newProject;
      }
    }
  }

  if (changes.length === 0) {
    return {
      success: false,
      message: t('transactions.noChanges'),
    };
  }

  await transactionRepo.save(transaction);

  // Queue for cloud sync
  queueForSync('transaction', transaction.id, 'update').catch(() => {});

  // Reload with relations
  const updated = await transactionRepo.findOne({
    where: { id: transaction.id },
    relations: ['project'],
  });

  return {
    success: true,
    message: t('transactions.updated'),
    changes,
    transaction: {
      id: transaction.id,
      type: transaction.type,
      amount: Number(transaction.amount),
      description: transaction.description,
      project: updated?.project?.name || null,
      date: formatDate(transaction.date),
    },
  };
}
