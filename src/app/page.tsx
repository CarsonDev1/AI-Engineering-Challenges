'use client';

import { useCallback, useEffect, useState } from 'react';
import { App, Button } from 'antd';
import { TenantCard, type TenantSummary } from '@/components/TenantCard';
import { CreateTenantModal } from '@/components/CreateTenantModal';

export default function HomePage() {
  const { message, modal } = App.useApp();
  const [tenants, setTenants] = useState<TenantSummary[] | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/tenants');
    setTenants(res.ok ? await res.json() : []);
  }, []);

  useEffect(() => {
    // load() only setState()s after an await (deferred), so it does not cause the
    // synchronous cascading render this rule guards against — safe mount fetch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const resetDemo = () =>
    modal.confirm({
      title: 'Reset demo data?',
      content:
        'Re-seeds the three sample tenants (SafeGuard, HealthFirst, GovHealth). Any tenant you added yourself is left untouched.',
      okText: 'Reset',
      cancelText: 'Cancel',
      onOk: async () => {
        setResetting(true);
        try {
          const res = await fetch('/api/reset-demo', { method: 'POST' });
          if (!res.ok) throw new Error('reset failed');
          await load();
          message.success('Demo data reset to the three sample tenants.');
        } catch {
          message.error('Reset failed.');
        } finally {
          setResetting(false);
        }
      },
    });

  return (
    <>
      <div className="page-head">
        <div>
          <span className="pill">Operations · Insurers</span>
          <h1 className="page-head__title">Tenant Configurations</h1>
          <p className="page-head__sub">
            Every insurer on the platform runs on its own configuration — branding, claim types, approval tiers,
            notifications, SLAs, and custom fields. The runtime processes each claim by the submitting tenant&rsquo;s
            active config.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
          <Button onClick={resetDemo} loading={resetting}>
            Reset demo data
          </Button>
          <Button type="primary" onClick={() => setCreateOpen(true)}>
            New tenant
          </Button>
        </div>
      </div>

      {tenants === null ? (
        <p className="muted">Loading tenants…</p>
      ) : tenants.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state__title">No tenants yet</p>
          <p className="empty-state__sub">Seed the three sample insurers to explore the platform.</p>
          <Button type="primary" onClick={resetDemo} loading={resetting}>
            Reset demo data
          </Button>
        </div>
      ) : (
        <div className="tenant-grid">
          {tenants.map((t, i) => (
            <TenantCard key={t.id} tenant={t} index={i} />
          ))}
        </div>
      )}

      <CreateTenantModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={async () => {
          setCreateOpen(false);
          await load();
        }}
      />
    </>
  );
}
