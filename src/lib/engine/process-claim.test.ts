import { describe, it, expect } from 'vitest';
import { processClaim } from './process-claim';
import { validConfig } from '../config/fixtures';

const claim = (over = {}) => ({ claimType: 'OUTPATIENT' as const, amount: 12000,
  submittedAt: '2026-06-12', customFieldValues: { employeeId: 'E-001' }, ...over });

describe('processClaim', () => {
  it('auto-approves below threshold', () => {
    const r = processClaim(validConfig, claim());
    expect(r.ok && r.approval).toEqual({ route: 'AUTO_APPROVED' });
  });
  it('amount exactly at threshold goes to the first tier (half-open)', () => {
    const r = processClaim(validConfig, claim({ amount: 20000 }));
    expect(r.ok && r.approval).toEqual({ route: 'MANUAL', role: 'assessor', tierIndex: 0 });
  });
  it('amount exactly at a tier bound belongs to the higher tier', () => {
    const r = processClaim(validConfig, claim({ amount: 100000 }));
    expect(r.ok && r.approval).toEqual({ route: 'MANUAL', role: 'director', tierIndex: 1 });
  });
  it('threshold 0 auto-approves nothing', () => {
    const cfg = structuredClone(validConfig); cfg.approval.autoApprovalThreshold = 0;
    const r = processClaim(cfg, claim({ amount: 1 }));
    expect(r.ok && r.approval.route).toBe('MANUAL');
  });
  it('computes SLA deadline in business days', () => {
    const r = processClaim(validConfig, claim());
    expect(r.ok && r.slaDeadline).toBe('2026-06-19');
  });
  it('returns the full lifecycle notification plan', () => {
    const r = processClaim(validConfig, claim());
    expect(r.ok && r.notifications).toEqual([{ event: 'claim_submitted', channels: ['email'], template: 'default' }]);
  });
  it('emits notifications in canonical lifecycle order regardless of config key order', () => {
    const cfg = structuredClone(validConfig);
    // Scrambled insertion order — mirrors how Postgres jsonb reorders keys on round-trip.
    cfg.notifications = {
      payment_sent: { enabled: true, channels: ['email'] },
      claim_submitted: { enabled: true, channels: ['email'] },
      rejected: { enabled: true, channels: ['sms'] },
      approved: { enabled: true, channels: ['email'] },
    };
    const r = processClaim(cfg, claim());
    expect(r.ok && r.notifications.map((n) => n.event)).toEqual([
      'claim_submitted',
      'approved',
      'rejected',
      'payment_sent',
    ]);
  });
  it('rejects disabled claim type with structured error', () => {
    const r = processClaim(validConfig, claim({ claimType: 'DENTAL' }));
    expect(!r.ok && r.errors[0].code).toBe('CLAIM_TYPE_NOT_ENABLED');
  });
  it('rejects missing required custom field, naming the field', () => {
    const r = processClaim(validConfig, claim({ customFieldValues: {} }));
    expect(!r.ok && r.errors[0]).toMatchObject({ code: 'MISSING_CUSTOM_FIELD', field: 'employeeId' });
  });
  it('rejects non-positive amount', () => {
    const r = processClaim(validConfig, claim({ amount: 0 }));
    expect(!r.ok && r.errors[0].code).toBe('INVALID_AMOUNT');
  });
  it('echoes the tenant currency in the result', () => {
    const r = processClaim(validConfig, claim());
    expect(r.ok && r.currency).toBe('USD');
  });
  it('falls back to USD when an older stored config predates the currency field', () => {
    const cfg = structuredClone(validConfig);
    delete (cfg.branding as { currency?: string }).currency;
    const r = processClaim(cfg, claim());
    expect(r.ok && r.currency).toBe('USD');
  });
  it('rejects a custom field whose value violates its type', () => {
    const cfg = structuredClone(validConfig);
    cfg.customFields = [{ key: 'age', label: 'Age', type: 'number', required: true }];
    const r = processClaim(cfg, claim({ customFieldValues: { age: 'not-a-number' } }));
    expect(!r.ok && r.errors[0]).toMatchObject({ code: 'INVALID_CUSTOM_FIELD', field: 'age' });
  });
  it('rejects a select custom field value outside its options', () => {
    const cfg = structuredClone(validConfig);
    cfg.customFields = [{ key: 'dept', label: 'Department', type: 'select', required: true, options: ['IT', 'HR'] }];
    const r = processClaim(cfg, claim({ customFieldValues: { dept: 'FINANCE' } }));
    expect(!r.ok && r.errors[0]).toMatchObject({ code: 'INVALID_CUSTOM_FIELD', field: 'dept' });
  });
  it('accumulates multiple independent errors', () => {
    const r = processClaim(validConfig, claim({ claimType: 'DENTAL' as const, amount: -1, customFieldValues: {} }));
    expect(!r.ok && r.errors.map(e => e.code).sort())
      .toEqual(['CLAIM_TYPE_NOT_ENABLED', 'INVALID_AMOUNT', 'MISSING_CUSTOM_FIELD']);
  });
});
