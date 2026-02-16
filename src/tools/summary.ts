import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { AppDataSource } from '../db/index.js';
import { Transaction } from '../entities/Transaction.js';
import {
  getSummarySchema,
  getCategoryBreakdownSchema,
  comparePeriodsSchema,
  getTaxSummarySchema,
  type GetSummaryInput,
  type GetCategoryBreakdownInput,
  type ComparePeriodsInput,
  type GetTaxSummaryInput,
} from '../utils/validation.js';
import { getPeriodRange } from '../utils/date.js';
import { formatCurrency, formatPercentage } from '../utils/format.js';
import { getCurrentUserId } from './index.js';
import { Between } from 'typeorm';
import { getUserTier } from '../services/freemium.js';
import { UPGRADE_URL } from '../constants.js';
import { t } from '../i18n/index.js';

export function getSummaryToolDefinitions(): Tool[] {
  return [
    {
      name: 'get_summary',
      annotations: { readOnlyHint: true },
      description: t('summary.getSummaryDesc'),
      inputSchema: {
        type: 'object',
        properties: {
          period: {
            type: 'string',
            enum: ['month', 'quarter', 'year', 'all'],
            description: t('summary.periodDesc'),
          },
          date: {
            type: 'string',
            description: t('summary.dateRefDesc'),
          },
        },
      },
    },
    {
      name: 'get_category_breakdown',
      annotations: { readOnlyHint: true },
      description: t('summary.categoryBreakdownDesc'),
      inputSchema: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['income', 'expense'],
            description: t('summary.typeDesc'),
          },
          period: {
            type: 'string',
            enum: ['month', 'quarter', 'year', 'all'],
            description: t('summary.periodDesc'),
          },
          date: {
            type: 'string',
            description: t('summary.dateRefDesc'),
          },
        },
        required: ['type'],
      },
    },
    {
      name: 'compare_periods',
      annotations: { readOnlyHint: true },
      description: t('summary.comparePeriodDesc'),
      inputSchema: {
        type: 'object',
        properties: {
          period: {
            type: 'string',
            enum: ['month', 'quarter', 'year'],
            description: t('summary.periodTypeDesc'),
          },
          current_date: {
            type: 'string',
            description: t('summary.currentDateDesc'),
          },
          compare_date: {
            type: 'string',
            description: t('summary.compareDateDesc'),
          },
        },
        required: ['period'],
      },
    },
    {
      name: 'get_tax_summary',
      annotations: { readOnlyHint: true },
      description: t('summary.taxSummaryDesc'),
      inputSchema: {
        type: 'object',
        properties: {
          year: {
            type: 'number',
            description: t('summary.yearDesc'),
          },
          quarter: {
            type: 'number',
            description: t('summary.quarterDesc'),
          },
        },
        required: ['year'],
      },
    },
  ];
}

export async function getSummary(args: Record<string, unknown>): Promise<unknown> {
  const input = getSummarySchema.parse(args) as GetSummaryInput;
  const userId = getCurrentUserId();
  const transactionRepo = AppDataSource.getRepository(Transaction);

  const dateRange = getPeriodRange(input.period, input.date);

  const transactions = await transactionRepo.find({
    where: {
      userId,
      date: Between(dateRange.start, dateRange.end),
    },
    relations: ['category'],
  });

  const incomeTransactions = transactions.filter((tx) => tx.type === 'income');
  const expenseTransactions = transactions.filter((tx) => tx.type === 'expense');

  const totalIncome = incomeTransactions.reduce((sum, tx) => sum + Number(tx.amount), 0);
  const totalExpense = expenseTransactions.reduce((sum, tx) => sum + Number(tx.amount), 0);
  const net = totalIncome - totalExpense;

  // Category breakdown for income
  const incomeByCategory: Record<string, number> = {};
  for (const tx of incomeTransactions) {
    const catName = tx.category?.name || t('common.noCategory');
    incomeByCategory[catName] = (incomeByCategory[catName] || 0) + Number(tx.amount);
  }

  // Category breakdown for expenses
  const expenseByCategory: Record<string, number> = {};
  for (const tx of expenseTransactions) {
    const catName = tx.category?.name || t('common.noCategory');
    expenseByCategory[catName] = (expenseByCategory[catName] || 0) + Number(tx.amount);
  }

  return {
    period: dateRange.label,
    income: {
      total: totalIncome,
      formatted: formatCurrency(totalIncome),
      count: incomeTransactions.length,
      by_category: Object.fromEntries(
        Object.entries(incomeByCategory).map(([k, v]) => [k, formatCurrency(v)])
      ),
    },
    expenses: {
      total: totalExpense,
      formatted: formatCurrency(totalExpense),
      count: expenseTransactions.length,
      by_category: Object.fromEntries(
        Object.entries(expenseByCategory).map(([k, v]) => [k, formatCurrency(v)])
      ),
    },
    net: {
      total: net,
      formatted: formatCurrency(net),
      positive: net >= 0,
    },
    transaction_count: transactions.length,
  };
}

