import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { AppDataSource } from '../db/index.js';
import { Transaction } from '../entities/Transaction.js';
import { Invoice } from '../entities/Invoice.js';
import {
  exportTransactionsSchema,
  exportForTaxAdvisorSchema,
  type ExportTransactionsInput,
  type ExportForTaxAdvisorInput,
} from '../utils/validation.js';
import { parseDate, formatDate } from '../utils/date.js';
import { getCurrentUserId } from './index.js';
import { Between, FindOptionsWhere } from 'typeorm';
import { z } from 'zod';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { t } from '../i18n/index.js';

import { homedir } from 'os';

const DATA_DIR = process.env.SPENDLOG_DATA_DIR || join(homedir(), '.spendlog');
const EXPORTS_DIR = join(DATA_DIR, 'exports');

interface KontoMapping {
  skr03: string;
  skr04: string;
  euerZeile: string;
  beschreibung: string;
}

// Expense categories -> SKR03/SKR04 accounts + EÜR lines
// Both DE and EN category names map to the same accounts
const EXPENSE_KONTO_ENTRIES: Array<{ names: string[]; mapping: KontoMapping }> = [
  { names: ['IT & Software'], mapping: { skr03: '4964', skr04: '6830', euerZeile: '46', beschreibung: 'EDV-Kosten, Software, Cloud-Services' } },
  { names: ['Marketing & Werbung', 'Marketing & Advertising'], mapping: { skr03: '4600', skr04: '6600', euerZeile: '47', beschreibung: 'Werbekosten' } },
  { names: ['Büro & Material', 'Office & Supplies'], mapping: { skr03: '4930', skr04: '6815', euerZeile: '48', beschreibung: 'Bürobedarf, Verbrauchsmaterial' } },
  { names: ['Reisen & Transport', 'Travel & Transport'], mapping: { skr03: '4670', skr04: '6650', euerZeile: '51', beschreibung: 'Reisekosten Unternehmer' } },
  { names: ['Weiterbildung', 'Education'], mapping: { skr03: '4945', skr04: '6821', euerZeile: '46', beschreibung: 'Fortbildungskosten' } },
  { names: ['Telefon & Internet', 'Phone & Internet'], mapping: { skr03: '4920', skr04: '6805', euerZeile: '46', beschreibung: 'Telefon, Internet, Porto' } },
  { names: ['Versicherungen', 'Insurance'], mapping: { skr03: '4360', skr04: '6400', euerZeile: '45', beschreibung: 'Versicherungen (betrieblich)' } },
  { names: ['Sonstiges', 'Other'], mapping: { skr03: '4900', skr04: '6800', euerZeile: '60', beschreibung: 'Sonstige betriebliche Aufwendungen' } },
  { names: ['Rechts- & Beratungskosten'], mapping: { skr03: '4950', skr04: '6825', euerZeile: '46', beschreibung: 'Rechts- und Beratungskosten' } },
  { names: ['Miete & Nebenkosten'], mapping: { skr03: '4210', skr04: '6310', euerZeile: '39', beschreibung: 'Miete für Geschäftsräume' } },
];

const EXPENSE_KONTO_MAP: Record<string, KontoMapping> = Object.fromEntries(
  EXPENSE_KONTO_ENTRIES.flatMap(({ names, mapping }) => names.map((n) => [n, mapping])),
);

// Income categories -> SKR03/SKR04 accounts + EÜR lines
const INCOME_KONTO_ENTRIES: Array<{ names: string[]; mapping: KontoMapping }> = [
  { names: ['Dienstleistung', 'Service'], mapping: { skr03: '8400', skr04: '4400', euerZeile: '14', beschreibung: 'Erlöse aus Dienstleistungen' } },
  { names: ['Produktverkauf', 'Product Sales'], mapping: { skr03: '8200', skr04: '4200', euerZeile: '14', beschreibung: 'Erlöse aus Warenverkauf' } },
  { names: ['Affiliate/Provision', 'Affiliate/Commission'], mapping: { skr03: '8519', skr04: '4519', euerZeile: '14', beschreibung: 'Provisionserlöse' } },
  { names: ['Sonstiges', 'Other'], mapping: { skr03: '8300', skr04: '4300', euerZeile: '20', beschreibung: 'Sonstige betriebliche Erträge' } },
];

