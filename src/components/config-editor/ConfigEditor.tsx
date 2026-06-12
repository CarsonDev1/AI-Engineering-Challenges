'use client';

import { useState } from 'react';
import { App, Badge, Button, Input, Tabs } from 'antd';
import { CLAIM_TYPES, tenantConfigSchema, type TenantConfig } from '@/lib/config/schema';
import { toIssues, type Issue } from './issues';
import { BrandingTab } from './BrandingTab';
import { ClaimTypesTab } from './ClaimTypesTab';
import { ApprovalTab } from './ApprovalTab';
import { NotificationsTab } from './NotificationsTab';
import { SlaTab } from './SlaTab';
import { CustomFieldsTab } from './CustomFieldsTab';

type Props = {
  tenantId: string;
  tenantName: string;
  slug: string;
  initialConfig: TenantConfig;
};

// One draft state for the whole config; each tab edits its slice. Validation runs on
// Save (client Zod first, then the server's 400 issues land in the same field mapping);
// after the first failed save it re-runs on every change so errors clear as fixed.
export function ConfigEditor({ tenantId, tenantName, slug, initialConfig }: Props) {
  const { message } = App.useApp();
  const [draft, setDraft] = useState<TenantConfig>(initialConfig);
  const [note, setNote] = useState('');
  const [issues, setIssues] = useState<Issue[]>([]);
  const [liveValidate, setLiveValidate] = useState(false);
  const [saving, setSaving] = useState(false);

  const apply = (next: TenantConfig) => {
    setDraft(next);
    if (liveValidate) {
      const parsed = tenantConfigSchema.safeParse(next);
      setIssues(parsed.success ? [] : toIssues(parsed.error.issues));
    }
  };

  const update = <K extends keyof TenantConfig>(key: K, value: TenantConfig[K]) =>
    apply({ ...draft, [key]: value });

  // Enabling a claim type seeds a default SLA (5 business days); disabling removes its
  // SLA entry. The SLA tab only shows enabled types, so a stale entry would make the
  // draft invalid with no visible row to fix.
  const updateClaimTypes = (claimTypes: TenantConfig['claimTypes']) => {
    const businessDaysByClaimType = { ...draft.sla.businessDaysByClaimType };
    for (const t of CLAIM_TYPES) {
      if (claimTypes[t]?.enabled) businessDaysByClaimType[t] ??= 5;
      else delete businessDaysByClaimType[t];
    }
    apply({ ...draft, claimTypes, sla: { ...draft.sla, businessDaysByClaimType } });
  };

  const save = async () => {
    const parsed = tenantConfigSchema.safeParse(draft);
    if (!parsed.success) {
      setIssues(toIssues(parsed.error.issues));
      setLiveValidate(true);
      message.error('Fix the highlighted fields before saving.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/tenants/${tenantId}/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: parsed.data, note: note.trim() || undefined }),
      });
      if (res.status === 400) {
        const body = await res.json();
        setIssues(toIssues(body.issues ?? []));
        setLiveValidate(true);
        message.error('The server rejected this configuration.');
        return;
      }
      if (!res.ok) {
        message.error('Save failed.');
        return;
      }
      const { version } = await res.json();
      setIssues([]);
      setNote('');
      message.success(`Saved as version ${version.versionNo}`);
    } catch {
      message.error('Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const tabLabel = (label: string, section: string) => {
    const count = issues.filter((i) => i.path[0] === section).length;
    return (
      <span>
        {label}
        {count > 0 && <Badge count={count} size="small" style={{ marginLeft: 8 }} />}
      </span>
    );
  };

  const items = [
    {
      key: 'branding',
      label: tabLabel('Branding', 'branding'),
      children: <BrandingTab value={draft.branding} onChange={(v) => update('branding', v)} issues={issues} />,
    },
    {
      key: 'claimTypes',
      label: tabLabel('Claim Types & Documents', 'claimTypes'),
      children: <ClaimTypesTab value={draft.claimTypes} onChange={updateClaimTypes} issues={issues} />,
    },
    {
      key: 'approval',
      label: tabLabel('Approval', 'approval'),
      children: <ApprovalTab value={draft.approval} onChange={(v) => update('approval', v)} issues={issues} />,
    },
    {
      key: 'notifications',
      label: tabLabel('Notifications', 'notifications'),
      children: (
        <NotificationsTab value={draft.notifications} onChange={(v) => update('notifications', v)} issues={issues} />
      ),
    },
    {
      key: 'sla',
      label: tabLabel('SLA', 'sla'),
      children: (
        <SlaTab value={draft.sla} claimTypes={draft.claimTypes} onChange={(v) => update('sla', v)} issues={issues} />
      ),
    },
    {
      key: 'customFields',
      label: tabLabel('Custom Fields', 'customFields'),
      children: (
        <CustomFieldsTab value={draft.customFields} onChange={(v) => update('customFields', v)} issues={issues} />
      ),
    },
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <span className="pill">Configuration</span>
          <h1 className="page-head__title">{tenantName}</h1>
          <p className="page-head__sub">
            <span className="font-mono">/{slug}</span> — every save creates a new immutable version; the runtime
            processes claims with the latest one.
          </p>
        </div>
        <div className="page-head__actions">
          <Input
            placeholder="Version note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            style={{ width: 260, maxWidth: '100%' }}
          />
          <Button type="primary" onClick={save} loading={saving}>
            Save configuration
          </Button>
        </div>
      </div>
      <Tabs items={items} />
    </>
  );
}
