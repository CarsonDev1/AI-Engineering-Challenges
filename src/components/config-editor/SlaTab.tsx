'use client';

import { Input, InputNumber } from 'antd';
import { CLAIM_TYPES, type ClaimType, type TenantConfig } from '@/lib/config/schema';
import { Field, FieldError } from './Field';
import type { Issue } from './issues';

type Sla = TenantConfig['sla'];

// SLA rows exist only for enabled claim types — the rows appear and disappear with the
// Claim Types tab's switches (the editor keeps both sections in sync on toggle).
export function SlaTab({
  value,
  claimTypes,
  onChange,
  issues,
}: {
  value: Sla;
  claimTypes: TenantConfig['claimTypes'];
  onChange: (v: Sla) => void;
  issues: Issue[];
}) {
  const enabledTypes = CLAIM_TYPES.filter((t) => claimTypes[t]?.enabled);

  const setDays = (t: ClaimType, days: number | null) => {
    const businessDaysByClaimType = { ...value.businessDaysByClaimType };
    if (days === null) delete businessDaysByClaimType[t];
    else businessDaysByClaimType[t] = days;
    onChange({ ...value, businessDaysByClaimType });
  };

  return (
    <div className="editor-pane">
      <FieldError issues={issues} path={['sla', 'businessDaysByClaimType']} exact />
      {enabledTypes.length === 0 ? (
        <p className="muted" style={{ margin: 0 }}>
          No claim types are enabled — enable one under Claim Types &amp; Documents to set its SLA.
        </p>
      ) : (
        enabledTypes.map((t) => (
          <Field
            key={t}
            label={`${t} — business days to resolve`}
            htmlFor={`sla-${t}`}
            issues={issues}
            path={['sla', 'businessDaysByClaimType', t]}
          >
            <InputNumber
              id={`sla-${t}`}
              min={1}
              style={{ width: 160 }}
              value={value.businessDaysByClaimType[t]}
              onChange={(v) => setDays(t, v ?? null)}
            />
          </Field>
        ))
      )}
      <Field
        label="Escalation — role to notify when the SLA deadline passes"
        htmlFor="sla-escalation"
        issues={issues}
        path={['sla', 'escalation', 'notifyRole']}
      >
        <Input
          id="sla-escalation"
          style={{ width: 280 }}
          value={value.escalation.notifyRole}
          onChange={(e) => onChange({ ...value, escalation: { notifyRole: e.target.value } })}
        />
      </Field>
    </div>
  );
}
