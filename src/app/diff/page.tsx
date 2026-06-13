'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Select } from 'antd';
import { DiffTable } from '@/components/DiffTable';
import { diffConfigs } from '@/lib/diff/diff-configs';
import type { TenantConfig } from '@/lib/config/schema';

type TenantSummary = { id: string; slug: string; name: string; activeConfig: TenantConfig | null };

export default function DiffPage() {
  const [tenants, setTenants] = useState<TenantSummary[] | null>(null);
  const [leftId, setLeftId] = useState<string | null>(null);
  const [rightId, setRightId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/tenants');
    const list: TenantSummary[] = res.ok ? await res.json() : [];
    setTenants(list);
    // Default to the first two distinct tenants so the page shows a diff on arrival.
    setLeftId((prev) => prev ?? list[0]?.id ?? null);
    setRightId((prev) => prev ?? list[1]?.id ?? list[0]?.id ?? null);
  }, []);

  useEffect(() => {
    // load() only setState()s after an await (deferred), so it does not cause the
    // synchronous cascading render this rule guards against — safe mount fetch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const left = tenants?.find((t) => t.id === leftId) ?? null;
  const right = tenants?.find((t) => t.id === rightId) ?? null;

  // Both configs come from the same /api/tenants read (Postgres jsonb), so diffConfigs'
  // equal-serialization precondition holds — never diff against a freshly built literal.
  const entries = useMemo(
    () => (left?.activeConfig && right?.activeConfig ? diffConfigs(left.activeConfig, right.activeConfig) : []),
    [left, right]
  );

  const options = (tenants ?? []).map((t) => ({ value: t.id, label: t.name }));

  return (
    <>
      <div className="page-head">
        <div>
          <span className="pill">Compare</span>
          <h1 className="page-head__title">Compare tenants</h1>
          <p className="page-head__sub">
            See exactly how two insurers&rsquo; configurations differ — every field that was added, removed, or changed
            between them, grouped by section.
          </p>
        </div>
      </div>

      {tenants === null ? (
        <p className="muted">Loading tenants…</p>
      ) : tenants.length < 2 ? (
        <div className="empty-state">
          <p className="empty-state__title">Need two tenants to compare</p>
          <p className="empty-state__sub">Seed the demo tenants or create another, then come back.</p>
        </div>
      ) : (
        <>
          <div className="compare-picker">
            <div className="field">
              <span className="field__label">First tenant</span>
              <Select
                aria-label="First tenant"
                showSearch
                optionFilterProp="label"
                style={{ width: '100%' }}
                value={leftId ?? undefined}
                options={options}
                onChange={setLeftId}
              />
            </div>
            <span className="compare-picker__vs font-mono">vs</span>
            <div className="field">
              <span className="field__label">Second tenant</span>
              <Select
                aria-label="Second tenant"
                showSearch
                optionFilterProp="label"
                style={{ width: '100%' }}
                value={rightId ?? undefined}
                options={options}
                onChange={setRightId}
              />
            </div>
          </div>

          {left && right && (
            <DiffTable entries={entries} leftLabel={left.name} rightLabel={right.name} />
          )}
        </>
      )}
    </>
  );
}
