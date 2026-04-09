import {
  format,
  parse,
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  startOfYear,
  endOfYear,
} from 'date-fns';
import { de, enUS } from 'date-fns/locale';
import { getDateLocale } from '../i18n/index.js';
import { t } from '../i18n/index.js';

function getDateFnsLocale() {
  return getDateLocale() === 'en' ? enUS : de;
}

export function formatDate(date: Date): string {
  return format(date, 'dd.MM.yyyy', { locale: getDateFnsLocale() });
}

export function formatDateISO(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function parseDate(dateStr: string): Date {
  return parse(dateStr, 'yyyy-MM-dd', new Date());
}

export function today(): string {
  return formatDateISO(new Date());
}

export function getMonthName(date: Date): string {
  return format(date, 'MMMM yyyy', { locale: getDateFnsLocale() });
}

export function getQuarterName(date: Date): string {
  const quarter = Math.ceil((date.getMonth() + 1) / 3);
  return `Q${quarter} ${date.getFullYear()}`;
}

export function getYearName(date: Date): string {
  return date.getFullYear().toString();
}

export interface DateRange {
  start: Date;
  end: Date;
  label: string;
}

export function getPeriodRange(
  period: 'month' | 'quarter' | 'year' | 'all',
  referenceDate?: string
): DateRange {
  const ref = referenceDate ? parseDate(referenceDate) : new Date();

  switch (period) {
    case 'month':
      return {
        start: startOfMonth(ref),
        end: endOfMonth(ref),
        label: getMonthName(ref),
      };
    case 'quarter':
      return {
        start: startOfQuarter(ref),
        end: endOfQuarter(ref),
        label: getQuarterName(ref),
      };
    case 'year':
      return {
        start: startOfYear(ref),
        end: endOfYear(ref),
        label: getYearName(ref),
      };
    case 'all':
      return {
        start: new Date(0),
        end: new Date(),
        label: t('common.allPeriod'),
      };
  }
}
