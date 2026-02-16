/**
 * Export Tool Integration Tests
 *
 * Tests for: export_transactions, export_invoices, export_for_tax_advisor
 * Note: Tests validate format compliance, SKR03/SKR04 accounts, and DATEV format
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { tools } from '../helpers/index.js';
import {
  setupTestDb,
  teardownTestDb,
  setTestUserTier,
} from '../setup.js';
import {
  profileFactory,
  resetFactories,
  today,
} from '../fixtures/index.js';
import { existsSync, readFileSync, unlinkSync } from 'fs';

describe('Export Tools', () => {
  beforeEach(async () => {
    await setupTestDb();
    resetFactories();
    // Export is a PRO feature
    await setTestUserTier('pro');
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  describe('export_transactions', () => {
    it('returns empty when no transactions', async () => {
      const result = await tools.exportTransactions({ format: 'csv' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Keine Transaktionen');
    });

    it('exports transactions as CSV', async () => {
      await tools.addIncome({ amount: 1000, description: 'Client Work' });
      await tools.addExpense({ amount: 100, description: 'Software' });

      const result = await tools.exportTransactions({ format: 'csv' });

      expect(result.success).toBe(true);
      expect(result.export?.format).toBe('CSV');
      expect(result.export?.transactions).toBe(2);
      expect(result.export?.path).toContain('.csv');

      // Verify file exists
      expect(existsSync(result.export!.path!)).toBe(true);

      // Cleanup
      unlinkSync(result.export!.path!);
    });

    it('exports transactions as JSON', async () => {
      await tools.addIncome({ amount: 500, description: 'Revenue' });

      const result = await tools.exportTransactions({ format: 'json' });

      expect(result.success).toBe(true);
      expect(result.export?.format).toBe('JSON');
      expect(result.export?.path).toContain('.json');

      // Verify JSON content
      const content = readFileSync(result.export!.path!, 'utf-8');
      const data = JSON.parse(content);
      expect(data.anzahl).toBe(1);
      expect(data.transaktionen[0].beschreibung).toBe('Revenue');

      // Cleanup
      unlinkSync(result.export!.path!);
    });

    it('includes summary in export result', async () => {
      await tools.addIncome({ amount: 1500, description: 'Income' });
      await tools.addExpense({ amount: 300, description: 'Expense' });

      const result = await tools.exportTransactions({ format: 'csv' });

      // Format is 1500,00 € (German number format without thousands separator)
      expect(result.export?.summary?.einnahmen).toContain('1500');
      expect(result.export?.summary?.ausgaben).toContain('300');
      expect(result.export?.summary?.saldo).toContain('1200');

      // Cleanup
      unlinkSync(result.export!.path!);
    });

    it('respects date range filter', async () => {
      await tools.addIncome({ amount: 100, description: 'Old', date: '2025-01-01' });
      await tools.addIncome({ amount: 200, description: 'New', date: today() });

      const result = await tools.exportTransactions({
        format: 'csv',
        from_date: '2026-01-01',
        to_date: '2026-12-31',
      });

      expect(result.success).toBe(true);
      expect(result.export?.transactions).toBe(1);

      // Cleanup
      unlinkSync(result.export!.path!);
    });

    it('CSV uses semicolon separator', async () => {
      await tools.addIncome({ amount: 100, description: 'Test' });

      const result = await tools.exportTransactions({ format: 'csv' });
      const content = readFileSync(result.export!.path!, 'utf-8');

      expect(content).toContain(';');
      expect(content).toContain('Datum;Typ;Betrag');

      // Cleanup
      unlinkSync(result.export!.path!);
    });

    it('uses German number format', async () => {
      await tools.addIncome({ amount: 1234.56, description: 'Test' });

      const result = await tools.exportTransactions({ format: 'csv' });
      const content = readFileSync(result.export!.path!, 'utf-8');

      // German format: 1234,56 (comma decimal)
      expect(content).toContain('1234,56');

      // Cleanup
      unlinkSync(result.export!.path!);
    });
  });

  describe('export_invoices', () => {
    it('returns empty when no invoices', async () => {
      const result = await tools.exportInvoices();

      expect(result.success).toBe(false);
      expect(result.message).toContain('Keine Rechnungen');
    });

    it('exports invoices as JSON', async () => {
      await tools.setProfile(profileFactory.minimal());
      await tools.createInvoice({ client_name: 'Client A', items: [{ description: 'Work', amount: 500 }] });
      await tools.createInvoice({ client_name: 'Client B', items: [{ description: 'More Work', amount: 1000 }] });

      const result = await tools.exportInvoices();

      expect(result.success).toBe(true);
      expect(result.export?.format).toBe('JSON');
      expect(result.export?.invoices).toBe(2);

      // Cleanup
      unlinkSync(result.export!.path!);
    });

    it('includes total value in export', async () => {
      await tools.setProfile(profileFactory.minimal());
      await tools.createInvoice({ client_name: 'A', items: [{ description: 'X', amount: 1000 }] });
      await tools.createInvoice({ client_name: 'B', items: [{ description: 'Y', amount: 500 }] });

      const result = await tools.exportInvoices();

      // Format is 1500,00 € (German number format)
      expect(result.export?.total_value).toContain('1500');

      // Cleanup
      unlinkSync(result.export!.path!);
    });

    it('filters by status', async () => {
      await tools.setProfile(profileFactory.minimal());
      await tools.createInvoice({ client_name: 'Draft', items: [{ description: 'X', amount: 100 }] });
      const sent = await tools.createInvoice({ client_name: 'Sent', items: [{ description: 'Y', amount: 200 }] });
      await tools.markInvoiceSent({ id: sent.invoice!.id });

      const draftResult = await tools.exportInvoices({ status: 'draft' });
      expect(draftResult.export?.invoices).toBe(1);
      unlinkSync(draftResult.export!.path!);

      const sentResult = await tools.exportInvoices({ status: 'sent' });
      expect(sentResult.export?.invoices).toBe(1);
      unlinkSync(sentResult.export!.path!);
    });

    it('includes status breakdown', async () => {
      await tools.setProfile(profileFactory.minimal());
      await tools.createInvoice({ client_name: 'Draft', items: [{ description: 'X', amount: 100 }] });
      const sent = await tools.createInvoice({ client_name: 'Sent', items: [{ description: 'Y', amount: 200 }] });
      const paid = await tools.createInvoice({ client_name: 'Paid', items: [{ description: 'Z', amount: 300 }] });
      await tools.markInvoiceSent({ id: sent.invoice!.id });
      await tools.markInvoicePaid({ id: paid.invoice!.id });

      const result = await tools.exportInvoices();

      expect(result.export?.by_status?.entwurf).toBe(1);
      expect(result.export?.by_status?.versendet).toBe(1);
      expect(result.export?.by_status?.bezahlt).toBe(1);

      // Cleanup
      unlinkSync(result.export!.path!);
    });
  });

  describe('export_for_tax_advisor', () => {
    // PRO-only feature - set tier before each test
    beforeEach(async () => {
      await setTestUserTier('pro');
    });

    it('returns empty when no transactions', async () => {
      const result = await tools.exportForTaxAdvisor({ year: 2026 });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Keine Transaktionen');
    });

    it('exports as CSV (default)', async () => {
      await tools.addIncome({ amount: 5000, description: 'Revenue', category: 'Dienstleistung' });
      await tools.addExpense({ amount: 500, description: 'Software', category: 'IT & Software' });

      const result = await tools.exportForTaxAdvisor({ year: 2026 });

      expect(result.success).toBe(true);
      expect(result.export?.format).toBe('CSV');
      expect(result.export?.kontenrahmen).toBe('SKR03');

      // Cleanup
      unlinkSync(result.export!.path!);
    });

    it('exports as JSON', async () => {
      await tools.addIncome({ amount: 1000, description: 'Work', category: 'Dienstleistung' });

      const result = await tools.exportForTaxAdvisor({ year: 2026, format: 'json' });

      expect(result.export?.format).toBe('JSON');
      expect(result.export?.path).toContain('.json');

      // Cleanup
      unlinkSync(result.export!.path!);
    });

    it('exports as DATEV format', async () => {
      await tools.addIncome({ amount: 2000, description: 'Client', category: 'Dienstleistung' });
      await tools.addExpense({ amount: 100, description: 'Software', category: 'IT & Software' });

      const result = await tools.exportForTaxAdvisor({ year: 2026, format: 'datev' });

      expect(result.export?.format).toBe('DATEV');

      // Verify DATEV header
      const content = readFileSync(result.export!.path!, 'utf-8');
      expect(content).toContain('EXTF');

      // Cleanup
      unlinkSync(result.export!.path!);
    });

    it('supports SKR04 kontenrahmen', async () => {
      await tools.addExpense({ amount: 100, description: 'Test', category: 'IT & Software' });

      const result = await tools.exportForTaxAdvisor({ year: 2026, kontenrahmen: 'SKR04' });

      expect(result.export?.kontenrahmen).toBe('SKR04');

      // Cleanup
      unlinkSync(result.export!.path!);
    });

    it('includes profit summary', async () => {
      await tools.addIncome({ amount: 10000, description: 'Revenue', category: 'Dienstleistung' });
      await tools.addExpense({ amount: 3000, description: 'Costs', category: 'IT & Software' });

      const result = await tools.exportForTaxAdvisor({ year: 2026 });

      // German number format without thousands separator
      expect(result.zusammenfassung?.einnahmen).toContain('10000');
      expect(result.zusammenfassung?.ausgaben).toContain('3000');
      expect(result.zusammenfassung?.gewinn).toContain('7000');

      // Cleanup
      unlinkSync(result.export!.path!);
    });

    it('includes disclaimer', async () => {
      await tools.addIncome({ amount: 100, description: 'Test' });

      const result = await tools.exportForTaxAdvisor({ year: 2026 });

      expect(result.disclaimer).toContain('Steuerberatung');

      // Cleanup
      unlinkSync(result.export!.path!);
    });

    it('filters by quarter', async () => {
      await tools.addIncome({ amount: 1000, description: 'Q1 Income', date: '2026-01-15', category: 'Dienstleistung' });
      await tools.addIncome({ amount: 2000, description: 'Q2 Income', date: '2026-04-15', category: 'Dienstleistung' });

      const q1Result = await tools.exportForTaxAdvisor({ year: 2026, quarter: 1 });

      expect(q1Result.export?.zeitraum).toBe('Q1/2026');
      expect(q1Result.zusammenfassung?.transaktionen).toBe(1);
      expect(q1Result.zusammenfassung?.einnahmen).toContain('1000');

      // Cleanup
      unlinkSync(q1Result.export!.path!);
    });

    it('maps categories to SKR03 accounts', async () => {
      await tools.addExpense({ amount: 100, description: 'Software', category: 'IT & Software' });

      const result = await tools.exportForTaxAdvisor({ year: 2026, format: 'json' });
      const content = readFileSync(result.export!.path!, 'utf-8');
      const data = JSON.parse(content);

      // SKR03 account for IT & Software is 4964
      const expenseAccount = data.konten.ausgaben.find((k: { kategorie: string }) => k.kategorie === 'IT & Software');
      expect(expenseAccount?.konto_skr03).toBe('4964');

      // Cleanup
      unlinkSync(result.export!.path!);
    });

    it('maps income categories to SKR03 accounts', async () => {
      await tools.addIncome({ amount: 1000, description: 'Consulting', category: 'Dienstleistung' });

      const result = await tools.exportForTaxAdvisor({ year: 2026, format: 'json' });
      const content = readFileSync(result.export!.path!, 'utf-8');
      const data = JSON.parse(content);

      // SKR03 account for Dienstleistung is 8400
      const incomeAccount = data.konten.einnahmen.find((k: { kategorie: string }) => k.kategorie === 'Dienstleistung');
      expect(incomeAccount?.konto_skr03).toBe('8400');

      // Cleanup
      unlinkSync(result.export!.path!);
    });

    it('includes EÜR line mappings', async () => {
      await tools.addIncome({ amount: 5000, description: 'Service', category: 'Dienstleistung' });
      await tools.addExpense({ amount: 500, description: 'Ads', category: 'Marketing & Werbung' });

      const result = await tools.exportForTaxAdvisor({ year: 2026, format: 'json' });
      const content = readFileSync(result.export!.path!, 'utf-8');
      const data = JSON.parse(content);

      expect(data.euer_zeilen).toBeDefined();
      expect(data.euer_zeilen.einnahmen.length).toBeGreaterThan(0);
      expect(data.euer_zeilen.ausgaben.length).toBeGreaterThan(0);

      // Cleanup
      unlinkSync(result.export!.path!);
    });

    it('counts categories correctly', async () => {
      await tools.addIncome({ amount: 1000, description: 'Work 1', category: 'Dienstleistung' });
      await tools.addIncome({ amount: 500, description: 'Work 2', category: 'Dienstleistung' });
      await tools.addExpense({ amount: 100, description: 'Software 1', category: 'IT & Software' });
      await tools.addExpense({ amount: 200, description: 'Ads', category: 'Marketing & Werbung' });

      const result = await tools.exportForTaxAdvisor({ year: 2026 });

      expect(result.zusammenfassung?.einnahmen_kategorien).toBe(1);
      expect(result.zusammenfassung?.ausgaben_kategorien).toBe(2);

      // Cleanup
      unlinkSync(result.export!.path!);
    });
  });

  describe('Export Workflow', () => {
    // PRO-only features in workflow tests
    beforeEach(async () => {
      await setTestUserTier('pro');
    });

    it('complete tax year export workflow', async () => {
      // Add various transactions throughout the year
      await tools.addIncome({ amount: 5000, description: 'Q1 Client', date: '2026-02-15', category: 'Dienstleistung' });
      await tools.addExpense({ amount: 300, description: 'Q1 Software', date: '2026-02-20', category: 'IT & Software' });
      await tools.addIncome({ amount: 3000, description: 'Q2 Client', date: '2026-05-10', category: 'Dienstleistung' });
      await tools.addExpense({ amount: 200, description: 'Q2 Marketing', date: '2026-06-05', category: 'Marketing & Werbung' });

      // Export for full year
      const yearResult = await tools.exportForTaxAdvisor({ year: 2026 });
      expect(yearResult.zusammenfassung?.transaktionen).toBe(4);
      expect(yearResult.zusammenfassung?.einnahmen).toContain('8000');
      expect(yearResult.zusammenfassung?.ausgaben).toContain('500');
      expect(yearResult.zusammenfassung?.gewinn).toContain('7500');

      // Export Q1 only
      const q1Result = await tools.exportForTaxAdvisor({ year: 2026, quarter: 1 });
      expect(q1Result.zusammenfassung?.transaktionen).toBe(2);
      expect(q1Result.export?.zeitraum).toBe('Q1/2026');

      // Cleanup
      unlinkSync(yearResult.export!.path!);
      unlinkSync(q1Result.export!.path!);
    });

    it('DATEV export format compliance', async () => {
      await tools.addIncome({ amount: 1500, description: 'Beratung', category: 'Dienstleistung' });
      await tools.addExpense({ amount: 29.99, description: 'Cloud Server', category: 'IT & Software' });

      const result = await tools.exportForTaxAdvisor({ year: 2026, format: 'datev' });
      const content = readFileSync(result.export!.path!, 'utf-8');
      const lines = content.split('\n');

      // First line should be EXTF header
      expect(lines[0]).toContain('"EXTF"');
      expect(lines[0]).toContain('Buchungsstapel');

      // Second line should be column headers
      expect(lines[1]).toContain('Umsatz');
      expect(lines[1]).toContain('Soll/Haben');
      expect(lines[1]).toContain('Konto');

      // Data rows should follow
      expect(lines.length).toBeGreaterThan(2);

      // Cleanup
      unlinkSync(result.export!.path!);
    });
  });
});
