import { describe, it, expect } from 'vitest';
import { addBusinessDays } from './business-days';

describe('addBusinessDays', () => {
  it('Friday + 5 business days lands on next Friday', () =>
    expect(addBusinessDays('2026-06-12', 5)).toBe('2026-06-19'));
  it('+7 from Friday crosses two weekends', () =>
    expect(addBusinessDays('2026-06-12', 7)).toBe('2026-06-23'));
  it('+15 from Friday', () =>
    expect(addBusinessDays('2026-06-12', 15)).toBe('2026-07-03'));
  it('Saturday submission starts counting Monday', () =>
    expect(addBusinessDays('2026-06-13', 1)).toBe('2026-06-15'));
  it('Sunday submission starts counting Monday', () =>
    expect(addBusinessDays('2026-06-14', 1)).toBe('2026-06-15'));
  it('weekday (Monday) start counts plain weekdays', () =>
    expect(addBusinessDays('2026-06-15', 3)).toBe('2026-06-18'));
});
