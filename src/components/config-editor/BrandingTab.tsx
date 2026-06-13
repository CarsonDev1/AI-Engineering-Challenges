'use client';

import { ColorPicker, Input, Select } from 'antd';
import { CURRENCIES, type TenantConfig } from '@/lib/config/schema';
import { Field } from './Field';
import type { Issue } from './issues';

type Branding = TenantConfig['branding'];

export function BrandingTab({
  value,
  onChange,
  issues,
}: {
  value: Branding;
  onChange: (v: Branding) => void;
  issues: Issue[];
}) {
  return (
    <div className="editor-pane">
      <Field label="Company name" htmlFor="branding-companyName" issues={issues} path={['branding', 'companyName']}>
        <Input
          id="branding-companyName"
          value={value.companyName}
          onChange={(e) => onChange({ ...value, companyName: e.target.value })}
        />
      </Field>

      <Field label="Logo URL" htmlFor="branding-logoUrl" issues={issues} path={['branding', 'logoUrl']}>
        <Input
          id="branding-logoUrl"
          value={value.logoUrl}
          onChange={(e) => onChange({ ...value, logoUrl: e.target.value })}
        />
      </Field>

      <div className="field-row">
        <Field label="Primary color" issues={issues} path={['branding', 'primaryColor']}>
          <ColorPicker
            value={value.primaryColor}
            disabledAlpha
            showText
            onChange={(c) => onChange({ ...value, primaryColor: c.toHexString() })}
          />
        </Field>
        <Field label="Secondary color" issues={issues} path={['branding', 'secondaryColor']}>
          <ColorPicker
            value={value.secondaryColor}
            disabledAlpha
            showText
            onChange={(c) => onChange({ ...value, secondaryColor: c.toHexString() })}
          />
        </Field>
      </div>

      <Field label="Currency" htmlFor="branding-currency" issues={issues} path={['branding', 'currency']}>
        <Select
          id="branding-currency"
          aria-label="Currency"
          style={{ width: 160 }}
          value={value.currency}
          options={CURRENCIES.map((c) => ({ value: c, label: c }))}
          onChange={(currency) => onChange({ ...value, currency })}
        />
      </Field>
    </div>
  );
}