export async function getCategoryBreakdown(args: Record<string, unknown>): Promise<unknown> {
  const input = getCategoryBreakdownSchema.parse(args) as GetCategoryBreakdownInput;
  const userId = getCurrentUserId();
  const transactionRepo = AppDataSource.getRepository(Transaction);

  const dateRange = getPeriodRange(input.period || 'month', input.date);

  const transactions = await transactionRepo.find({
    where: {
      userId,
      type: input.type,
      date: Between(dateRange.start, dateRange.end),
    },
    relations: ['category'],
  });

  const total = transactions.reduce((sum, tx) => sum + Number(tx.amount), 0);

  // Group by category
  const byCategory: Record<string, number> = {};
  for (const tx of transactions) {
    const catName = tx.category?.name || t('common.noCategory');
    byCategory[catName] = (byCategory[catName] || 0) + Number(tx.amount);
  }

  // Sort by amount descending
  const categories = Object.entries(byCategory)
    .map(([name, amount]) => ({
      name,
      total: amount,
      formatted: formatCurrency(amount),
      percentage: total > 0 ? (amount / total) * 100 : 0,
      formatted_percentage: total > 0 ? formatPercentage((amount / total) * 100) : '0%',
    }))
    .sort((a, b) => b.total - a.total);

  return {
    type: input.type === 'income' ? t('common.incomePlural') : t('common.expensePlural'),
    period: dateRange.label,
    total: formatCurrency(total),
    categories,
  };
}

function calculateChange(
  current: number,
  previous: number
): { absolute: number; percentage: number; direction: 'up' | 'down' | 'same' } {
  const absolute = current - previous;
  const percentage =
    previous !== 0 ? ((current - previous) / previous) * 100 : current > 0 ? 100 : 0;
  const direction = absolute > 0 ? 'up' : absolute < 0 ? 'down' : 'same';
  return { absolute, percentage, direction };
}

function formatChange(
  change: { absolute: number; percentage: number; direction: 'up' | 'down' | 'same' },
  isExpense: boolean = false
): string {
  const sign = change.direction === 'up' ? '+' : change.direction === 'down' ? '' : '±';
  const percentStr = `${sign}${change.percentage.toFixed(1)}%`;

  // For expenses, "up" is bad, for income/net, "up" is good
  const indicator =
    change.direction === 'same'
      ? '→'
      : isExpense
        ? change.direction === 'up'
          ? '↑ ⚠️'
          : '↓ ✓'
        : change.direction === 'up'
          ? '↑ ✓'
          : '↓ ⚠️';

  return `${percentStr} ${indicator}`;
}

