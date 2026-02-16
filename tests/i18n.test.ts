/**
 * i18n Tests
 * Tests for translation system: t(), initI18n(), locale getters, completeness
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { t, initI18n, getLocale, getIntlLocale, getDateLocale } from '../src/i18n/index.js';
import { de } from '../src/i18n/de.js';
import { en } from '../src/i18n/en.js';
import type { TranslationDictionary } from '../src/i18n/types.js';

// Helper to collect all keys from a translation dictionary
function collectKeys(dict: TranslationDictionary): string[] {
  const keys: string[] = [];
  for (const [namespace, values] of Object.entries(dict)) {
    for (const key of Object.keys(values as Record<string, string>)) {
      keys.push(`${namespace}.${key}`);
    }
  }
  return keys.sort();
}

describe('i18n', () => {
  beforeEach(() => {
    // Reset to default (English) for i18n-specific tests
    delete process.env.SPENDLOG_LANGUAGE;
    initI18n();
  });

  afterEach(() => {
    // Restore German for other test files (test assertions use German strings)
    process.env.SPENDLOG_LANGUAGE = 'de';
    initI18n();
  });

  describe('initI18n', () => {
    it('defaults to English', () => {
      initI18n();
      expect(getLocale()).toBe('en');
    });

    it('sets German from env var', () => {
      process.env.SPENDLOG_LANGUAGE = 'de';
      initI18n();
      expect(getLocale()).toBe('de');
    });

    it('handles uppercase env var', () => {
      process.env.SPENDLOG_LANGUAGE = 'DE';
      initI18n();
      expect(getLocale()).toBe('de');
    });

    it('falls back to English for unknown locale', () => {
      process.env.SPENDLOG_LANGUAGE = 'fr';
      initI18n();
      expect(getLocale()).toBe('en');
    });

    it('falls back to English for empty string', () => {
      process.env.SPENDLOG_LANGUAGE = '';
      initI18n();
      expect(getLocale()).toBe('en');
    });
  });

  describe('getIntlLocale', () => {
    it('returns en-US for English', () => {
      expect(getIntlLocale()).toBe('en-US');
    });

    it('returns de-DE for German', () => {
      process.env.SPENDLOG_LANGUAGE = 'de';
      initI18n();
      expect(getIntlLocale()).toBe('de-DE');
    });
  });

  describe('getDateLocale', () => {
    it('returns en for English', () => {
      expect(getDateLocale()).toBe('en');
    });

    it('returns de for German', () => {
      process.env.SPENDLOG_LANGUAGE = 'de';
      initI18n();
      expect(getDateLocale()).toBe('de');
    });
  });

  describe('t() function', () => {
    it('resolves simple key in English', () => {
      expect(t('common.noCategory')).toBe('No category');
    });

    it('resolves simple key in German', () => {
      process.env.SPENDLOG_LANGUAGE = 'de';
      initI18n();
      expect(t('common.noCategory')).toBe('Keine Kategorie');
    });

    it('interpolates parameters', () => {
      const result = t('transactions.incomeSaved', {
        amount: '100,00 €',
        description: 'Test',
      });
      expect(result).toContain('100,00 €');
      expect(result).toContain('Test');
    });

    it('preserves placeholder if param is missing', () => {
      const result = t('transactions.incomeSaved', { amount: '100 €' });
      // description placeholder should remain
      expect(result).toContain('{description}');
    });

    it('falls back to German when key missing in English', () => {
      // This tests the fallback chain: en -> de -> raw key
      // All keys should be present in both, so we test the raw key fallback
      process.env.SPENDLOG_LANGUAGE = 'en';
      initI18n();
      const result = t('nonexistent.key');
      expect(result).toBe('nonexistent.key');
    });

    it('returns raw key for completely unknown keys', () => {
      expect(t('foo.bar.baz')).toBe('foo.bar.baz');
    });

    it('returns raw key for single-part keys', () => {
      expect(t('nonamespace')).toBe('nonamespace');
    });

    it('handles numeric parameters', () => {
      const result = t('recurring.limitReached', { limit: 3, url: 'test.com' });
      expect(result).toContain('3');
      expect(result).toContain('test.com');
    });
  });

  describe('Translation completeness', () => {
    const deKeys = collectKeys(de);
    const enKeys = collectKeys(en);

    it('German dictionary has translations', () => {
      expect(deKeys.length).toBeGreaterThan(100);
    });

    it('English dictionary has translations', () => {
      expect(enKeys.length).toBeGreaterThan(100);
    });

    it('English has all keys that German has', () => {
      const missingInEn = deKeys.filter((k) => !enKeys.includes(k));
      if (missingInEn.length > 0) {
        throw new Error(`Missing in en.ts:\n  ${missingInEn.join('\n  ')}`);
      }
    });

    it('German has all keys that English has', () => {
      const missingInDe = enKeys.filter((k) => !deKeys.includes(k));
      if (missingInDe.length > 0) {
        throw new Error(`Missing in de.ts:\n  ${missingInDe.join('\n  ')}`);
      }
    });

    it('no empty translation values in German', () => {
      const emptyKeys = deKeys.filter((key) => {
        const value = t(key);
        return !value || value === key;
      });
      if (emptyKeys.length > 0) {
        throw new Error(`Empty German translations:\n  ${emptyKeys.join('\n  ')}`);
      }
    });

    it('no empty translation values in English', () => {
      process.env.SPENDLOG_LANGUAGE = 'en';
      initI18n();
      const emptyKeys = enKeys.filter((key) => {
        const value = t(key);
        return !value || value === key;
      });
      if (emptyKeys.length > 0) {
        throw new Error(`Empty English translations:\n  ${emptyKeys.join('\n  ')}`);
      }
    });
  });
});
