import Handlebars from 'handlebars';
import { readFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { Invoice, InvoiceItem } from '../entities/Invoice.js';
import type { Profile } from '../entities/Profile.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadPuppeteer(): Promise<any> {
  try {
    const mod = await import('puppeteer');
    return mod.default;
  } catch {
    throw new Error('Puppeteer is not installed. For PDF invoices: npm install puppeteer');
  }
}

import { homedir } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = join(__dirname, '../../templates');
const DATA_DIR = process.env.SPENDLOG_DATA_DIR || join(homedir(), '.spendlog');
const INVOICES_DIR = join(DATA_DIR, 'invoices');

// Register Handlebars helpers
Handlebars.registerHelper('formatCurrency', (amount: number) => {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
});

export interface InvoicePdfData {
  invoiceNumber: string;
  clientName: string;
  clientAddress?: string;
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  totalAmount: number;
  date: string;
  dueDate?: string;
  notes?: string;
  profile: {
    companyName: string;
    address: string;
    taxId?: string;
    isKleinunternehmer: boolean;
    bankDetails?: string;
    phone?: string;
    email?: string;
  };
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

export function prepareInvoiceData(invoice: Invoice, profile: Profile): InvoicePdfData {
  const subtotal = invoice.items.reduce((sum, item) => sum + item.total, 0);
  const VAT_RATE = 0.19;
  const tax = profile.isKleinunternehmer ? 0 : subtotal * VAT_RATE;
  const totalAmount = subtotal + tax;

  return {
    invoiceNumber: invoice.invoiceNumber,
    clientName: invoice.clientName,
    clientAddress: invoice.clientAddress,
    items: invoice.items,
    subtotal,
    tax,
    totalAmount,
    date: formatDate(new Date(invoice.date)),
    dueDate: invoice.dueDate ? formatDate(new Date(invoice.dueDate)) : undefined,
    notes: invoice.notes,
    profile: {
      companyName: profile.companyName,
      address: profile.address,
      taxId: profile.taxId,
      isKleinunternehmer: profile.isKleinunternehmer,
      bankDetails: profile.bankDetails,
      phone: profile.phone,
      email: profile.email,
    },
  };
}

export async function generateInvoicePdf(data: InvoicePdfData): Promise<string> {
  if (!existsSync(INVOICES_DIR)) {
    mkdirSync(INVOICES_DIR, { recursive: true });
  }

  const templatePath = join(TEMPLATES_DIR, 'invoice.hbs');
  const templateSource = readFileSync(templatePath, 'utf-8');
  const template = Handlebars.compile(templateSource);

  const html = template(data);

  const puppeteer = await loadPuppeteer();
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on('request', (req: { abort: () => void }) => req.abort());
    await page.setContent(html, { waitUntil: 'domcontentloaded' });

    const filename = `rechnung-${data.invoiceNumber.replace(/\//g, '-')}.pdf`;
    const pdfPath = join(INVOICES_DIR, filename);

    await page.pdf({
      path: pdfPath,
      format: 'A4',
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm',
      },
      printBackground: true,
    });

    return pdfPath;
  } finally {
    await browser.close();
  }
}

export function getInvoicePdfPath(invoiceNumber: string): string {
  const filename = `rechnung-${invoiceNumber.replace(/\//g, '-')}.pdf`;
  return join(INVOICES_DIR, filename);
}
