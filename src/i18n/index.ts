import type { Locale, TranslationDictionary } from './types.js';
import { de } from './de.js';
import { en } from './en.js';

export type { Locale, TranslationDictionary };

const dictionaries: Record<Locale, TranslationDictionary> = { de, en };

let currentLocale: Locale = 'en';

/**
 * Initialize i18n from SPENDLOG_LANGUAGE env var.
 * Call once at process start (before registerTools).
 */
export function initI18n(): void {
  const envLang = process.env.SPENDLOG_LANGUAGE?.toLowerCase();
  if (envLang === 'de') {
    currentLocale = 'de';
  } else {
    currentLocale = 'en';
  }
}

/** Current locale code ('de' | 'en') */
export function getLocale(): Locale {
  return currentLocale;
}

/** Intl locale string for Intl.NumberFormat etc. */
export function getIntlLocale(): string {
  return currentLocale === 'en' ? 'en-US' : 'de-DE';
}

/** date-fns locale object */
export function getDateLocale(): Locale {
  return currentLocale;
}

/**
 * Translate a key with optional interpolation.
 *
 * Usage:
 *   t('transactions.incomeSaved', { amount: '100 €', description: 'Test' })
 *   t('common.noCategory')
 *
 * Fallback: requested locale -> en -> raw key
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const value =
    resolveKey(dictionaries[currentLocale], key) ?? resolveKey(dictionaries.en, key) ?? key;

  if (!params) return value;

  return value.replace(/\{(\w+)\}/g, (_match, name: string) => {
    return params[name] !== undefined ? String(params[name]) : `{${name}}`;
  });
}

function resolveKey(dict: TranslationDictionary, key: string): string | undefined {
  const parts = key.split('.');
  if (parts.length !== 2) return undefined;

  const [namespace, field] = parts;
  const ns = (dict as unknown as Record<string, Record<string, string>>)[namespace];
  if (!ns) return undefined;

  const val = ns[field];
  return typeof val === 'string' ? val : undefined;
}
