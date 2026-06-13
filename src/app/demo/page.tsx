'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { App, Button, InputNumber, Select, Switch } from 'antd';
import { BrandingFrame } from '@/components/BrandingFrame';
import { CustomFieldInput } from '@/components/ClaimForm';
import { ProcessResultPanel } from '@/components/ProcessResultPanel';
import { CLAIM_TYPES, type ClaimType, type TenantConfig } from '@/lib/config/schema';
import type { ProcessClaimResult } from '@/lib/engine/process-claim';

type Tenant = { id: string; slug: string; name: string; activeConfig: TenantConfig | null };

// The three demo tenants, in the order the brief tells the story.
const SEED_ORDER = ['safeguard', 'healthfirst', 'govhealth'];

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// A valid prefilled value for a custom field so the shared claim passes every tenant's
// validation out of the box; the "Clear custom fields" switch sends {} instead to show
// the per-tenant required-field errors.
const NICE: Record<string, string> = { employeeId: 'E-1001', department: 'Cardiology', budgetCode: 'BG-2026' };
function prefill(field: TenantConfig['customFields'][number]): unknown {
  switch (field.type) {
    case 'number':
      return 1;
    case 'date':
      return todayISO();
    case 'select':
      return field.options?.[0] ?? '';
    case 'text':
      return NICE[field.key] ?? 'SAMPLE';
  }
}