export async function comparePeriods(args: Record<string, unknown>): Promise<unknown> {
  const input = comparePeriodsSchema.parse(args) as ComparePeriodsInput;
  const userId = getCurrentUserId();
  const transactionRepo = AppDataSource.getRepository(Transaction);

  // Get current period range
  const currentRange = getPeriodRange(input.period, input.current_date);

  // Calculate default compare date (previous period)
  let compareDate = input.compare_date;
  if (!compareDate) {
    const ref = input.current_date ? new Date(input.current_date) : new Date();
    switch (input.period) {
      case 'month':
        ref.setMonth(ref.getMonth() - 1);
        break;
      case 'quarter':
        ref.setMonth(ref.getMonth() - 3);
        break;
      case 'year':
        ref.setFullYear(ref.getFullYear() - 1);
        break;
    }
    compareDate = ref.toISOString().split('T')[0];
  }

  const compareRange = getPeriodRange(input.period, compareDate);

  // Fetch transactions for both periods
  const [currentTx, compareTx] = await Promise.all([
    transactionRepo.find({
      where: { userId, date: Between(currentRange.start, currentRange.end) },
      relations: ['category'],
    }),
    transactionRepo.find({
      where: { userId, date: Between(compareRange.start, compareRange.end) },
      relations: ['category'],
    }),
  ]);

  // Calculate metrics for current period
  const currentIncome = currentTx
    .filter((tx) => tx.type === 'income')
    .reduce((sum, tx) => sum + Number(tx.amount), 0);
  const currentExpenses = currentTx
    .filter((tx) => tx.type === 'expense')
    .reduce((sum, tx) => sum + Number(tx.amount), 0);
  const currentNet = currentIncome - currentExpenses;
  const currentRatio =
    currentExpenses > 0 ? currentIncome / currentExpenses : currentIncome > 0 ? Infinity : 0;

  // Calculate metrics for compare period
  const compareIncome = compareTx
    .filter((tx) => tx.type === 'income')
    .reduce((sum, tx) => sum + Number(tx.amount), 0);
  const compareExpenses = compareTx
    .filter((tx) => tx.type === 'expense')
    .reduce((sum, tx) => sum + Number(tx.amount), 0);
  const compareNet = compareIncome - compareExpenses;
  const compareRatio =
    compareExpenses > 0 ? compareIncome / compareExpenses : compareIncome > 0 ? Infinity : 0;

  // Calculate changes
  const incomeChange = calculateChange(currentIncome, compareIncome);
  const expensesChange = calculateChange(currentExpenses, compareExpenses);
  const netChange = calculateChange(currentNet, compareNet);

  // Top expenses comparison
  const currentTopExpenses = currentTx
    .filter((tx) => tx.type === 'expense')
    .sort((a, b) => Number(b.amount) - Number(a.amount))
    .slice(0, 5)
    .map((tx) => ({
      description: tx.description,
      amount: Number(tx.amount),
      category: tx.category?.name || t('common.noCategory'),
    }));

  return {
    comparison: {
      current_period: currentRange.label,
      compare_period: compareRange.label,
    },
    income: {
      current: formatCurrency(currentIncome),
      previous: formatCurrency(compareIncome),
      change: formatChange(incomeChange),
      change_absolute: formatCurrency(incomeChange.absolute),
      change_percentage: incomeChange.percentage.toFixed(1) + '%',
      direction: incomeChange.direction,
    },
    expenses: {
      current: formatCurrency(currentExpenses),
      previous: formatCurrency(compareExpenses),
      change: formatChange(expensesChange, true),
      change_absolute: formatCurrency(expensesChange.absolute),
      change_percentage: expensesChange.percentage.toFixed(1) + '%',
      direction: expensesChange.direction,
    },
    net: {
      current: formatCurrency(currentNet),
      previous: formatCurrency(compareNet),
      change: formatChange(netChange),
      change_absolute: formatCurrency(netChange.absolute),
      change_percentage: netChange.percentage.toFixed(1) + '%',
      direction: netChange.direction,
    },
    ratio: {
      current: currentRatio === Infinity ? '∞' : currentRatio.toFixed(2),
      previous: compareRatio === Infinity ? '∞' : compareRatio.toFixed(2),
      health:
        currentRatio >= 1.5
          ? t('common.healthy')
          : currentRatio >= 1
            ? t('common.neutral')
            : t('common.critical'),
    },
    transaction_count: {
      current: currentTx.length,
      previous: compareTx.length,
    },
    top_expenses_current: currentTopExpenses,
  };
}

interface QuarterData {
  quarter: number;
  label: string;
  income: number;
  expenses: number;
  net: number;
  incomeByCategory: Record<string, number>;
  expensesByCategory: Record<string, number>;
}

function getQuarterRange(year: number, quarter: number): { start: Date; end: Date } {
  const startMonth = (quarter - 1) * 3;
  const start = new Date(year, startMonth, 1);
  const end = new Date(year, startMonth + 3, 0, 23, 59, 59, 999);
  return { start, end };
}

