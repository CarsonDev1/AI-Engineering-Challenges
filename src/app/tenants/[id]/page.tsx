'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from 'antd';
import { ConfigEditor } from '@/components/config-editor/ConfigEditor';
import type { TenantConfig } from '@/lib/config/schema';

type TenantDetail = {
  id: string;
  slug: string;
  name: string;
  activeConfig: TenantConfig | null;
};

export default function TenantEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [missing, setMissing] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/tenants/${id}`);
    if (res.ok) setTenant(await res.json());
    else setMissing(true);
  }, [id]);

  useEffect(() => {
    // load() only setState()s after an await (deferred), so it does not cause the
    // synchronous cascading render this rule guards against — safe mount fetch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  if (missing || (tenant && !tenant.activeConfig)) {
    return (
      <div className="empty-state">
        <p className="empty-state__title">{missing ? 'Tenant not found' : 'No active configuration'}</p>
        <p className="empty-state__sub">
          {missing
            ? 'It may have been deleted. Head back to the tenant list.'
            : 'This tenant has no configuration version to edit yet.'}
        </p>
        <Link href="/">
          <Button type="primary">Back to tenants</Button>
        </Link>
      </div>
    );
  }

  if (!tenant) return <p className="muted">Loading tenant…</p>;

  return (
    <ConfigEditor
      key={tenant.id}
      tenantId={tenant.id}
      tenantName={tenant.name}
      slug={tenant.slug}
      initialConfig={tenant.activeConfig!}
    />
  );
}