const INCOME_KONTO_MAP: Record<string, KontoMapping> = Object.fromEntries(
  INCOME_KONTO_ENTRIES.flatMap(({ names, mapping }) => names.map((n) => [n, mapping])),
);

const DEFAULT_EXPENSE_KONTO: KontoMapping = {
  skr03: '4900',
  skr04: '6800',
  euerZeile: '60',
  beschreibung: 'Sonstige Ausgaben (nicht zugeordnet)',
};

const DEFAULT_INCOME_KONTO: KontoMapping = {
  skr03: '8300',
  skr04: '4300',
  euerZeile: '20',
  beschreibung: 'Sonstige Einnahmen (nicht zugeordnet)',
};

function getKontoMapping(categoryName: string, type: 'income' | 'expense'): KontoMapping {
  if (type === 'income') {
    return INCOME_KONTO_MAP[categoryName] || DEFAULT_INCOME_KONTO;
  }
  return EXPENSE_KONTO_MAP[categoryName] || DEFAULT_EXPENSE_KONTO;
}

export function getExportToolDefinitions(): Tool[] {
  return [
    {
      name: 'export_transactions',
      annotations: {},
      description: t('export.transactionsDesc'),
      inputSchema: {
        type: 'object',
        properties: {
          format: {
            type: 'string',
            enum: ['csv', 'json'],
            description: t('export.formatDesc'),
          },
          from_date: {
            type: 'string',
            description: t('export.fromDateDesc'),
          },
          to_date: {
            type: 'string',
            description: t('export.toDateDesc'),
          },
        },
        required: ['format'],
      },
    },
    {
      name: 'export_invoices',
      annotations: {},
      description: t('export.invoicesDesc'),
      inputSchema: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['all', 'draft', 'sent', 'paid'],
            description: t('export.invoiceStatusDesc'),
          },
        },
      },
    },
    {
      name: 'export_for_tax_advisor',
      annotations: {},
      description: t('export.taxAdvisorDesc'),
      inputSchema: {
        type: 'object',
        properties: {
          year: {
            type: 'number',
            description: t('export.taxYearDesc'),
          },
          quarter: {
            type: 'number',
            description: t('export.taxQuarterDesc'),
          },
          format: {
            type: 'string',
            enum: ['csv', 'json', 'datev'],
            description: t('export.taxFormatDesc'),
          },
          kontenrahmen: {
            type: 'string',
            enum: ['SKR03', 'SKR04'],
            description: t('export.taxKontenrahmenDesc'),
          },
        },
        required: ['year'],
      },
    },
  ];
}

function ensureExportsDir(): void {
  if (!existsSync(EXPORTS_DIR)) {
    mkdirSync(EXPORTS_DIR, { recursive: true });
  }
}

function generateFilename(prefix: string, format: string): string {
  const date = new Date().toISOString().split('T')[0];
  const time = new Date().toISOString().split('T')[1].slice(0, 5).replace(':', '');
  return `${prefix}-${date}-${time}.${format}`;
}

function formatGermanNumber(num: number): string {
  return num.toFixed(2).replace('.', ',');
}

