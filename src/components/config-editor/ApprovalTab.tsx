'use client';

import { Button, Input, InputNumber } from 'antd';
import type { TenantConfig } from '@/lib/config/schema';
import { Field, FieldError } from './Field';
import type { Issue } from './issues';

type Approval = TenantConfig['approval'];
type Tier = Approval['tiers'][number];

export function ApprovalTab({
  value,
  onChange,
  issues,
}: {
  value: Approval;
  onChange: (v: Approval) => void;
  issues: Issue[];
}) {
  const setTier = (i: number, patch: Partial<Tier>) =>
    onChange({ ...value, tiers: value.tiers.map((t, idx) => (idx === i ? { ...t, ...patch } : t)) });

  // New tiers are inserted above the locked unbounded last tier.
  const addTier = () => {
    const lastBound = [...value.tiers].reverse().find((t) => t.upTo !== null)?.upTo;
    const tier: Tier = { upTo: lastBound ? lastBound * 2 : 100000, role: '' };
    const last = value.tiers[value.tiers.length - 1];
    onChange({ ...value, tiers: [...value.tiers.slice(0, -1), tier, last] });
  };

  const removeTier = (i: number) => onChange({ ...value, tiers: value.tiers.filter((_, idx) => idx !== i) });

  // The fiddliest rule gets immediate feedback while typing; everything else surfaces
  // on save. (The save-time Zod issue for this rule is suppressed to avoid a double.)
  const bounds = value.tiers.slice(0, -1).map((t) => t.upTo ?? 0);
  const ascendingError = bounds.some((b, i) => i > 0 && bounds[i - 1] >= b)
    ? 'Tier bounds must be strictly ascending.'
    : null;

  return (
    <div className="editor-pane">
      <Field
        label="Auto-approval threshold (claims below this amount are approved automatically)"
        htmlFor="approval-threshold"
        issues={issues}
        path={['approval', 'autoApprovalThreshold']}
      >
        <InputNumber
          id="approval-threshold"
          min={0}
          style={{ width: 240 }}
          value={value.autoApprovalThreshold}
          onChange={(v) => onChange({ ...value, autoApprovalThreshold: v ?? 0 })}
        />
      </Field>

      <div className="field">
        <span className="field__label">
          Approval tiers — a manual claim routes to the first tier whose upper bound exceeds its amount
        </span>
        {value.tiers.map((tier, i) => {
          const isLast = i === value.tiers.length - 1;
          return (
            <div className="tier-row" key={i}>
              <span className="tier-row__name font-mono">Tier {i + 1}</span>
              {isLast ? (
                <span className="tier-row__unbounded font-mono">∞ no upper bound</span>
              ) : (
                <InputNumber
                  aria-label={`Tier ${i + 1} upper bound`}
                  min={1}
                  style={{ width: 160 }}
                  value={tier.upTo}
                  onChange={(v) => setTier(i, { upTo: v ?? null })}
                />
              )}
              <Input
                aria-label={`Tier ${i + 1} approver role`}
                placeholder="approver role"
                style={{ width: 220 }}
                value={tier.role}
                onChange={(e) => setTier(i, { role: e.target.value })}
              />
              {!isLast && (
                <Button type="text" danger onClick={() => removeTier(i)}>
                  Remove
                </Button>
              )}
            </div>
          );
        })}
        <div>
          <Button onClick={addTier} style={{ marginTop: 8 }}>
            Add tier
          </Button>
        </div>
        {ascendingError ? (
          <div className="field-error" data-testid="field-error" role="alert">
            {ascendingError}
          </div>
        ) : (
          <FieldError issues={issues} path={['approval', 'tiers']} />
        )}
      </div>
    </div>
  );
}
