'use client';

import { Collapse, Select, Switch } from 'antd';
import { CLAIM_TYPES, type ClaimType, type TenantConfig } from '@/lib/config/schema';
import { Field, FieldError } from './Field';
import type { Issue } from './issues';

type ClaimTypes = TenantConfig['claimTypes'];

export function ClaimTypesTab({
  value,
  onChange,
  issues,
}: {
  value: ClaimTypes;
  onChange: (v: ClaimTypes) => void;
  issues: Issue[];
}) {
  const toggle = (t: ClaimType, enabled: boolean) => {
    const existing = value[t] ?? { enabled: false, requiredDocuments: [], optionalDocuments: [] };
    onChange({ ...value, [t]: { ...existing, enabled } });
  };

  const setDocs = (t: ClaimType, patch: Partial<NonNullable<ClaimTypes[ClaimType]>>) =>
    onChange({ ...value, [t]: { ...value[t]!, ...patch } });

  const items = CLAIM_TYPES.map((t) => {
    const cfg = value[t];
    return {
      key: t,
      label: (
        <span className="claim-type-head">
          <span className="font-mono">{t}</span>
          <span className="muted" style={{ fontSize: 12 }}>
            {cfg?.enabled
              ? `${cfg.requiredDocuments.length} required · ${cfg.optionalDocuments.length} optional documents`
              : 'not offered'}
          </span>
        </span>
      ),
      extra: (
        <Switch
          aria-label={`Enable ${t}`}
          checked={!!cfg?.enabled}
          onClick={(_, e) => e.stopPropagation()}
          onChange={(checked) => toggle(t, checked)}
        />
      ),
      children: cfg ? (
        <div className="editor-pane" style={{ gap: 16 }}>
          <Field
            label="Required documents"
            htmlFor={`${t}-required-docs`}
            issues={issues}
            path={['claimTypes', t, 'requiredDocuments']}
          >
            <Select
              id={`${t}-required-docs`}
              mode="tags"
              placeholder="Type a document name and press Enter"
              value={cfg.requiredDocuments}
              onChange={(docs: string[]) => setDocs(t, { requiredDocuments: docs })}
            />
          </Field>
          <Field
            label="Optional documents"
            htmlFor={`${t}-optional-docs`}
            issues={issues}
            path={['claimTypes', t, 'optionalDocuments']}
          >
            <Select
              id={`${t}-optional-docs`}
              mode="tags"
              placeholder="Type a document name and press Enter"
              value={cfg.optionalDocuments}
              onChange={(docs: string[]) => setDocs(t, { optionalDocuments: docs })}
            />
          </Field>
          <FieldError issues={issues} path={['claimTypes', t]} exact />
        </div>
      ) : (
        <p className="muted" style={{ margin: 0 }}>
          Turn the switch on to offer {t} claims and configure their documents.
        </p>
      ),
    };
  });

  return (
    <div className="editor-pane" style={{ maxWidth: 860 }}>
      <FieldError issues={issues} path={['claimTypes']} exact />
      <Collapse items={items} />
    </div>
  );
}
