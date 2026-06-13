'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { App, Button } from 'antd';
import { VersionDiffDrawer } from '@/components/VersionDiffDrawer';
import type { TenantConfig } from '@/lib/config/schema';

type TenantDetail = {
  id: string;
  slug: string;
  name: string;
  activeVersionId: string | null;
  activeConfig: TenantConfig | null;
};
type Version = { id: string; versionNo: number; note: string | null; createdAt: string; config: unknown };

export default function HistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { message, modal } = App.useApp();
  const router = useRouter();
  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [versions, setVersions] = useState<Version[] | null>(null);
  const [missing, setMissing] = useState(false);
  const [diffVersion, setDiffVersion] = useState<Version | null>(null);
  const [rollingBack, setRollingBack] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [tRes, vRes] = await Promise.all([
      fetch(`/api/tenants/${id}`),
      fetch(`/api/tenants/${id}/versions`),
    ]);
    if (!tRes.ok) {
      setMissing(true);
      return;
    }
    setTenant(await tRes.json());
    setVersions(vRes.ok ? await vRes.json() : []);
  }, [id]);

  useEffect(() => {
    // load() only setState()s after an await (deferred), so it does not cause the
    // synchronous cascading render this rule guards against — safe mount fetch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  // Rollback copies the chosen version forward as a NEW version (the repo never mutates
  // old rows); on success the active pointer has moved, so refetch both lists.
  const rollback = (v: Version) =>
    modal.confirm({
      title: `Roll back to version ${v.versionNo}?`,
      content:
        'Creates a new version from that configuration and makes it active. Every existing version stays unchanged.',
      okText: 'Yes, roll back',
      cancelText: 'Cancel',
      onOk: async () => {
        setRollingBack(v.id);
        try {
          const res = await fetch(`/api/tenants/${id}/rollback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ versionId: v.id }),
          });
          if (res.status === 404) {
            // Tenant or version deleted out from under this page (typically a demo reset
            // in another tab). A retry can't succeed — send the user to the fresh list.
            message.error('This tenant or version no longer exists — it may have been reset. Returning to the tenant list.');
            router.push('/');
            return;
          }
          if (!res.ok) throw new Error('rollback failed');
          const { version } = await res.json();
          await load();
          message.success(`Rolled back to v${v.versionNo} — saved as version ${version.versionNo}.`);
        } catch {
          message.error('Rollback failed.');
        } finally {
          setRollingBack(null);
        }
      },
    });

  if (missing) {
    return (
      <div className="empty-state">
        <p className="empty-state__title">Tenant not found</p>
        <p className="empty-state__sub">It may have been deleted. Head back to the tenant list.</p>
        <Link href="/">
          <Button type="primary">Back to tenants</Button>
        </Link>
      </div>
    );
  }

  if (!tenant || !versions) return <p className="muted">Loading history…</p>;

  return (
    <>
      <div className="page-head">
        <div>
          <span className="pill">History</span>
          <h1 className="page-head__title">{tenant.name}</h1>
          <p className="page-head__sub">
            Every save is an immutable version. Diff any version against the current configuration, or roll back —
            rolling back creates a <em>new</em> version, so the trail is never rewritten.
          </p>
        </div>
        <div className="page-head__actions">
          <Link href={`/tenants/${id}`}>
            <Button>Edit configuration</Button>
          </Link>
          <Link href={`/tenants/${id}/preview`}>
            <Button>Preview</Button>
          </Link>
        </div>
      </div>

      <div className="version-list">
        {versions.map((v) => {
          const isCurrent = v.id === tenant.activeVersionId;
          return (
            <article className="version-row" key={v.id} data-testid="version-row">
              <div className="version-row__lead">
                <span className="version-row__no font-mono">v{v.versionNo}</span>
                {isCurrent && (
                  <span className="version-row__current" data-testid="current-badge">
                    Current
                  </span>
                )}
              </div>
              <div className="version-row__body">
                <span className="version-row__note">{v.note ?? 'configuration update'}</span>
                <span className="version-row__date muted font-mono">{new Date(v.createdAt).toLocaleString()}</span>
              </div>
              <div className="version-row__actions">
                <Button size="small" onClick={() => setDiffVersion(v)}>
                  Diff vs current
                </Button>
                {!isCurrent && (
                  <Button size="small" loading={rollingBack === v.id} onClick={() => rollback(v)}>
                    Roll back
                  </Button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {tenant.activeConfig && (
        <VersionDiffDrawer
          open={diffVersion !== null}
          version={diffVersion}
          current={tenant.activeConfig}
          onClose={() => setDiffVersion(null)}
        />
      )}
    </>
  );
}
