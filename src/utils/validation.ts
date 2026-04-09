import { z } from 'zod';

// Common schemas
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
  .optional();

export const amountSchema = z.coerce.number().positive('Amount must be positive').max(99999999.99);

export const categoryTypeSchema = z.enum(['income', 'expense']);

// Transaction schemas
const addTransactionSchema = z.object({
  amount: amountSchema,
  description: z.string().min(1, 'Description is required').max(1000),
  category: z.string().max(200).optional(),
  date: dateSchema,
  project: z.string().max(200).optional(),
});
export const addIncomeSchema = addTransactionSchema;
export const addExpenseSchema = addTransactionSchema;

export const listTransactionsSchema = z.object({
  type: z.enum(['income', 'expense', 'all']).optional().default('all'),
  from_date: dateSchema,
  to_date: dateSchema,
  category: z.string().max(200).optional(),
  project: z.string().max(200).optional(),
  limit: z.coerce.number().int().positive().max(500).optional().default(50),
});

export const deleteTransactionSchema = z.object({
  id: z.string().uuid('Invalid transaction ID'),
});

export const updateTransactionSchema = z.object({
  id: z.string().uuid('Invalid transaction ID'),
  amount: z.coerce.number().positive('Amount must be positive').max(99999999.99).optional(),
  description: z.string().min(1).max(1000).optional(),
  category: z.string().max(200).optional(),
  date: dateSchema,
  project: z.string().max(200).optional(),
});

// Summary schemas
export const getSummarySchema = z.object({
  period: z.enum(['month', 'quarter', 'year', 'all']).optional().default('month'),
  date: dateSchema, // Reference date for the period
});

export const getCategoryBreakdownSchema = z.object({
  type: categoryTypeSchema,
  period: z.enum(['month', 'quarter', 'year', 'all']).optional().default('month'),
  date: dateSchema,
});

// Profile schemas
export const setProfileSchema = z.object({
  company_name: z.string().min(1, 'Company name is required').max(200),
  address: z.string().min(1, 'Address is required').max(500),
  tax_id: z.string().max(100).optional(),
  is_kleinunternehmer: z.boolean().default(false),
  bank_details: z.string().max(500).optional(),
  phone: z.string().max(100).optional(),
  email: z.string().email().max(254).optional(),
});

// Invoice schemas
export const invoiceItemSchema = z.object({
  description: z.string().min(1).max(1000),
  amount: amountSchema,
  quantity: z.coerce.number().positive().default(1),
});

export const createInvoiceSchema = z.object({
  client_name: z.string().min(1, 'Client name is required').max(200),
  client_address: z.string().max(500).optional(),
  items: z.array(invoiceItemSchema).min(1, 'At least one item is required').max(100),
  date: dateSchema,
  due_date: dateSchema,
  notes: z.string().max(2000).optional(),
});

export const listInvoicesSchema = z.object({
  status: z.enum(['all', 'draft', 'sent', 'paid']).optional().default('all'),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});

export const getInvoiceSchema = z.object({
  id: z.string().uuid('Invalid invoice ID'),
});

// Export schemas
export const exportTransactionsSchema = z.object({
  format: z.enum(['csv', 'json']),
  from_date: dateSchema,
  to_date: dateSchema,
});

export const exportForTaxAdvisorSchema = z.object({
  year: z.coerce.number().int().min(2020).max(2100),
  quarter: z.coerce.number().int().min(1).max(4).optional(),
  format: z.enum(['csv', 'json', 'datev']).optional().default('csv'),
  kontenrahmen: z.enum(['SKR03', 'SKR04']).optional().default('SKR03'),
});

export type ExportForTaxAdvisorInput = z.infer<typeof exportForTaxAdvisorSchema>;

// Compare schemas
export const comparePeriodsSchema = z.object({
  period: z.enum(['month', 'quarter', 'year']),
  current_date: dateSchema, // Reference date for current period
  compare_date: dateSchema, // Reference date for comparison period
});

// Tax schemas
export const getTaxSummarySchema = z.object({
  year: z.coerce.number().int().min(2020).max(2100),
  quarter: z.coerce.number().int().min(1).max(4).optional(),
});

// Budget schemas
export const setBudgetSchema = z.object({
  amount: amountSchema,
  period: z.enum(['monthly', 'quarterly', 'yearly']).optional().default('monthly'),
  category: z.string().max(200).optional(),
  name: z.string().max(200).optional(),
  alert_threshold: z.coerce.number().min(1).max(100).optional().default(80),
});

export const getBudgetStatusSchema = z.object({
  category: z.string().max(200).optional(),
});

export const deleteBudgetSchema = z.object({
  id: z.string().uuid('Invalid budget ID'),
});

export const updateBudgetSchema = z.object({
  id: z.string().uuid('Invalid budget ID'),
  amount: z.coerce.number().positive('Amount must be positive').max(99999999.99).optional(),
  alert_threshold: z.coerce.number().min(1).max(100).optional(),
  active: z.boolean().optional(),
});

// Type exports
export type AddIncomeInput = z.infer<typeof addIncomeSchema>;
export type AddExpenseInput = z.infer<typeof addExpenseSchema>;
export type ListTransactionsInput = z.infer<typeof listTransactionsSchema>;
export type DeleteTransactionInput = z.infer<typeof deleteTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
export type GetSummaryInput = z.infer<typeof getSummarySchema>;
export type GetCategoryBreakdownInput = z.infer<typeof getCategoryBreakdownSchema>;
export type SetProfileInput = z.infer<typeof setProfileSchema>;
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type ListInvoicesInput = z.infer<typeof listInvoicesSchema>;
export type GetInvoiceInput = z.infer<typeof getInvoiceSchema>;
export type ExportTransactionsInput = z.infer<typeof exportTransactionsSchema>;
export type ComparePeriodsInput = z.infer<typeof comparePeriodsSchema>;
export type GetTaxSummaryInput = z.infer<typeof getTaxSummarySchema>;
export type SetBudgetInput = z.infer<typeof setBudgetSchema>;
export type GetBudgetStatusInput = z.infer<typeof getBudgetStatusSchema>;
export type DeleteBudgetInput = z.infer<typeof deleteBudgetSchema>;
export type UpdateBudgetInput = z.infer<typeof updateBudgetSchema>;