function formatDateDDMMYYYY(date: Date): string {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

function formatDateDDMM(date: Date): string {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  return `${day}${month}`;
}

function escapeCSV(str: string): string {
  if (str.includes(';') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

interface TransactionExport {
  id: string;
  datum: string;
  typ: string;
  betrag: number;
  beschreibung: string;
  kategorie: string;
}

function transactionsToCSV(transactions: TransactionExport[]): string {
  const headers = ['Datum', 'Typ', 'Betrag (EUR)', 'Beschreibung', 'Kategorie'];
  const rows = transactions.map((t) => [
    t.datum,
    t.typ === 'income' ? 'Einnahme' : 'Ausgabe',
    formatGermanNumber(t.betrag),
    escapeCSV(t.beschreibung),
    escapeCSV(t.kategorie),
  ]);

  return [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
}

export async function exportTransactions(args: Record<string, unknown>): Promise<unknown> {
  const input = exportTransactionsSchema.parse(args) as ExportTransactionsInput;
  const userId = getCurrentUserId();

  const txRepo = AppDataSource.getRepository(Transaction);

  const where: FindOptionsWhere<Transaction> = { userId };

  if (input.from_date && input.to_date) {
    where.date = Between(parseDate(input.from_date), parseDate(input.to_date));
  }

  const transactions = await txRepo.find({
    where,
    relations: ['category'],
    order: { date: 'ASC' },
  });

  if (transactions.length === 0) {
    return {
      success: false,
      message: t('export.noTransactions'),
    };
  }

  const exportData: TransactionExport[] = transactions.map((tx) => ({
    id: tx.id,
    datum: formatDate(tx.date),
    typ: tx.type,
    betrag: Number(tx.amount),
    beschreibung: tx.description,
    kategorie: tx.category?.name || t('common.noCategory'),
  }));

  ensureExportsDir();

  let content: string;
  let filename: string;

  if (input.format === 'csv') {
    content = transactionsToCSV(exportData);
    filename = generateFilename('transaktionen', 'csv');
  } else {
    content = JSON.stringify(
      {
        exportiert_am: new Date().toISOString(),
        zeitraum: {
          von: input.from_date || 'alle',
          bis: input.to_date || 'alle',
        },
        anzahl: exportData.length,
        summe_einnahmen: exportData
          .filter((t) => t.typ === 'income')
          .reduce((sum, t) => sum + t.betrag, 0),
        summe_ausgaben: exportData
          .filter((t) => t.typ === 'expense')
          .reduce((sum, t) => sum + t.betrag, 0),
        transaktionen: exportData,
      },
      null,
      2
    );
    filename = generateFilename('transaktionen', 'json');
  }

  const filepath = join(EXPORTS_DIR, filename);
  writeFileSync(filepath, content, 'utf-8');

  const totalIncome = exportData
    .filter((t) => t.typ === 'income')
    .reduce((sum, t) => sum + t.betrag, 0);
  const totalExpense = exportData
    .filter((t) => t.typ === 'expense')
    .reduce((sum, t) => sum + t.betrag, 0);

  return {
    success: true,
    message: t('export.transactionsExported', { count: String(transactions.length) }),
    export: {
      format: input.format.toUpperCase(),
      filename,
      path: filepath,
      transactions: transactions.length,
      summary: {
        einnahmen: formatGermanNumber(totalIncome) + ' €',
        ausgaben: formatGermanNumber(totalExpense) + ' €',
        saldo: formatGermanNumber(totalIncome - totalExpense) + ' €',
      },
    },
  };
}

const exportInvoicesSchema = z.object({
  status: z.enum(['all', 'draft', 'sent', 'paid']).default('all'),
});

export async function exportInvoices(args: Record<string, unknown>): Promise<unknown> {
  const { status } = exportInvoicesSchema.parse(args);
  const userId = getCurrentUserId();

  const invoiceRepo = AppDataSource.getRepository(Invoice);

  const where: FindOptionsWhere<Invoice> = { userId };
  if (status !== 'all') {
    where.status = status;
  }

  const invoices = await invoiceRepo.find({
    where,
    order: { date: 'DESC' },
  });

  if (invoices.length === 0) {
    return {
      success: false,
      message: t('export.noInvoices'),
    };
  }

  ensureExportsDir();

  const exportData = {
    exportiert_am: new Date().toISOString(),
    filter: status,
    anzahl: invoices.length,
    gesamtwert: invoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0),
    rechnungen: invoices.map((inv) => ({
      id: inv.id,
      nummer: inv.invoiceNumber,
      kunde: inv.clientName,
      kunde_adresse: inv.clientAddress || null,
      positionen: inv.items,
      betrag: Number(inv.totalAmount),
      datum: formatDate(inv.date),
      zahlungsziel: inv.dueDate ? formatDate(inv.dueDate) : null,
      status: inv.status,
      notizen: inv.notes || null,
      pdf_pfad: inv.pdfPath || null,
    })),
  };

  const filename = generateFilename('rechnungen', 'json');
  const filepath = join(EXPORTS_DIR, filename);
  writeFileSync(filepath, JSON.stringify(exportData, null, 2), 'utf-8');

  const totalValue = invoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0);

  return {
    success: true,
    message: t('export.invoicesExported', { count: String(invoices.length) }),
    export: {
      format: 'JSON',
      filename,
      path: filepath,
      invoices: invoices.length,
      total_value: formatGermanNumber(totalValue) + ' €',
      by_status: {
        entwurf: invoices.filter((i) => i.status === 'draft').length,
        versendet: invoices.filter((i) => i.status === 'sent').length,
        bezahlt: invoices.filter((i) => i.status === 'paid').length,
      },
    },
  };
}

const TAX_DISCLAIMER =
  'HINWEIS: Dieser Export dient der Datenübermittlung an Ihren Steuerberater. ' +
  'Er stellt keine Steuerberatung im Sinne des Steuerberatungsgesetzes (StBerG) dar ' +
  'und ersetzt nicht die Prüfung durch einen Steuerberater. ' +
  'Für die Richtigkeit der Steuererklärung ist der Nutzer selbst verantwortlich.';

interface EnhancedTransaction {
  lfdNr: number;
  datum: Date;
  datumFormatted: string;
  typ: 'income' | 'expense';
  betrag: number;
  beschreibung: string;
  kategorie: string;
  projekt: string | null;
  konto: KontoMapping;
}

interface CategorySummaryEnhanced {
  kategorie: string;
  konto: KontoMapping;
  anzahl: number;
  summe: number;
  transaktionen: EnhancedTransaction[];
}

interface EuerZeileSummary {
  zeile: string;
  bezeichnung: string;
  summe: number;
  kategorien: string[];
}

function taxExportToEnhancedCSV(
  einnahmen: CategorySummaryEnhanced[],
  ausgaben: CategorySummaryEnhanced[],
  euerEinnahmen: EuerZeileSummary[],
  euerAusgaben: EuerZeileSummary[],
  period: string,
  totals: { einnahmen: number; ausgaben: number; gewinn: number },
  kontenrahmen: 'SKR03' | 'SKR04',
  allTransactions: EnhancedTransaction[]
): string {
  const lines: string[] = [];

  lines.push('# ═══════════════════════════════════════════════════════════════════════════════');
  lines.push('# STEUERBERATER-EXPORT');
  lines.push('# ═══════════════════════════════════════════════════════════════════════════════');
  lines.push(`# Zeitraum: ${period}`);
  lines.push(`# Erstellt: ${new Date().toLocaleString('de-DE')}`);
  lines.push(`# Kontenrahmen: ${kontenrahmen}`);
  lines.push(`# Transaktionen: ${allTransactions.length}`);
  lines.push('#');
  lines.push(`# ${TAX_DISCLAIMER}`);
  lines.push('# ═══════════════════════════════════════════════════════════════════════════════');
  lines.push('');

  lines.push('# ───────────────────────────────────────────────────────────────────────────────');
  lines.push('# ZUSAMMENFASSUNG - GEWINNERMITTLUNG');
  lines.push('# ───────────────────────────────────────────────────────────────────────────────');
  lines.push('');
  lines.push('Position;Betrag (EUR)');
  lines.push(`Betriebseinnahmen gesamt;${formatGermanNumber(totals.einnahmen)}`);
  lines.push(`Betriebsausgaben gesamt;${formatGermanNumber(totals.ausgaben)}`);
  lines.push(`═══════════════════════════════════════════════════════`);
  lines.push(`GEWINN (Einnahmen - Ausgaben);${formatGermanNumber(totals.gewinn)}`);
  lines.push('');

  lines.push('# ───────────────────────────────────────────────────────────────────────────────');
  lines.push('# EÜR-ZEILEN ZUORDNUNG (Anlage EÜR)');
  lines.push('# ───────────────────────────────────────────────────────────────────────────────');
  lines.push('');

  // Einnahmen EÜR-Zeilen
  lines.push('# BETRIEBSEINNAHMEN (Zeilen 12-22)');
  lines.push('EÜR-Zeile;Bezeichnung;Betrag (EUR);Kategorien');
  for (const zeile of euerEinnahmen) {
    lines.push(
      `${zeile.zeile};${zeile.bezeichnung};${formatGermanNumber(zeile.summe)};${zeile.kategorien.join(', ')}`
    );
  }
  lines.push(`SUMME Einnahmen;;${formatGermanNumber(totals.einnahmen)};`);
  lines.push('');

  // Ausgaben EÜR-Zeilen
  lines.push('# BETRIEBSAUSGABEN (Zeilen 24-75)');
  lines.push('EÜR-Zeile;Bezeichnung;Betrag (EUR);Kategorien');
  for (const zeile of euerAusgaben) {
    lines.push(
      `${zeile.zeile};${zeile.bezeichnung};${formatGermanNumber(zeile.summe)};${zeile.kategorien.join(', ')}`
    );
  }
  lines.push(`SUMME Ausgaben;;${formatGermanNumber(totals.ausgaben)};`);
  lines.push('');

  lines.push('# ───────────────────────────────────────────────────────────────────────────────');
  lines.push(`# KONTEN-ÜBERSICHT (${kontenrahmen})`);
  lines.push('# ───────────────────────────────────────────────────────────────────────────────');
  lines.push('');

  // Einnahmen-Konten
  lines.push('# ERLÖSKONTEN');
  lines.push('Konto;Kategorie;Anzahl;Summe (EUR)');
  for (const cat of einnahmen) {
    const konto = kontenrahmen === 'SKR03' ? cat.konto.skr03 : cat.konto.skr04;
    lines.push(`${konto};${cat.kategorie};${cat.anzahl};${formatGermanNumber(cat.summe)}`);
  }
  lines.push('');

  // Ausgaben-Konten
  lines.push('# AUFWANDSKONTEN');
  lines.push('Konto;Kategorie;Anzahl;Summe (EUR)');
  for (const cat of ausgaben) {
    const konto = kontenrahmen === 'SKR03' ? cat.konto.skr03 : cat.konto.skr04;
    lines.push(`${konto};${cat.kategorie};${cat.anzahl};${formatGermanNumber(cat.summe)}`);
  }
  lines.push('');

  lines.push('# ───────────────────────────────────────────────────────────────────────────────');
  lines.push('# EINZELNE BUCHUNGEN (JOURNAL)');
  lines.push('# ───────────────────────────────────────────────────────────────────────────────');
  lines.push('');
  lines.push('Lfd.Nr.;Datum;Typ;Konto;Kategorie;Beschreibung;Betrag (EUR);Projekt');

  for (const tx of allTransactions) {
    const konto = kontenrahmen === 'SKR03' ? tx.konto.skr03 : tx.konto.skr04;
    const typ = tx.typ === 'income' ? 'Einnahme' : 'Ausgabe';
    lines.push(
      `${tx.lfdNr};${tx.datumFormatted};${typ};${konto};${tx.kategorie};${escapeCSV(tx.beschreibung)};${formatGermanNumber(tx.betrag)};${tx.projekt || '-'}`
    );
  }

  return lines.join('\n');
}

function taxExportToDATEV(
  allTransactions: EnhancedTransaction[],
  period: string,
  kontenrahmen: 'SKR03' | 'SKR04',
  year: number
): string {
  const lines: string[] = [];

  // DATEV Header (EXTF format, simplified)
  // Format: "EXTF";Version;Kategorie;Formatname;Formatversion;Erstellt;...
  const now = new Date();
  const timestamp =
    now
      .toISOString()
      .replace(/[-:T.]/g, '')
      .slice(0, 14) + '000';

  // DATEV EXTF header (Buchungsstapel format)
  // Fields: EXTF;Version;Kategorie;Formatname;Formatversion;Erstellt;;Erzeuger;Beschreibung;;
  //         BeratNr;MandantNr;WJBeginn;Sachkontenlänge;Festschreibung;;Bezeichnung;;
  // Festschreibung: 0 = nicht festgeschrieben (wichtig für Import!)
  lines.push(
    `"EXTF";700;21;"Buchungsstapel";13;${timestamp};;"Spendlog";"Export";;99999;1;${year}0101;4;0;;"${period}";;`
  );

  lines.push(
    'Umsatz (ohne Soll/Haben-Kz);Soll/Haben-Kennzeichen;WKZ Umsatz;Kurs;Basis-Umsatz;WKZ Basis-Umsatz;' +
      'Konto;Gegenkonto (ohne BU-Schlüssel);BU-Schlüssel;Belegdatum;Belegfeld 1;Belegfeld 2;' +
      'Skonto;Buchungstext;Postensperre;Diverse Adressnummer;Geschäftspartnerbank;Sachverhalt;' +
      'Zinssperre;Beleglink'
  );

  for (const tx of allTransactions) {
    const konto = kontenrahmen === 'SKR03' ? tx.konto.skr03 : tx.konto.skr04;
    // Bank account: 1200 (SKR03) or 1800 (SKR04)
    const gegenkonto = kontenrahmen === 'SKR03' ? '1200' : '1800';
    // S = Soll (debit), H = Haben (credit)
    // For expenses: Expense account is S (debit), bank is H (credit)
    // For income: Bank is S (debit), income account is H (credit)
    const sollHaben = tx.typ === 'expense' ? 'S' : 'H';
    const belegdatum = formatDateDDMM(tx.datum);
    const belegfeld1 = `SP${tx.lfdNr.toString().padStart(5, '0')}`;

    lines.push(
      `${formatGermanNumber(tx.betrag)};${sollHaben};;;;;;;` +
        `${konto};${gegenkonto};;${belegdatum};${belegfeld1};;` +
        `;${escapeCSV(tx.beschreibung.slice(0, 60))};;;;`
    );
  }

  return lines.join('\n');
}

function taxExportToJSON(
  einnahmen: CategorySummaryEnhanced[],
  ausgaben: CategorySummaryEnhanced[],
  euerEinnahmen: EuerZeileSummary[],
  euerAusgaben: EuerZeileSummary[],
  period: string,
  totals: { einnahmen: number; ausgaben: number; gewinn: number },
  kontenrahmen: 'SKR03' | 'SKR04',
  allTransactions: EnhancedTransaction[],
  year: number,
  quarter: number | null
): string {
  const exportObj = {
    meta: {
      disclaimer: TAX_DISCLAIMER,
      erstellt_am: new Date().toISOString(),
      zeitraum: period,
      jahr: year,
      quartal: quarter,
      kontenrahmen,
      transaktionen_gesamt: allTransactions.length,
    },
    zusammenfassung: {
      einnahmen_gesamt: totals.einnahmen,
      ausgaben_gesamt: totals.ausgaben,
      gewinn: totals.gewinn,
      einnahmen_formatted: formatGermanNumber(totals.einnahmen) + ' €',
      ausgaben_formatted: formatGermanNumber(totals.ausgaben) + ' €',
      gewinn_formatted: formatGermanNumber(totals.gewinn) + ' €',
    },
    euer_zeilen: {
      einnahmen: euerEinnahmen.map((z) => ({
        zeile: z.zeile,
        bezeichnung: z.bezeichnung,
        summe: z.summe,
        summe_formatted: formatGermanNumber(z.summe) + ' €',
        kategorien: z.kategorien,
      })),
      ausgaben: euerAusgaben.map((z) => ({
        zeile: z.zeile,
        bezeichnung: z.bezeichnung,
        summe: z.summe,
        summe_formatted: formatGermanNumber(z.summe) + ' €',
        kategorien: z.kategorien,
      })),
    },
    konten: {
      einnahmen: einnahmen.map((c) => ({
        kategorie: c.kategorie,
        konto_skr03: c.konto.skr03,
        konto_skr04: c.konto.skr04,
        euer_zeile: c.konto.euerZeile,
        anzahl: c.anzahl,
        summe: c.summe,
        summe_formatted: formatGermanNumber(c.summe) + ' €',
      })),
      ausgaben: ausgaben.map((c) => ({
        kategorie: c.kategorie,
        konto_skr03: c.konto.skr03,
        konto_skr04: c.konto.skr04,
        euer_zeile: c.konto.euerZeile,
        anzahl: c.anzahl,
        summe: c.summe,
        summe_formatted: formatGermanNumber(c.summe) + ' €',
      })),
    },
    transaktionen: allTransactions.map((tx) => ({
      lfd_nr: tx.lfdNr,
      datum: tx.datumFormatted,
      typ: tx.typ,
      betrag: tx.betrag,
      betrag_formatted: formatGermanNumber(tx.betrag) + ' €',
      beschreibung: tx.beschreibung,
      kategorie: tx.kategorie,
      konto_skr03: tx.konto.skr03,
      konto_skr04: tx.konto.skr04,
      euer_zeile: tx.konto.euerZeile,
      projekt: tx.projekt,
    })),
  };

  return JSON.stringify(exportObj, null, 2);
}

export async function exportForTaxAdvisor(args: Record<string, unknown>): Promise<unknown> {
  const input = exportForTaxAdvisorSchema.parse(args) as ExportForTaxAdvisorInput;
  const userId = getCurrentUserId();

  const txRepo = AppDataSource.getRepository(Transaction);

  // Parse optional kontenrahmen
  const kontenrahmen = ((args.kontenrahmen as string) || 'SKR03').toUpperCase() as
    | 'SKR03'
    | 'SKR04';

  // Calculate date range based on year and optional quarter
  let startDate: Date;
  let endDate: Date;
  let periodLabel: string;

  if (input.quarter) {
    const quarterStart = (input.quarter - 1) * 3;
    startDate = new Date(input.year, quarterStart, 1);
    endDate = new Date(input.year, quarterStart + 3, 0);
    periodLabel = `Q${input.quarter}/${input.year}`;
  } else {
    startDate = new Date(input.year, 0, 1);
    endDate = new Date(input.year, 11, 31);
    periodLabel = `Jahr ${input.year}`;
  }

  const transactions = await txRepo.find({
    where: {
      userId,
      date: Between(startDate, endDate),
    },
    relations: ['category', 'project'],
    order: { date: 'ASC', createdAt: 'ASC' },
  });

  if (transactions.length === 0) {
    return {
      success: false,
      message: t('export.noTransactionsForPeriod', { period: periodLabel }),
      disclaimer: TAX_DISCLAIMER,
    };
  }

  // Transform transactions with enhanced data
  const enhancedTransactions: EnhancedTransaction[] = transactions.map((tx, idx) => {
    const categoryName = tx.category?.name || t('common.noCategory');
    const konto = getKontoMapping(categoryName, tx.type);
    // Ensure date is a Date object (SQLite returns string, other drivers return Date)
    const txDate = tx.date instanceof Date ? tx.date : new Date(tx.date);

    return {
      lfdNr: idx + 1,
      datum: txDate,
      datumFormatted: formatDateDDMMYYYY(txDate),
      typ: tx.type,
      betrag: Number(tx.amount),
      beschreibung: tx.description,
      kategorie: categoryName,
      projekt: tx.project?.name || null,
      konto,
    };
  });

  // Group by category
  const incomeByCategory = new Map<string, CategorySummaryEnhanced>();
  const expenseByCategory = new Map<string, CategorySummaryEnhanced>();

  for (const tx of enhancedTransactions) {
    const map = tx.typ === 'income' ? incomeByCategory : expenseByCategory;

    if (!map.has(tx.kategorie)) {
      map.set(tx.kategorie, {
        kategorie: tx.kategorie,
        konto: tx.konto,
        anzahl: 0,
        summe: 0,
        transaktionen: [],
      });
    }

    const cat = map.get(tx.kategorie)!;
    cat.anzahl++;
    cat.summe += tx.betrag;
    cat.transaktionen.push(tx);
  }

  const einnahmen = Array.from(incomeByCategory.values()).sort((a, b) => b.summe - a.summe);
  const ausgaben = Array.from(expenseByCategory.values()).sort((a, b) => b.summe - a.summe);

  // Group by EÜR-Zeile
  const euerEinnahmenMap = new Map<string, EuerZeileSummary>();
  const euerAusgabenMap = new Map<string, EuerZeileSummary>();

  for (const cat of einnahmen) {
    const zeile = cat.konto.euerZeile;
    if (!euerEinnahmenMap.has(zeile)) {
      euerEinnahmenMap.set(zeile, {
        zeile,
        bezeichnung: cat.konto.beschreibung,
        summe: 0,
        kategorien: [],
      });
    }
    const z = euerEinnahmenMap.get(zeile)!;
    z.summe += cat.summe;
    if (!z.kategorien.includes(cat.kategorie)) {
      z.kategorien.push(cat.kategorie);
    }
  }

  for (const cat of ausgaben) {
    const zeile = cat.konto.euerZeile;
    if (!euerAusgabenMap.has(zeile)) {
      euerAusgabenMap.set(zeile, {
        zeile,
        bezeichnung: cat.konto.beschreibung,
        summe: 0,
        kategorien: [],
      });
    }
    const z = euerAusgabenMap.get(zeile)!;
    z.summe += cat.summe;
    if (!z.kategorien.includes(cat.kategorie)) {
      z.kategorien.push(cat.kategorie);
    }
  }

  const euerEinnahmen = Array.from(euerEinnahmenMap.values()).sort(
    (a, b) => Number(a.zeile) - Number(b.zeile)
  );
  const euerAusgaben = Array.from(euerAusgabenMap.values()).sort(
    (a, b) => Number(a.zeile) - Number(b.zeile)
  );

  // Calculate totals
  const totalIncome = einnahmen.reduce((sum, c) => sum + c.summe, 0);
  const totalExpense = ausgaben.reduce((sum, c) => sum + c.summe, 0);
  const profit = totalIncome - totalExpense;

  const totals = { einnahmen: totalIncome, ausgaben: totalExpense, gewinn: profit };

  // Generate export content
  ensureExportsDir();

  let content: string;
  let filename: string;
  const format = (input.format || 'csv') as 'csv' | 'json' | 'datev';

  switch (format) {
    case 'datev':
      content = taxExportToDATEV(enhancedTransactions, periodLabel, kontenrahmen, input.year);
      filename = generateFilename(
        `EXTF_steuerberater-${input.year}${input.quarter ? `-q${input.quarter}` : ''}`,
        'csv'
      );
      break;
    case 'json':
      content = taxExportToJSON(
        einnahmen,
        ausgaben,
        euerEinnahmen,
        euerAusgaben,
        periodLabel,
        totals,
        kontenrahmen,
        enhancedTransactions,
        input.year,
        input.quarter || null
      );
      filename = generateFilename(
        `steuerberater-${input.year}${input.quarter ? `-q${input.quarter}` : ''}`,
        'json'
      );
      break;
    default: // csv
      content = taxExportToEnhancedCSV(
        einnahmen,
        ausgaben,
        euerEinnahmen,
        euerAusgaben,
        periodLabel,
        totals,
        kontenrahmen,
        enhancedTransactions
      );
      filename = generateFilename(
        `steuerberater-${input.year}${input.quarter ? `-q${input.quarter}` : ''}`,
        'csv'
      );
  }

  const filepath = join(EXPORTS_DIR, filename);
  writeFileSync(filepath, content, 'utf-8');

  return {
    success: true,
    message: t('export.taxExportCreated', { period: periodLabel }),
    disclaimer: TAX_DISCLAIMER,
    export: {
      format: format.toUpperCase(),
      filename,
      path: filepath,
      zeitraum: periodLabel,
      kontenrahmen,
    },
    zusammenfassung: {
      transaktionen: enhancedTransactions.length,
      einnahmen: formatGermanNumber(totalIncome) + ' €',
      ausgaben: formatGermanNumber(totalExpense) + ' €',
      gewinn: formatGermanNumber(profit) + ' €',
      einnahmen_kategorien: einnahmen.length,
      ausgaben_kategorien: ausgaben.length,
      euer_zeilen_einnahmen: euerEinnahmen.length,
      euer_zeilen_ausgaben: euerAusgaben.length,
    },
  };
}