export async function getTaxSummary(args: Record<string, unknown>): Promise<unknown> {
  const input = getTaxSummarySchema.parse(args) as GetTaxSummaryInput;
  const userId = getCurrentUserId();

  // PRO-only feature
  const tier = await getUserTier(userId);
  if (tier !== 'pro') {
    return {
      success: false,
      message: t('summary.taxProOnly', { url: UPGRADE_URL }),
    };
  }

  const transactionRepo = AppDataSource.getRepository(Transaction);

  const year = input.year;
  const specificQuarter = input.quarter;

  // Determine which quarters to fetch
  const quartersToFetch = specificQuarter ? [specificQuarter] : [1, 2, 3, 4];

  // Fetch all transactions for the year
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);

  const allTransactions = await transactionRepo.find({
    where: {
      userId,
      date: Between(yearStart, yearEnd),
    },
    relations: ['category'],
    order: { date: 'ASC' },
  });

  // Process each quarter
  const quarters: QuarterData[] = [];

  for (const q of quartersToFetch) {
    const { start, end } = getQuarterRange(year, q);

    const quarterTx = allTransactions.filter((tx) => {
      const txDate = new Date(tx.date);
      return txDate >= start && txDate <= end;
    });

    const incomeTx = quarterTx.filter((tx) => tx.type === 'income');
    const expenseTx = quarterTx.filter((tx) => tx.type === 'expense');

    const income = incomeTx.reduce((sum, tx) => sum + Number(tx.amount), 0);
    const expenses = expenseTx.reduce((sum, tx) => sum + Number(tx.amount), 0);

    // Group by category
    const incomeByCategory: Record<string, number> = {};
    for (const tx of incomeTx) {
      const cat = tx.category?.name || t('common.noCategory');
      incomeByCategory[cat] = (incomeByCategory[cat] || 0) + Number(tx.amount);
    }

    const expensesByCategory: Record<string, number> = {};
    for (const tx of expenseTx) {
      const cat = tx.category?.name || t('common.noCategory');
      expensesByCategory[cat] = (expensesByCategory[cat] || 0) + Number(tx.amount);
    }

    quarters.push({
      quarter: q,
      label: `Q${q} ${year}`,
      income,
      expenses,
      net: income - expenses,
      incomeByCategory,
      expensesByCategory,
    });
  }

  // Calculate year totals
  const yearIncome = quarters.reduce((sum, q) => sum + q.income, 0);
  const yearExpenses = quarters.reduce((sum, q) => sum + q.expenses, 0);
  const yearNet = yearIncome - yearExpenses;

  // Aggregate categories across all quarters
  const totalIncomeByCategory: Record<string, number> = {};
  const totalExpensesByCategory: Record<string, number> = {};

  for (const q of quarters) {
    for (const [cat, amount] of Object.entries(q.incomeByCategory)) {
      totalIncomeByCategory[cat] = (totalIncomeByCategory[cat] || 0) + amount;
    }
    for (const [cat, amount] of Object.entries(q.expensesByCategory)) {
      totalExpensesByCategory[cat] = (totalExpensesByCategory[cat] || 0) + amount;
    }
  }

  // Format output
  const formatCategoryBreakdown = (categories: Record<string, number>) =>
    Object.entries(categories)
      .sort(([, a], [, b]) => b - a)
      .map(([name, amount]) => ({
        kategorie: name,
        betrag: Number(amount.toFixed(2)),
        formatted: formatCurrency(amount),
      }));

  return {
    jahr: year,
    zeitraum: specificQuarter ? `Q${specificQuarter} ${year}` : `${year} (${t('common.total')})`,

    // EÜR-Übersicht
    einnahmen_ueberschuss_rechnung: {
      betriebseinnahmen: {
        gesamt: Number(yearIncome.toFixed(2)),
        formatted: formatCurrency(yearIncome),
        nach_kategorie: formatCategoryBreakdown(totalIncomeByCategory),
      },
      betriebsausgaben: {
        gesamt: Number(yearExpenses.toFixed(2)),
        formatted: formatCurrency(yearExpenses),
        nach_kategorie: formatCategoryBreakdown(totalExpensesByCategory),
      },
      gewinn_verlust: {
        betrag: Number(yearNet.toFixed(2)),
        formatted: formatCurrency(yearNet),
        status: yearNet >= 0 ? t('common.profit') : t('common.loss'),
      },
    },

    // Quartalsübersicht
    quartale: quarters.map((q) => ({
      quartal: q.label,
      einnahmen: formatCurrency(q.income),
      ausgaben: formatCurrency(q.expenses),
      ergebnis: formatCurrency(q.net),
      einnahmen_raw: Number(q.income.toFixed(2)),
      ausgaben_raw: Number(q.expenses.toFixed(2)),
      ergebnis_raw: Number(q.net.toFixed(2)),
    })),

    // Hinweis für Steuerberater
    hinweis: t('summary.taxHint'),

    // Export-Tipp
    export_tipp: t('summary.exportTip'),
  };
}
