import { getIntlLocale } from '../i18n/index.js';

export function formatCurrency(amount: number, currency: string = 'EUR'): string {
  return new Intl.NumberFormat(getIntlLocale(), {
    style: 'currency',
    currency,
  }).format(amount);
}

export function formatNumber(num: number, decimals: number = 2): string {
  return new Intl.NumberFormat(getIntlLocale(), {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

export function formatPercentage(value: number): string {
  return new Intl.NumberFormat(getIntlLocale(), {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value / 100);
}
