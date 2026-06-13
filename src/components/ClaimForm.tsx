'use client';

import { Input, InputNumber, Select } from 'antd';
import { CLAIM_TYPES, type ClaimType, type TenantConfig } from '@/lib/config/schema';

// The shape the form edits. `amount`/`claimType` are nullable so the form can start empty;
// the page gates submission until they are set. Mirrors the engine's ClaimInput once filled.
export type ClaimDraft = {
  claimType: ClaimType | null;
  amount: number | null;
  submittedAt: string; // YYYY-MM-DD
  customFieldValues: Record<string, unknown>;
};

type CustomField = TenantConfig['customFields'][number];

// A controlled, tenant-parameterized claim form: it offers only the tenant's enabled
// claim types and renders that tenant's custom fields dynamically. No submit button and
// no API call — the page owns those — so preview and the demo page can each compose it.
export function ClaimForm({
  config,
  value,
  onChange,
}: {
  config: TenantConfig;
  value: ClaimDraft;
  onChange: (next: ClaimDraft) => void;
}) {
  // Canonical order, not Object.keys() — jsonb normalises key order through the database.
  const enabledTypes = CLAIM_TYPES.filter((t) => config.claimTypes[t]?.enabled);

  const set = (patch: Partial<ClaimDraft>) => onChange({ ...value, ...patch });
  const setCustom = (key: string, v: unknown) =>
    onChange({ ...value, customFieldValues: { ...value.customFieldValues, [key]: v } });

  return (
    <div className="claim-form">
      <div className="field">
        <span className="field__label">Claim type</span>
        <Select
          aria-label="Claim type"
          value={value.claimType ?? undefined}
          placeholder="Select a claim type"
          options={enabledTypes.map((t) => ({ value: t, label: t }))}
          onChange={(claimType) => set({ claimType })}
        />
      </div>

      <div className="field">
        <span className="field__label">Claim amount</span>
        <InputNumber
          aria-label="Claim amount"
          style={{ width: '100%' }}
          min={0}
          value={value.amount}
          onChange={(amount) => set({ amount: amount ?? null })}
        />
      </div>

      <div className="field">
        <span className="field__label">Submission date</span>
        <input
          type="date"
          className="native-date"
          aria-label="Submission date"
          value={value.submittedAt}
          onChange={(e) => set({ submittedAt: e.target.value })}
        />
      </div>

      {config.customFields.map((f) => (
        <div className="field" key={f.key}>
          <span className="field__label">
            {f.label}
            {f.required && <span className="field__req" aria-hidden="true"> *</span>}
          </span>
          <CustomFieldInput field={f} value={value.customFieldValues[f.key]} onChange={(v) => setCustom(f.key, v)} />
        </div>
      ))}
    </div>
  );
}

function CustomFieldInput({
  field,
  value,
  onChange,
}: {
  field: CustomField;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  switch (field.type) {
    case 'number':
      return (
        <InputNumber
          aria-label={field.label}
          style={{ width: '100%' }}
          value={typeof value === 'number' ? value : null}
          onChange={(v) => onChange(v ?? null)}
        />
      );
    case 'date':
      return (
        <input
          type="date"
          className="native-date"
          aria-label={field.label}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value || null)}
        />
      );
    case 'select':
      return (
        <Select
          aria-label={field.label}
          placeholder="Select an option"
          value={typeof value === 'string' && value ? value : undefined}
          options={(field.options ?? []).map((o) => ({ value: o, label: o }))}
          onChange={(v) => onChange(v)}
        />
      );
    case 'text':
      return (
        <Input
          aria-label={field.label}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    default: {
      // Exhaustive: a new CustomFieldType must add its input here or this fails to compile.
      const _exhaustive: never = field.type;
      return _exhaustive;
    }
  }
}
