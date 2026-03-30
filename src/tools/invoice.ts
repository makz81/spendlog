import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { AppDataSource } from '../db/index.js';
import { Invoice } from '../entities/Invoice.js';
import { Profile } from '../entities/Profile.js';
import {
  createInvoiceSchema,
  listInvoicesSchema,
  getInvoiceSchema,
  type CreateInvoiceInput,
  type ListInvoicesInput,
  type GetInvoiceInput,
} from '../utils/validation.js';
import { z } from 'zod';
import { parseDate, formatDate } from '../utils/date.js';
import { formatCurrency } from '../utils/format.js';
import { getCurrentUserId } from './index.js';
import { generateInvoicePdf, prepareInvoiceData } from '../services/pdf.js';
import { t } from '../i18n/index.js';

export function getInvoiceToolDefinitions(): Tool[] {
  return [
    {
      name: 'create_invoice',
      annotations: {},
      description: t('invoice.createDesc'),
      inputSchema: {
        type: 'object',
        properties: {
          client_name: {
            type: 'string',
            description: t('invoice.clientNameDesc'),
          },
          client_address: {
            type: 'string',
            description: t('invoice.clientAddressDesc'),
          },
          items: {
            type: 'array',
            description: t('invoice.itemsDesc'),
            items: {
              type: 'object',
              properties: {
                description: {
                  type: 'string',
                  description: t('invoice.itemDescriptionDesc'),
                },
                amount: {
                  type: 'number',
                  description: t('invoice.itemAmountDesc'),
                },
                quantity: {
                  type: 'number',
                  description: t('invoice.itemQuantityDesc'),
                },
              },
              required: ['description', 'amount'],
            },
          },
          date: {
            type: 'string',
            description: t('invoice.invoiceDateDesc'),
          },
          due_date: {
            type: 'string',
            description: t('invoice.dueDateDesc'),
          },
          notes: {
            type: 'string',
            description: t('invoice.notesDesc'),
          },
        },
        required: ['client_name', 'items'],
      },
    },
    {
      name: 'list_invoices',
      annotations: { readOnlyHint: true },
      description: t('invoice.listDesc'),
      inputSchema: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['all', 'draft', 'sent', 'paid'],
            description: t('invoice.statusFilterDesc'),
          },
          limit: {
            type: 'number',
            description: t('invoice.listLimitDesc'),
          },
        },
      },
    },
    {
      name: 'get_invoice',
      annotations: { readOnlyHint: true },
      description: t('invoice.getDesc'),
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: t('invoice.getIdDesc'),
          },
        },
        required: ['id'],
      },
    },
    {
      name: 'mark_invoice_sent',
      annotations: {},
      description: t('invoice.markSentDesc'),
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: t('invoice.getIdDesc'),
          },
        },
        required: ['id'],
      },
    },
    {
      name: 'mark_invoice_paid',
      annotations: {},
      description: t('invoice.markPaidDesc'),
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: t('invoice.getIdDesc'),
          },
        },
        required: ['id'],
      },
    },
    {
      name: 'delete_invoice',
      annotations: { destructiveHint: true },
      description: t('invoice.deleteDesc'),
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: t('invoice.getIdDesc'),
          },
        },
        required: ['id'],
      },
    },
    {
      name: 'duplicate_invoice',
      annotations: {},
      description: t('invoice.duplicateDesc'),
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: t('invoice.duplicateIdDesc'),
          },
          date: {
            type: 'string',
            description: t('invoice.duplicateDateDesc'),
          },
          due_date: {
            type: 'string',
            description: t('invoice.duplicateDueDateDesc'),
          },
        },
        required: ['id'],
      },
    },
  ];
}

async function generateInvoiceNumber(userId: string): Promise<string> {
  const invoiceRepo = AppDataSource.getRepository(Invoice);
  const year = new Date().getFullYear();

  // Count invoices this year
  const count = await invoiceRepo
    .createQueryBuilder('invoice')
    .where('invoice.userId = :userId', { userId })
    .andWhere('invoice.invoiceNumber LIKE :pattern', { pattern: `${year}-%` })
    .getCount();

  const nextNumber = count + 1;
  return `${year}-${String(nextNumber).padStart(3, '0')}`;
}