export default function DemoPage() {
  const { message } = App.useApp();
  const [tenants, setTenants] = useState<Tenant[] | null>(null);
  const [claimType, setClaimType] = useState<ClaimType>('OUTPATIENT');
  const [amount, setAmount] = useState<number>(12000);
  const [submittedAt, setSubmittedAt] = useState<string>(todayISO());
  const [customByTenant, setCustomByTenant] = useState<Record<string, Record<string, unknown>>>({});
  const [cleared, setCleared] = useState(false);
  const [results, setResults] = useState<Record<string, ProcessClaimResult> | null>(null);
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    // no-store: the seed ids change on every demo reset, so a cached tenant list would
    // point this page at tenants that no longer exist (process-claim would 404).
    const res = await fetch('/api/tenants', { cache: 'no-store' });
    const all: Tenant[] = res.ok ? await res.json() : [];
    const seeds = SEED_ORDER.map((slug) => all.find((t) => t.slug === slug)).filter((t): t is Tenant => !!t?.activeConfig);
    setTenants(seeds);
    // Prefill each tenant's custom fields with valid values.
    const prefilled: Record<string, Record<string, unknown>> = {};
    for (const t of seeds) {
      prefilled[t.id] = Object.fromEntries(t.activeConfig!.customFields.map((f) => [f.key, prefill(f)]));
    }
    setCustomByTenant(prefilled);
  }, []);

  useEffect(() => {
    // load() only setState()s after an await (deferred) — safe mount fetch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  // Claim types every demo tenant enables — the common ground for a single shared claim.
  const sharedTypes = tenants
    ? CLAIM_TYPES.filter((ct) => tenants.every((t) => t.activeConfig!.claimTypes[ct]?.enabled))
    : [];

  const setCustom = (tenantId: string, key: string, value: unknown) =>
    setCustomByTenant((prev) => ({ ...prev, [tenantId]: { ...prev[tenantId], [key]: value } }));

  // The SAME claim (type, amount, date) goes to every tenant; only the per-tenant custom
  // values differ. One endpoint, three configs — three fates.
  const run = async () => {
    if (!tenants) return;
    setRunning(true);
    try {
      const entries = await Promise.all(
        tenants.map(async (t) => {
          const claim = {
            claimType,
            amount,
            submittedAt,
            customFieldValues: cleared ? {} : customByTenant[t.id] ?? {},
          };
          const res = await fetch('/api/process-claim', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tenantId: t.id, claim }),
          });
          // Only a 200 is a ProcessClaimResult; a 404 (stale seed id) / 400 body is NOT,
          // and must never reach ProcessResultPanel (which would crash on result.errors).
          return [t.id, res.ok ? ((await res.json()) as ProcessClaimResult) : null] as const;
        })
      );
      if (entries.some(([, r]) => r === null)) {
        // A demo tenant's config vanished — almost always a demo reset elsewhere left this
        // page on stale ids. Refetch the current seeds and let the user re-run.
        message.error('The demo tenants changed — refreshed them, please run again.');
        setResults(null);
        await load();
        return;
      }
      setResults(Object.fromEntries(entries as [string, ProcessClaimResult][]));
    } finally {
      setRunning(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <span className="pill">Demo</span>
          <h1 className="page-head__title">One claim, three fates</h1>
          <p className="page-head__sub">
            The same claim runs through all three insurers&rsquo; configurations at once — watch how routing,
            notifications, and SLA deadlines diverge purely from each tenant&rsquo;s config, with no code change.
          </p>
        </div>
      </div>

      {tenants === null ? (
        <p className="muted">Loading demo tenants…</p>
      ) : tenants.length < 3 ? (
        <div className="empty-state">
          <p className="empty-state__title">Demo tenants not seeded</p>
          <p className="empty-state__sub">Reset the demo data from the tenant list, then come back.</p>
          <Link href="/">
            <Button type="primary">Back to tenants</Button>
          </Link>
        </div>
      ) : (
        <>
          <div className="demo-controls">
            <div className="field">
              <span className="field__label">Claim type</span>
              <Select
                aria-label="Claim type"
                style={{ width: 180 }}
                value={claimType}
                options={sharedTypes.map((t) => ({ value: t, label: t }))}
                onChange={(t) => setClaimType(t)}
              />
            </div>
            <div className="field">
              <span className="field__label">Claim amount</span>
              <InputNumber
                aria-label="Claim amount"
                style={{ width: 180 }}
                min={0}
                value={amount}
                onChange={(v) => setAmount(v ?? 0)}
              />
            </div>
            <div className="field">
              <span className="field__label">Submission date</span>
              <input
                type="date"
                className="native-date"
                aria-label="Submission date"
                value={submittedAt}
                onChange={(e) => setSubmittedAt(e.target.value)}
              />
            </div>
            <label className="demo-controls__clear">
              <Switch aria-label="Clear custom fields" checked={cleared} onChange={setCleared} />
              Clear custom fields
            </label>
            <Button type="primary" onClick={run} loading={running}>
              Process for all three
            </Button>
          </div>

          <div className="demo-grid">
            {tenants.map((t) => {
              const cfg = t.activeConfig!;
              const result = results?.[t.id];
              return (
                <BrandingFrame key={t.id} branding={cfg.branding}>
                  <div className="demo-col" data-testid="demo-column" data-tenant={t.slug}>
                    <h2 className="demo-col__name">{t.name}</h2>

                    {cfg.customFields.length > 0 ? (
                      <div className="demo-col__customs" aria-disabled={cleared}>
                        {cfg.customFields.map((f) => (
                          <div className="field" key={f.key}>
                            <span className="field__label">
                              {f.label}
                              {f.required && <span className="field__req" aria-hidden="true"> *</span>}
                            </span>
                            <CustomFieldInput
                              field={f}
                              value={cleared ? '' : customByTenant[t.id]?.[f.key]}
                              onChange={(v) => setCustom(t.id, f.key, v)}
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="muted demo-col__customs" style={{ fontSize: 13, margin: 0 }}>
                        No custom fields required.
                      </p>
                    )}

                    {result ? (
                      <ProcessResultPanel result={result} businessDays={cfg.sla.businessDaysByClaimType[claimType]} />
                    ) : (
                      <p className="muted" style={{ fontSize: 13 }}>
                        Press <strong>Process for all three</strong> to see this tenant&rsquo;s outcome.
                      </p>
                    )}
                  </div>
                </BrandingFrame>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
