import { describe, it, expect } from 'vitest';
import { claimInputSchema } from './claim-input';

const valid = {
  claimType: 'OUTPATIENT',
  amount: 12000,
  submittedAt: '2026-06-12',
  customFieldValues: { employeeId: 'E-1' },
};

describe('claimInputSchema', () => {
  it('accepts a well-formed claim', () =>
    expect(claimInputSchema.safeParse(valid).success).toBe(true));

  it('rejects an unknown claim type', () =>
    expect(claimInputSchema.safeParse({ ...valid, claimType: 'SPACEFLIGHT' }).success).toBe(false));

  it('rejects a non-numeric amount (e.g. a string) before it reaches the engine', () =>
    expect(claimInputSchema.safeParse({ ...valid, amount: '12000' }).success).toBe(false));

  it('rejects a malformed submittedAt (would break business-day math)', () =>
    expect(claimInputSchema.safeParse({ ...valid, submittedAt: 'yesterday' }).success).toBe(false));

  it('defaults customFieldValues to {} when omitted', () => {
    const r = claimInputSchema.safeParse({
      claimType: 'OUTPATIENT',
      amount: 1,
      submittedAt: '2026-06-12',
    });
    expect(r.success && r.data.customFieldValues).toEqual({});
  });
});
