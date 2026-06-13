import type { Currency } from '@/lib/config/schema';

// Formats an amount in a tenant's currency. Tolerates a missing currency (configs stored
// before the field existed) by falling back to USD, and never throws — a bad/unknown code
// degrades to the plain number rather than breaking the page.
export function formatMoney(amount: number, currency: Currency | undefined): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency ?? 'USD' }).format(amount);
  } catch {
    return `${amount} ${currency ?? ''}`.trim();
  }
}
