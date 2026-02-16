/**
 * PDF Generation Test
 * Run with: npm run pdf:test
 */
import { generateInvoicePdf, type InvoicePdfData } from '../src/services/pdf.js';

async function main() {
  console.log('🧪 Testing PDF generation...\n');

  const testData: InvoicePdfData = {
    invoiceNumber: '2026-001',
    clientName: 'Max Mustermann GmbH',
    clientAddress: 'Musterstraße 123\n12345 Berlin\nDeutschland',
    items: [
      {
        description: 'Beratung Januar 2026',
        quantity: 10,
        unitPrice: 150,
        total: 1500,
      },
      {
        description: 'Software-Entwicklung',
        quantity: 1,
        unitPrice: 2500,
        total: 2500,
      },
      {
        description: 'Hosting (monatlich)',
        quantity: 1,
        unitPrice: 29.99,
        total: 29.99,
      },
    ],
    subtotal: 4029.99,
    tax: 0, // Kleinunternehmer
    totalAmount: 4029.99,
    date: '13.01.2026',
    dueDate: '27.01.2026',
    notes: 'Vielen Dank für Ihren Auftrag! Bitte überweisen Sie den Betrag innerhalb von 14 Tagen.',
    profile: {
      companyName: 'Spendlog Demo GmbH',
      address: 'Testweg 42\n10115 Berlin\nDeutschland',
      taxId: '12/345/67890',
      isKleinunternehmer: true,
      bankDetails: 'IBAN: DE89 3704 0044 0532 0130 00\nBIC: COBADEFFXXX\nComdirect',
      phone: '+49 30 123456',
      email: 'info@spendlog-demo.de',
    },
  };

  try {
    const pdfPath = await generateInvoicePdf(testData);
    console.log('✅ PDF generated successfully!');
    console.log(`📄 Path: ${pdfPath}`);
    console.log('\nOpen with:');
    console.log(`   open "${pdfPath}"`);
  } catch (error) {
    console.error('❌ PDF generation failed:', error);
    process.exit(1);
  }
}

main();
