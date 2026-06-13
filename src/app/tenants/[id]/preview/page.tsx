'use client';

import { use, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { App, Button } from 'antd';
import { BrandingFrame } from '@/components/BrandingFrame';
import { ClaimForm, type ClaimDraft } from '@/components/ClaimForm';
import { ProcessResultPanel } from '@/components/ProcessResultPanel';
import { CLAIM_TYPES, type ClaimType, type TenantConfig } from '@/lib/config/schema';
import type { ProcessClaimResult } from '@/lib/engine/process-claim';

type TenantDetail = { id: string; slug: string; name: string; activeConfig: TenantConfig | null };

// Local calendar date (not UTC) so the default submission date matches the operator's day.
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Canonical claim-type order — not Object.keys(), whose order reflects Postgres jsonb key
// normalisation (by length) after the config round-trips through the database.
const firstEnabledType = (config: TenantConfig): ClaimType | null =>
  CLAIM_TYPES.find((t) => config.claimTypes[t]?.enabled) ?? null;

export default function TenantPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { message } = App.useApp();
  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [missing, setMissing] = useState(false);
  const [draft, setDraft] = useState<ClaimDraft | null>(null);
  const [result, setResult] = useState<ProcessClaimResult | null>(null);
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/tenants/${id}`);
    if (!res.ok) {
      setMissing(true);
      return;
    }
    const t = (await res.json()) as TenantDetail;
    setTenant(t);
    const cfg = t.activeConfig;
    if (cfg) {
      // Initialise the editable claim exactly once. The mount effect runs twice under
      // React Strict Mode (dev); a plain set would let the second load wipe an
      // in-progress claim, so only seed the draft when there isn't one yet.
      setDraft((prev) => prev ?? {
        claimType: firstEnabledType(cfg),
        amount: 12000,
        submittedAt: todayISO(),
        customFieldValues: {},
      });
    }
  }, [id]);

  useEffect(() => {
    // load() only setState()s after an await (deferred), so it does not trigger the
    // synchronous cascading render this rule guards against — safe mount fetch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  // The SLA day count for the "N business days" caption — the result carries only the
  // computed deadline, so the count comes from the active config for the chosen type.
  const businessDays = useMemo(
    () =>
      tenant?.activeConfig && draft?.claimType
        ? tenant.activeConfig.sla.businessDaysByClaimType[draft.claimType]
        : undefined,
    [tenant, draft?.claimType]
  );

  if (missing || (tenant && !tenant.activeConfig)) {
    return (
      <div className="empty-state">
        <p className="empty-state__title">{missing ? 'Tenant not found' : 'No active configuration'}</p>
        <p className="empty-state__sub">
          {missing
            ? 'It may have been deleted. Head back to the tenant list.'
            : 'Configure this tenant before previewing a claim.'}
        </p>
        <Link href={missing ? '/' : `/tenants/${id}`}>
          <Button type="primary">{missing ? 'Back to tenants' : 'Configure tenant'}</Button>
        </Link>
      </div>
    );
  }

  if (!tenant || !draft) return <p className="muted">Loading preview…</p>;
  const config = tenant.activeConfig!;

  const run = async () => {
    setRunning(true);
    try {
      const res = await fetch('/api/process-claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: id, claim: draft }),
      });
      if (res.status === 404) {
        message.error('Tenant not found — it may have been deleted.');
        setResult(null);
        return;
      }
      if (res.status === 400) {
        message.error('Enter a claim type, amount, and submission date first.');
        setResult(null);
        return;
      }
      setResult((await res.json()) as ProcessClaimResult);
    } catch {
      message.error('Could not reach the claims engine.');
    } finally {
      setRunning(false);
    }
  };

  const canRun = draft.claimType !== null && draft.amount !== null && draft.submittedAt !== '';

  return (
    <>
      <div className="page-head">
        <div>
          <span className="pill">Preview</span>
          <h1 className="page-head__title">{tenant.name}</h1>
          <p className="page-head__sub">
            A sample claim runs through the <span className="font-mono">/api/process-claim</span> runtime endpoint —
            the same engine that processes live claims, so this preview can never drift from production behaviour.
          </p>
        </div>
        <div className="page-head__actions">
          <Link href={`/tenants/${id}`}>
            <Button>Edit configuration</Button>
          </Link>
        </div>
      </div>

      <BrandingFrame branding={config.branding}>
        <div className="preview-grid">
          <div className="preview-col">
            <h2 className="preview-col__title">Sample claim</h2>
            <ClaimForm config={config} value={draft} onChange={setDraft} />
            <Button type="primary" onClick={run} loading={running} disabled={!canRun} block>
              Process claim
            </Button>
          </div>
          <div className="preview-col">
            <h2 className="preview-col__title">How {tenant.name} processes it</h2>
            {result ? (
              <ProcessResultPanel result={result} businessDays={businessDays} amount={draft.amount ?? undefined} />
            ) : (
              <div className="result-empty">
                <p className="muted">
                  Fill in the claim and press <strong>Process claim</strong> to see the approval routing, required
                  documents, notifications, and SLA deadline this tenant would apply.
                </p>
              </div>
            )}
          </div>
        </div>
      </BrandingFrame>
    </>
  );
}
