// ============================================================================
// Freemium
// ============================================================================

/**
 * Master switch for freemium gates.
 * OFF (default): everything is free, no limits, no PRO gates.
 * ON:  free tier limits + PRO feature gates apply.
 *
 * Set SPENDLOG_FREEMIUM=true to enable.
 */
export function isFreemiumEnabled(): boolean {
  return process.env.SPENDLOG_FREEMIUM === 'true';
}

/** Maximum transactions for free tier */
export const FREE_TRANSACTION_LIMIT = 100;

/** Maximum projects for free tier */
export const FREE_PROJECT_LIMIT = 3;

/** Maximum budgets for free tier */
export const FREE_BUDGET_LIMIT = 3;

/** Maximum recurring transactions for free tier */
export const FREE_RECURRING_LIMIT = 5;

/** Upgrade URL */
export const UPGRADE_URL = 'spendlog.dev/pro';
