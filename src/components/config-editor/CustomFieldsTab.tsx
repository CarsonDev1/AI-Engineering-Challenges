'use client';

import { Button, Input, Select, Switch } from 'antd';
import { CUSTOM_FIELD_TYPES, type TenantConfig } from '@/lib/config/schema';
import { FieldError } from './Field';
import type { Issue } from './issues';

type CustomFields = TenantConfig['customFields'];
type CustomField = CustomFields[number];

export function CustomFieldsTab({
  value,
  onChange,
  issues,
}: {
  value: CustomFields;
  onChange: (v: CustomFields) => void;
  issues: Issue[];
}) {
  const set = (i: number, patch: Partial<CustomField>) =>
    onChange(value.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));
  const add = () => onChange([...value, { key: '', label: '', type: 'text', required: false }]);

  return (
    <div className="editor-pane">
      <FieldError issues={issues} path={['customFields']} exact />
      {value.length === 0 && (
        <p className="muted" style={{ margin: 0 }}>
          No custom fields — this tenant&rsquo;s claim form asks only for the standard inputs.
        </p>
      )}
      {value.map((f, i) => (
        <div className="cf-row" key={i}>
          <div className="cf-row__grid">
            <Input
              aria-label={`Field ${i + 1} key`}
              placeholder="key (e.g. employeeId)"
              value={f.key}
              onChange={(e) => set(i, { key: e.target.value })}
            />
            <Input
              aria-label={`Field ${i + 1} label`}
              placeholder="Label shown on the claim form"
              value={f.label}
              onChange={(e) => set(i, { label: e.target.value })}
            />
            <Select
              aria-label={`Field ${i + 1} type`}
              style={{ width: 110, flexShrink: 0 }}
              value={f.type}
              options={CUSTOM_FIELD_TYPES.map((t) => ({ value: t, label: t }))}
              onChange={(type) => set(i, { type, options: type === 'select' ? (f.options ?? []) : undefined })}
            />
            <label className="cf-row__required">
              <Switch
                aria-label={`Field ${i + 1} required`}
                checked={f.required}
                onChange={(required) => set(i, { required })}
              />
              required
            </label>
            <Button type="text" danger onClick={() => remove(i)}>
              Remove
            </Button>
          </div>
          {f.type === 'select' && (
            <Select
              aria-label={`Field ${i + 1} options`}
              mode="tags"
              placeholder="Options — type a value and press Enter"
              value={f.options ?? []}
              onChange={(options: string[]) => set(i, { options })}
            />
          )}
          <FieldError issues={issues} path={['customFields', i]} />
        </div>
      ))}
      <div>
        <Button onClick={add}>Add custom field</Button>
      </div>
    </div>
  );
}
