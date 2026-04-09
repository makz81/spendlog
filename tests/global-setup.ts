/**
 * Global test setup
 * Sets locale to German for tests (since test assertions use German strings).
 * Override with SPENDLOG_LANGUAGE env var if needed.
 */
import { initI18n } from '../src/i18n/index.js';

if (!process.env.SPENDLOG_LANGUAGE) {
  process.env.SPENDLOG_LANGUAGE = 'de';
}
initI18n();
