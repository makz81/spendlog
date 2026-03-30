import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { AppDataSource } from '../db/index.js';
import { Category } from '../entities/Category.js';
import { Transaction } from '../entities/Transaction.js';
import { getCurrentUserId } from './index.js';
import { z } from 'zod';
import { t } from '../i18n/index.js';

const addCategorySchema = z.object({
  name: z.string().min(1, t('validation.nameRequired')),
  type: z.enum(['income', 'expense']),
});

const deleteCategorySchema = z.object({
  id: z.string().uuid(t('validation.invalidCategoryId')),
});

export function getCategoryToolDefinitions(): Tool[] {
  return [
    {
      name: 'list_categories',
      annotations: { readOnlyHint: true },
      description: t('categories.listDesc'),
      inputSchema: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['income', 'expense', 'all'],
            description: t('categories.typeFilterDesc'),
          },
        },
      },
    },
    {
      name: 'add_category',
      annotations: {},
      description: t('categories.addDesc'),
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: t('categories.addNameDesc'),
          },
          type: {
            type: 'string',
            enum: ['income', 'expense'],
            description: t('categories.addTypeDesc'),
          },
        },
        required: ['name', 'type'],
      },
    },
    {
      name: 'delete_category',
      annotations: { destructiveHint: true },
      description: t('categories.deleteDesc'),
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: t('categories.deleteIdDesc'),
          },
        },
        required: ['id'],
      },
    },
  ];
}

export async function listCategories(args: Record<string, unknown>): Promise<unknown> {
  const type = (args.type as string) || 'all';
  const userId = getCurrentUserId();
  const categoryRepo = AppDataSource.getRepository(Category);

  const whereConditions: Array<Record<string, unknown>> = [];

  if (type === 'all') {
    whereConditions.push({ isDefault: true });
    whereConditions.push({ userId });
  } else {
    whereConditions.push({ isDefault: true, type });
    whereConditions.push({ userId, type });
  }

  const categories = await categoryRepo.find({
    where: whereConditions,
    order: { type: 'ASC', name: 'ASC' },
  });

  const incomeCategories = categories.filter((c) => c.type === 'income');
  const expenseCategories = categories.filter((c) => c.type === 'expense');

  return {
    total: categories.length,
    income: incomeCategories.map((c) => ({
      id: c.id,
      name: c.name,
      is_default: c.isDefault,
    })),
    expense: expenseCategories.map((c) => ({
      id: c.id,
      name: c.name,
      is_default: c.isDefault,
    })),
  };
}

export async function addCategory(args: Record<string, unknown>): Promise<unknown> {
  const input = addCategorySchema.parse(args);
  const userId = getCurrentUserId();
  const categoryRepo = AppDataSource.getRepository(Category);

  // Check if category with same name exists
  const existing = await categoryRepo.findOne({
    where: [
      { name: input.name, type: input.type, isDefault: true },
      { name: input.name, type: input.type, userId },
    ],
  });

  if (existing) {
    return {
      success: false,
      error: t('categories.alreadyExists', {
        name: input.name,
        type: input.type === 'income' ? t('common.income') : t('common.expense'),
      }),
    };
  }

  const category = categoryRepo.create({
    name: input.name,
    type: input.type,
    userId,
    isDefault: false,
  });

  await categoryRepo.save(category);

  return {
    success: true,
    message: t('categories.created', { name: input.name }),
    category: {
      id: category.id,
      name: category.name,
      type: category.type === 'income' ? t('common.income') : t('common.expense'),
    },
  };
}

export async function deleteCategory(args: Record<string, unknown>): Promise<unknown> {
  const input = deleteCategorySchema.parse(args);
  const userId = getCurrentUserId();
  const categoryRepo = AppDataSource.getRepository(Category);
  const transactionRepo = AppDataSource.getRepository(Transaction);

  const category = await categoryRepo.findOne({
    where: { id: input.id },
  });

  if (!category) {
    throw new Error(t('categories.notFound'));
  }

  if (category.isDefault) {
    return {
      success: false,
      error: t('categories.cannotDeleteDefault'),
    };
  }

  if (category.userId !== userId) {
    throw new Error(t('categories.noPermission'));
  }

  // Check if category is used by transactions
  const usageCount = await transactionRepo.count({
    where: { categoryId: category.id },
  });

  if (usageCount > 0) {
    return {
      success: false,
      error: t('categories.inUse', { name: category.name, count: String(usageCount) }),
    };
  }

  await categoryRepo.remove(category);

  return {
    success: true,
    message: t('categories.deleted', { name: category.name }),
  };
}