export async function createInvoice(args: Record<string, unknown>): Promise<unknown> {
  const input = createInvoiceSchema.parse(args) as CreateInvoiceInput;
  const userId = getCurrentUserId();

  const profileRepo = AppDataSource.getRepository(Profile);
  const profile = await profileRepo.findOne({ where: { userId } });

  if (!profile) {
    return {
      success: false,
      error: t('invoice.noProfile'),
    };
  }

  const invoiceRepo = AppDataSource.getRepository(Invoice);

  const items = input.items.map((item) => ({
    description: item.description,
    quantity: item.quantity || 1,
    unitPrice: item.amount,
    total: (item.quantity || 1) * item.amount,
  }));

  const totalAmount = items.reduce((sum, item) => sum + item.total, 0);
  const invoiceNumber = await generateInvoiceNumber(userId);

  const invoice = invoiceRepo.create({
    userId,
    invoiceNumber,
    clientName: input.client_name,
    clientAddress: input.client_address,
    items,
    totalAmount,
    date: input.date ? parseDate(input.date) : new Date(),
    dueDate: input.due_date ? parseDate(input.due_date) : undefined,
    notes: input.notes,
    status: 'draft',
  });

  await invoiceRepo.save(invoice);

  let pdfGenerated = false;
  try {
    const pdfData = prepareInvoiceData(invoice, profile);
    const pdfPath = await generateInvoicePdf(pdfData);
    invoice.pdfPath = pdfPath;
    await invoiceRepo.save(invoice);
    pdfGenerated = true;
  } catch {
    // Invoice saved without PDF — Puppeteer likely not installed
  }

  return {
    success: true,
    message: t('invoice.created', { number: invoiceNumber, client: input.client_name }),
    invoice: {
      id: invoice.id,
      number: invoice.invoiceNumber,
      client: invoice.clientName,
      total: formatCurrency(totalAmount),
      date: formatDate(invoice.date),
      status: invoice.status,
      pdf_generated: pdfGenerated,
    },
    ...(!pdfGenerated && { warning: 'PDF generation failed. Install puppeteer for PDF invoices: npm install puppeteer' }),
  };
}

export async function listInvoices(args: Record<string, unknown>): Promise<unknown> {
  const input = listInvoicesSchema.parse(args) as ListInvoicesInput;
  const userId = getCurrentUserId();
  const invoiceRepo = AppDataSource.getRepository(Invoice);

  const where: Record<string, unknown> = { userId };
  if (input.status && input.status !== 'all') {
    where.status = input.status;
  }

  const invoices = await invoiceRepo.find({
    where,
    order: { date: 'DESC', createdAt: 'DESC' },
    take: input.limit,
  });

  const formattedInvoices = invoices.map((inv) => ({
    id: inv.id,
    number: inv.invoiceNumber,
    client: inv.clientName,
    total: formatCurrency(Number(inv.totalAmount)),
    date: formatDate(inv.date),
    status: inv.status,
    status_de:
      inv.status === 'draft'
        ? t('invoice.statusDraft')
        : inv.status === 'sent'
          ? t('invoice.statusSent')
          : t('invoice.statusPaid'),
  }));

  const totalValue = invoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0);

  return {
    invoices: formattedInvoices,
    total: invoices.length,
    summary: {
      total_value: formatCurrency(totalValue),
      draft: invoices.filter((i) => i.status === 'draft').length,
      sent: invoices.filter((i) => i.status === 'sent').length,
      paid: invoices.filter((i) => i.status === 'paid').length,
    },
  };
}

export async function getInvoice(args: Record<string, unknown>): Promise<unknown> {
  const input = getInvoiceSchema.parse(args) as GetInvoiceInput;
  const userId = getCurrentUserId();
  const invoiceRepo = AppDataSource.getRepository(Invoice);

  const invoice = await invoiceRepo.findOne({
    where: { id: input.id, userId },
  });

  if (!invoice) {
    throw new Error(t('invoice.notFound'));
  }

  return {
    id: invoice.id,
    number: invoice.invoiceNumber,
    client: {
      name: invoice.clientName,
      address: invoice.clientAddress || null,
    },
    items: invoice.items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unit_price: formatCurrency(item.unitPrice),
      total: formatCurrency(item.total),
    })),
    total: formatCurrency(Number(invoice.totalAmount)),
    date: formatDate(invoice.date),
    due_date: invoice.dueDate ? formatDate(invoice.dueDate) : null,
    notes: invoice.notes || null,
    status: invoice.status,
    status_de:
      invoice.status === 'draft'
        ? t('invoice.statusDraft')
        : invoice.status === 'sent'
          ? t('invoice.statusSent')
          : t('invoice.statusPaid'),
    has_pdf: !!invoice.pdfPath,
  };
}

