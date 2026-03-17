import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow, differenceInDays, startOfDay, parseISO } from 'date-fns';
import { he } from 'date-fns/locale';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency: 'USD' | 'ILS' = 'USD'): string {
  if (currency === 'ILS') {
    return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
  }
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

export function formatRenewalDate(dateStr: string): string {
  return format(parseISO(dateStr), 'd MMM yyyy', { locale: he });
}

export function daysUntilRenewal(dateStr: string): number {
  return differenceInDays(startOfDay(parseISO(dateStr)), startOfDay(new Date()));
}

export function formatDaysLabel(days: number): string {
  if (days < 0) return `${Math.abs(days)} ימים באיחור`;
  if (days === 0) return 'היום';
  if (days === 1) return 'מחר';
  return `${days} ימים`;
}

export function renewalUrgency(dateStr: string): 'overdue' | 'urgent' | 'soon' | 'normal' {
  const days = daysUntilRenewal(dateStr);
  if (days < 0) return 'overdue';
  if (days <= 3) return 'urgent';
  if (days <= 7) return 'soon';
  return 'normal';
}

export function formatTimeAgo(dateStr: string): string {
  return formatDistanceToNow(parseISO(dateStr), { addSuffix: true, locale: he });
}
