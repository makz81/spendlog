/**
 * Invoice Tool Integration Tests
 *
 * Tests for: create_invoice, list_invoices, get_invoice, mark_invoice_sent, mark_invoice_paid, duplicate_invoice
 * Note: Invoices require a profile to be set before creation
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { tools } from '../helpers/index.js';
import {
  setupTestDb,
  teardownTestDb,
  TEST_USER_ID,
  TestDataSource,
} from '../setup.js';
import {
  invoiceFactory,
  profileFactory,
  resetFactories,
  today,
  daysFromNow,
} from '../fixtures/index.js';
import { User } from '../../src/entities/User.js';

describe('Invoice Tools', () => {
  beforeEach(async () => {
    await setupTestDb();
    resetFactories();
    // Invoices are a PRO feature
    await TestDataSource.getRepository(User).update(TEST_USER_ID, { tier: 'pro' });
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  describe('create_invoice', () => {
    it('fails without profile', async () => {
      const result = await tools.createInvoice({
        client_name: 'Test Client',
        items: [{ description: 'Work', amount: 100 }],
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Kein Profil');
    });

    it('creates invoice with profile', async () => {
      await tools.setProfile(profileFactory.minimal());

      const result = await tools.createInvoice({
        client_name: 'Acme Corp',
        items: [{ description: 'Consulting', amount: 500 }],
      });

      expect(result.success).toBe(true);
      expect(result.invoice).toBeDefined();
      expect(result.invoice?.client).toBe('Acme Corp');
    });

    it('creates invoice with multiple items', async () => {
      await tools.setProfile(profileFactory.minimal());

      const result = await tools.createInvoice({
        client_name: 'Client XYZ',
        items: [
          { description: 'Development', amount: 150, quantity: 10 },
          { description: 'Design', amount: 100, quantity: 5 },
        ],
      });

      expect(result.success).toBe(true);
      // Total should be 150*10 + 100*5 = 2000
      expect(result.invoice?.total).toContain('2.000');
    });

    it('creates invoice with client address', async () => {
      await tools.setProfile(profileFactory.minimal());

      const result = await tools.createInvoice({
        client_name: 'Customer Inc',
        client_address: '123 Main St\n12345 City',
        items: [{ description: 'Service', amount: 200 }],
      });

      expect(result.success).toBe(true);
    });

    it('creates invoice with custom dates', async () => {
      await tools.setProfile(profileFactory.minimal());

      const result = await tools.createInvoice({
        client_name: 'DateTest Client',
        items: [{ description: 'Work', amount: 100 }],
        date: today(),
        due_date: daysFromNow(30),
      });

      expect(result.success).toBe(true);
      expect(result.invoice?.date).toBeDefined();
    });

    it('creates invoice with notes', async () => {
      await tools.setProfile(profileFactory.minimal());

      const result = await tools.createInvoice({
        client_name: 'Notes Client',
        items: [{ description: 'Task', amount: 50 }],
        notes: 'Payment within 14 days',
      });

      expect(result.success).toBe(true);
    });

    it('generates sequential invoice numbers', async () => {
      await tools.setProfile(profileFactory.minimal());

      const result1 = await tools.createInvoice({
        client_name: 'Client 1',
        items: [{ description: 'Work', amount: 100 }],
      });
      const result2 = await tools.createInvoice({
        client_name: 'Client 2',
        items: [{ description: 'Work', amount: 200 }],
      });

      const year = new Date().getFullYear();
      expect(result1.invoice?.number).toBe(`${year}-001`);
      expect(result2.invoice?.number).toBe(`${year}-002`);
    });

    it('creates invoice in draft status', async () => {
      await tools.setProfile(profileFactory.minimal());

      const result = await tools.createInvoice({
        client_name: 'Draft Client',
        items: [{ description: 'Work', amount: 100 }],
      });

      expect(result.invoice?.status).toBe('draft');
    });

    it('generates PDF', async () => {
      await tools.setProfile(profileFactory.minimal());

      const result = await tools.createInvoice({
        client_name: 'PDF Client',
        items: [{ description: 'Service', amount: 100 }],
      });

      expect(result.invoice?.pdf_path).toBeDefined();
      expect(result.invoice?.pdf_path).toContain('.pdf');
    });
  });

  describe('list_invoices', () => {
    it('lists empty when no invoices', async () => {
      const result = await tools.listInvoices();

      expect(result.total).toBe(0);
      expect(result.invoices.length).toBe(0);
    });

    it('lists all invoices', async () => {
      await tools.setProfile(profileFactory.minimal());
      await tools.createInvoice({ client_name: 'A', items: [{ description: 'X', amount: 100 }] });
      await tools.createInvoice({ client_name: 'B', items: [{ description: 'Y', amount: 200 }] });

      const result = await tools.listInvoices();

      expect(result.total).toBe(2);
      expect(result.invoices.length).toBe(2);
    });

    it('filters by status', async () => {
      await tools.setProfile(profileFactory.minimal());
      const inv1 = await tools.createInvoice({ client_name: 'Draft', items: [{ description: 'X', amount: 100 }] });
      const inv2 = await tools.createInvoice({ client_name: 'ToBeSent', items: [{ description: 'Y', amount: 200 }] });
      await tools.markInvoiceSent({ id: inv2.invoice!.id });

      const draftResult = await tools.listInvoices({ status: 'draft' });
      expect(draftResult.total).toBe(1);
      expect(draftResult.invoices[0].client).toBe('Draft');

      const sentResult = await tools.listInvoices({ status: 'sent' });
      expect(sentResult.total).toBe(1);
      expect(sentResult.invoices[0].client).toBe('ToBeSent');
    });

    it('respects limit', async () => {
      await tools.setProfile(profileFactory.minimal());
      for (let i = 0; i < 5; i++) {
        await tools.createInvoice({ client_name: `Client ${i}`, items: [{ description: 'X', amount: 100 }] });
      }

      const result = await tools.listInvoices({ limit: 2 });

      expect(result.invoices.length).toBe(2);
    });

    it('includes summary', async () => {
      await tools.setProfile(profileFactory.minimal());
      await tools.createInvoice({ client_name: 'A', items: [{ description: 'X', amount: 1000 }] });

      const result = await tools.listInvoices();

      expect(result.summary).toBeDefined();
      expect(result.summary.total_value).toContain('1.000');
      expect(result.summary.draft).toBe(1);
    });

    it('shows German status', async () => {
      await tools.setProfile(profileFactory.minimal());
      await tools.createInvoice({ client_name: 'Client', items: [{ description: 'X', amount: 100 }] });

      const result = await tools.listInvoices();

      expect(result.invoices[0].status_de).toBe('Entwurf');
    });
  });

  describe('get_invoice', () => {
    it('retrieves invoice details', async () => {
      await tools.setProfile(profileFactory.minimal());
      const created = await tools.createInvoice({
        client_name: 'Detail Client',
        items: [{ description: 'Work', amount: 500 }],
      });

      const result = await tools.getInvoice({ id: created.invoice!.id });

      expect(result.id).toBe(created.invoice!.id);
      expect(result.client.name).toBe('Detail Client');
    });

    it('includes items', async () => {
      await tools.setProfile(profileFactory.minimal());
      const created = await tools.createInvoice({
        client_name: 'Items Client',
        items: [
          { description: 'Development', amount: 150, quantity: 2 },
          { description: 'Support', amount: 50, quantity: 1 },
        ],
      });

      const result = await tools.getInvoice({ id: created.invoice!.id });

      expect(result.items.length).toBe(2);
      expect(result.items[0].quantity).toBe(2);
    });

    it('throws for non-existent invoice', async () => {
      await expect(
        tools.getInvoice({ id: '00000000-0000-0000-0000-000000000000' })
      ).rejects.toThrow('nicht gefunden');
    });

    it('includes client address', async () => {
      await tools.setProfile(profileFactory.minimal());
      const created = await tools.createInvoice({
        client_name: 'Address Client',
        client_address: 'Test Street 1\n12345 City',
        items: [{ description: 'Work', amount: 100 }],
      });

      const result = await tools.getInvoice({ id: created.invoice!.id });

      expect(result.client.address).toBe('Test Street 1\n12345 City');
    });

    it('includes notes', async () => {
      await tools.setProfile(profileFactory.minimal());
      const created = await tools.createInvoice({
        client_name: 'Notes Client',
        items: [{ description: 'Work', amount: 100 }],
        notes: 'Special instructions',
      });

      const result = await tools.getInvoice({ id: created.invoice!.id });

      expect(result.notes).toBe('Special instructions');
    });
  });

  describe('mark_invoice_sent', () => {
    it('marks invoice as sent', async () => {
      await tools.setProfile(profileFactory.minimal());
      const created = await tools.createInvoice({
        client_name: 'Send Client',
        items: [{ description: 'Work', amount: 100 }],
      });

      const result = await tools.markInvoiceSent({ id: created.invoice!.id });

      expect(result.success).toBe(true);
      expect(result.message).toContain('versendet');

      // Verify status changed
      const invoice = await tools.getInvoice({ id: created.invoice!.id });
      expect(invoice.status).toBe('sent');
    });

    it('throws for non-existent invoice', async () => {
      await expect(
        tools.markInvoiceSent({ id: '00000000-0000-0000-0000-000000000000' })
      ).rejects.toThrow('nicht gefunden');
    });
  });

  describe('mark_invoice_paid', () => {
    it('marks invoice as paid', async () => {
      await tools.setProfile(profileFactory.minimal());
      const created = await tools.createInvoice({
        client_name: 'Pay Client',
        items: [{ description: 'Work', amount: 500 }],
      });

      const result = await tools.markInvoicePaid({ id: created.invoice!.id });

      expect(result.success).toBe(true);
      expect(result.message).toContain('bezahlt');
      expect(result.message).toContain('500');

      // Verify status changed
      const invoice = await tools.getInvoice({ id: created.invoice!.id });
      expect(invoice.status).toBe('paid');
    });

    it('can mark sent invoice as paid', async () => {
      await tools.setProfile(profileFactory.minimal());
      const created = await tools.createInvoice({
        client_name: 'Flow Client',
        items: [{ description: 'Work', amount: 100 }],
      });
      await tools.markInvoiceSent({ id: created.invoice!.id });

      const result = await tools.markInvoicePaid({ id: created.invoice!.id });

      expect(result.success).toBe(true);
    });

    it('throws for non-existent invoice', async () => {
      await expect(
        tools.markInvoicePaid({ id: '00000000-0000-0000-0000-000000000000' })
      ).rejects.toThrow('nicht gefunden');
    });
  });

  describe('duplicate_invoice', () => {
    it('duplicates an invoice', async () => {
      await tools.setProfile(profileFactory.minimal());
      const original = await tools.createInvoice({
        client_name: 'Duplicate Client',
        items: [{ description: 'Work', amount: 1000 }],
      });

      const result = await tools.duplicateInvoice({ id: original.invoice!.id });

      expect(result.success).toBe(true);
      expect(result.invoice).toBeDefined();
      expect(result.invoice?.client).toBe('Duplicate Client');
      expect(result.invoice?.number).not.toBe(original.invoice!.number);
    });

    it('duplicate is in draft status', async () => {
      await tools.setProfile(profileFactory.minimal());
      const original = await tools.createInvoice({
        client_name: 'Status Client',
        items: [{ description: 'Work', amount: 100 }],
      });
      await tools.markInvoicePaid({ id: original.invoice!.id });

      const result = await tools.duplicateInvoice({ id: original.invoice!.id });

      expect(result.invoice?.status).toBe('draft');
    });

    it('can set custom date for duplicate', async () => {
      await tools.setProfile(profileFactory.minimal());
      const original = await tools.createInvoice({
        client_name: 'Date Client',
        items: [{ description: 'Work', amount: 100 }],
      });

      const customDate = daysFromNow(7);
      const result = await tools.duplicateInvoice({
        id: original.invoice!.id,
        date: customDate,
      });

      expect(result.success).toBe(true);
    });

    it('preserves items from original', async () => {
      await tools.setProfile(profileFactory.minimal());
      const original = await tools.createInvoice({
        client_name: 'Items Client',
        items: [
          { description: 'Service A', amount: 100 },
          { description: 'Service B', amount: 200 },
        ],
      });

      const dupResult = await tools.duplicateInvoice({ id: original.invoice!.id });
      const duplicate = await tools.getInvoice({ id: dupResult.invoice!.id });

      expect(duplicate.items.length).toBe(2);
    });

    it('throws for non-existent invoice', async () => {
      await tools.setProfile(profileFactory.minimal());

      await expect(
        tools.duplicateInvoice({ id: '00000000-0000-0000-0000-000000000000' })
      ).rejects.toThrow('nicht gefunden');
    });

    it('generates PDF for duplicate', async () => {
      await tools.setProfile(profileFactory.minimal());
      const original = await tools.createInvoice({
        client_name: 'PDF Client',
        items: [{ description: 'Work', amount: 100 }],
      });

      const result = await tools.duplicateInvoice({ id: original.invoice!.id });

      expect(result.invoice?.pdf_path).toBeDefined();
      expect(result.invoice?.pdf_path).toContain('.pdf');
    });
  });

  describe('Invoice Workflow', () => {
    it('full invoice lifecycle', async () => {
      // Setup profile
      await tools.setProfile(profileFactory.create());

      // Create invoice
      const created = await tools.createInvoice(invoiceFactory.detailed());
      expect(created.success).toBe(true);
      expect(created.invoice?.status).toBe('draft');

      // Send invoice
      await tools.markInvoiceSent({ id: created.invoice!.id });
      let invoice = await tools.getInvoice({ id: created.invoice!.id });
      expect(invoice.status).toBe('sent');
      expect(invoice.status_de).toBe('Versendet');

      // Mark as paid
      await tools.markInvoicePaid({ id: created.invoice!.id });
      invoice = await tools.getInvoice({ id: created.invoice!.id });
      expect(invoice.status).toBe('paid');
      expect(invoice.status_de).toBe('Bezahlt');

      // List shows paid status
      const list = await tools.listInvoices({ status: 'paid' });
      expect(list.total).toBe(1);
    });

    it('duplicate for recurring client', async () => {
      await tools.setProfile(profileFactory.create());

      // Create original invoice
      const original = await tools.createInvoice({
        client_name: 'Monthly Client',
        items: [{ description: 'Monthly Service', amount: 500 }],
      });

      // Mark as sent and paid
      await tools.markInvoiceSent({ id: original.invoice!.id });
      await tools.markInvoicePaid({ id: original.invoice!.id });

      // Duplicate for next month
      const duplicate = await tools.duplicateInvoice({ id: original.invoice!.id });

      expect(duplicate.success).toBe(true);
      expect(duplicate.invoice?.status).toBe('draft');
      expect(duplicate.invoice?.client).toBe('Monthly Client');

      // List shows both invoices
      const list = await tools.listInvoices();
      expect(list.total).toBe(2);
    });
  });
});
