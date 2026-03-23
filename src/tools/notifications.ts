import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { AppDataSource } from '../db/index.js';
import { Recurring } from '../entities/Recurring.js';
import { Invoice } from '../entities/Invoice.js';
import { Transaction } from '../entities/Transaction.js';
import { Project } from '../entities/Project.js';
import { formatCurrency } from '../utils/format.js';
import { getCurrentUserId } from './index.js';
import { t } from '../i18n/index.js';
import { LessThanOrEqual } from 'typeorm';

interface NotificationItem {
  type: 'recurring_due' | 'budget_alert' | 'invoice_overdue' | 'tax_reminder';
  title: string;
  message: string;
  priority: 'high' | 'medium' | 'low';
  data: Record<string, unknown>;
}

export function getNotificationToolDefinitions(): Tool[] {
  return [
    {
      name: 'get_notifications',
      annotations: { readOnlyHint: true },
      description: t('notifications.getDesc'),
      inputSchema: {
        type: 'object',
        properties: {
          days_ahead: {
            type: 'number',
            description: t('notifications.daysAheadDesc'),
          },
        },
      },
    },
  ];
}

export async function getNotifications(args: { days_ahead?: number }) {
  const userId = getCurrentUserId();
  if (!userId) {
    return { error: t('notifications.noConnection') };
  }

  const daysAhead = args.days_ahead ?? 7;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const futureDate = new Date(today);
  futureDate.setDate(futureDate.getDate() + daysAhead);

  const notifications: NotificationItem[] = [];

  // 1. Check recurring transactions due soon
  const recurringRepo = AppDataSource.getRepository(Recurring);
  const recurringDue = await recurringRepo.find({
    where: {
      userId,
      active: true,
      nextDue: LessThanOrEqual(futureDate),
    },
  });

  for (const r of recurringDue) {
    if (r.nextDue) {
      const dueDate = new Date(r.nextDue);
      const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      if (daysUntilDue >= 0) {
        const priority = daysUntilDue <= 1 ? 'high' : daysUntilDue <= 3 ? 'medium' : 'low';
        notifications.push({
          type: 'recurring_due',
          title: t('notifications.recurringDue'),
          message:
            daysUntilDue === 0
              ? t('notifications.recurringDueToday', {
                  description: r.description,
                  amount: formatCurrency(Number(r.amount)),
                })
              : t('notifications.recurringDueDays', {
                  description: r.description,
                  amount: formatCurrency(Number(r.amount)),
                  days: String(daysUntilDue),
                }),
          priority,
          data: { recurring_id: r.id, amount: r.amount, days: daysUntilDue },
        });
      }
    }
  }

  // 2. Check overdue invoices
  const invoiceRepo = AppDataSource.getRepository(Invoice);
  const sentInvoices = await invoiceRepo.find({
    where: {
      userId,
      status: 'sent',
    },
  });

  for (const inv of sentInvoices) {
    if (inv.dueDate) {
      const dueDate = new Date(inv.dueDate);
      const daysOverdue = Math.ceil((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysOverdue > 0) {
        const priority = daysOverdue >= 14 ? 'high' : daysOverdue >= 7 ? 'medium' : 'low';
        notifications.push({
          type: 'invoice_overdue',
          title: t('notifications.invoiceOverdue'),
          message: t('notifications.invoiceOverdueMsg', {
            number: inv.invoiceNumber || inv.id.slice(0, 8),
            client: inv.clientName,
            days: String(daysOverdue),
            amount: formatCurrency(Number(inv.totalAmount)),
          }),
          priority,
          data: {
            invoice_id: inv.id,
            days: daysOverdue,
            client: inv.clientName,
            total: inv.totalAmount,
          },
        });
      }
    }
  }

  // 3. Check budget alerts
  const projectRepo = AppDataSource.getRepository(Project);
  const transactionRepo = AppDataSource.getRepository(Transaction);

  const projects = await projectRepo.find({
    where: { userId, status: 'active' },
  });

  for (const project of projects) {
    if (project.budget && project.budget > 0) {
      const expenses = await transactionRepo
        .createQueryBuilder('t')
        .where('t.userId = :userId', { userId })
        .andWhere('t.projectId = :projectId', { projectId: project.id })
        .andWhere('t.type = :type', { type: 'expense' })
        .select('SUM(t.amount)', 'total')
        .getRawOne();

      const spent = Number(expenses?.total || 0);
      const percentUsed = (spent / project.budget) * 100;

      if (percentUsed >= 80) {
        const priority = percentUsed >= 100 ? 'high' : percentUsed >= 90 ? 'medium' : 'low';
        notifications.push({
          type: 'budget_alert',
          title: t('notifications.budgetAlert'),
          message: t('notifications.budgetAlertMsg', {
            project: project.name,
            percent: String(Math.round(percentUsed)),
            spent: formatCurrency(spent),
            budget: formatCurrency(project.budget),
          }),
          priority,
          data: {
            project_id: project.id,
            percent: Math.round(percentUsed),
            spent,
            budget: project.budget,
          },
        });
      }
    }
  }

  // 4. Check tax quarter reminders
  const month = today.getMonth() + 1;
  const quarterEndMonths = [3, 6, 9, 12];
  const currentQuarterEnd = quarterEndMonths.find((m) => m >= month) || 3;
  const quarterEndDate = new Date(
    today.getFullYear() + (currentQuarterEnd < month ? 1 : 0),
    currentQuarterEnd,
    0
  );
  const daysUntilQuarterEnd = Math.ceil(
    (quarterEndDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysUntilQuarterEnd >= 0 && daysUntilQuarterEnd <= 7) {
    const quarterNum = Math.ceil(currentQuarterEnd / 3);
    notifications.push({
      type: 'tax_reminder',
      title: t('notifications.taxReminder'),
      message: t('notifications.taxReminderMsg', {
        quarter: String(quarterNum),
        days: String(daysUntilQuarterEnd),
      }),
      priority: daysUntilQuarterEnd <= 3 ? 'high' : 'medium',
      data: { quarter: quarterNum, days: daysUntilQuarterEnd },
    });
  }

  // Sort by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  notifications.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  // Format output
  if (notifications.length === 0) {
    return {
      notifications: [],
      summary: t('notifications.noNotifications'),
    };
  }

  const highPriority = notifications.filter((n) => n.priority === 'high').length;
  const mediumPriority = notifications.filter((n) => n.priority === 'medium').length;

  return {
    notifications,
    summary:
      highPriority > 0
        ? t('notifications.summaryCountImportant', {
            count: String(notifications.length),
            important: String(highPriority),
          })
        : t('notifications.summaryCount', { count: String(notifications.length) }),
    counts: {
      total: notifications.length,
      high: highPriority,
      medium: mediumPriority,
      low: notifications.length - highPriority - mediumPriority,
    },
  };
}