async function markInvoiceStatus(args: Record<string, unknown>, status: 'sent' | 'paid'): Promise<unknown> {
  const input = getInvoiceSchema.parse(args) as GetInvoiceInput;
  const userId = getCurrentUserId();
  const invoiceRepo = AppDataSource.getRepository(Invoice);

  const invoice = await invoiceRepo.findOne({
    where: { id: input.id, userId },
  });

  if (!invoice) {
    throw new Error(t('invoice.notFound'));
  }

  invoice.status = status;
  await invoiceRepo.save(invoice);

  const i18nKey = status === 'sent' ? 'invoice.markedSent' : 'invoice.markedPaid';
  const i18nParams: Record<string, string> = { number: invoice.invoiceNumber };
  if (status === 'paid') {
    i18nParams.amount = formatCurrency(Number(invoice.totalAmount));
  }

  return {
    success: true,
    message: t(i18nKey, i18nParams),
  };
}

export async function markInvoiceSent(args: Record<string, unknown>): Promise<unknown> {
  return markInvoiceStatus(args, 'sent');
}

export async function markInvoicePaid(args: Record<string, unknown>): Promise<unknown> {
  return markInvoiceStatus(args, 'paid');
}

const deleteInvoiceSchema = z.object({
  id: z.string().uuid(),
});

export async function deleteInvoice(args: Record<string, unknown>): Promise<unknown> {
  const input = deleteInvoiceSchema.parse(args);
  const userId = getCurrentUserId();
  const invoiceRepo = AppDataSource.getRepository(Invoice);

  const invoice = await invoiceRepo.findOne({
    where: { id: input.id, userId },
  });

  if (!invoice) {
    throw new Error(t('invoice.notFound'));
  }

  // Clean up PDF file if it exists
  if (invoice.pdfPath) {
    const fs = await import('fs');
    try {
      fs.unlinkSync(invoice.pdfPath);
    } catch {
      // PDF file already gone, that's fine
    }
  }

  const number = invoice.invoiceNumber;
  await invoiceRepo.remove(invoice);

  return {
    success: true,
    message: t('invoice.deleted', { number }),
  };
}

const duplicateInvoiceSchema = z.object({
  id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
});

export async function duplicateInvoice(args: Record<string, unknown>): Promise<unknown> {
  const input = duplicateInvoiceSchema.parse(args);
  const id = input.id;
  const newDate = input.date;
  const newDueDate = input.due_date;

  const userId = getCurrentUserId();

  // Get profile for PDF generation
  const profileRepo = AppDataSource.getRepository(Profile);
  const profile = await profileRepo.findOne({ where: { userId } });

  if (!profile) {
    return {
      success: false,
      error: t('invoice.noProfile'),
    };
  }

  const invoiceRepo = AppDataSource.getRepository(Invoice);

  // Find original invoice
  const original = await invoiceRepo.findOne({
    where: { id, userId },
  });

  if (!original) {
    throw new Error(t('invoice.originalNotFound'));
  }

  // Generate new invoice number
  const invoiceNumber = await generateInvoiceNumber(userId);

  // Create duplicate
  const duplicate = invoiceRepo.create({
    userId,
    invoiceNumber,
    clientName: original.clientName,
    clientAddress: original.clientAddress,
    items: original.items, // Copy items as-is
    totalAmount: original.totalAmount,
    date: newDate ? parseDate(newDate) : new Date(),
    dueDate: newDueDate ? parseDate(newDueDate) : undefined,
    notes: original.notes,
    status: 'draft',
  });

  await invoiceRepo.save(duplicate);

  // Generate PDF
  const pdfData = prepareInvoiceData(duplicate, profile);
  const pdfPath = await generateInvoicePdf(pdfData);

  duplicate.pdfPath = pdfPath;
  await invoiceRepo.save(duplicate);

  return {
    success: true,
    message: t('invoice.duplicated', { original: original.invoiceNumber, new: invoiceNumber }),
    invoice: {
      id: duplicate.id,
      number: duplicate.invoiceNumber,
      client: duplicate.clientName,
      total: formatCurrency(Number(duplicate.totalAmount)),
      date: formatDate(duplicate.date),
      status: duplicate.status,
      pdf_generated: true,
    },
    original: {
      number: original.invoiceNumber,
    },
  };
}
