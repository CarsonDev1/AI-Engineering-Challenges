import Link from 'next/link';
import type { CSSProperties } from 'react';
import type { TenantConfig } from '@/lib/config/schema';

export type TenantSummary = {
  id: string;
  slug: string;
  name: string;
  activeConfig: TenantConfig | null;
};

// A tenant rendered in its own brand colour (the spine, the type chips), so each
// insurer's branding reads at a glance — branding is used, not just stored.
export function TenantCard({ tenant, index }: { tenant: TenantSummary; index: number }) {
  const cfg = tenant.activeConfig;
  const brand = cfg?.branding.primaryColor ?? '#6f2c32';
  const enabledTypes = cfg
    ? Object.entries(cfg.claimTypes)
        .filter(([, c]) => c?.enabled)
        .map(([t]) => t)
    : [];

  const style = { '--brand': brand, animationDelay: `${index * 60}ms` } as CSSProperties;

  return (
    <article className="tenant-card" style={style} data-testid="tenant-card">
      <div className="tenant-card__spine" />
      <div className="tenant-card__body">
        <div className="tenant-card__top">
          {cfg?.branding.logoUrl ? (
            // Tenant-supplied logo URLs are arbitrary remote hosts — plain <img>, not next/image.
            // eslint-disable-next-line @next/next/no-img-element
            <img className="tenant-card__logo" src={cfg.branding.logoUrl} alt={`${tenant.name} logo`} />
          ) : (
            <span className="tenant-card__name">{tenant.name}</span>
          )}
          <span className="tenant-card__chip">{enabledTypes.length} claim types</span>
        </div>

        <div>
          <h2 className="tenant-card__name">{tenant.name}</h2>
          <span className="tenant-card__slug">/{tenant.slug}</span>
        </div>

        <div className="tenant-card__types">
          {enabledTypes.length > 0 ? (
            enabledTypes.map((t) => (
              <span key={t} className="type-tag">
                {t}
              </span>
            ))
          ) : (
            <span className="muted" style={{ fontSize: 12 }}>
              No claim types enabled
            </span>
          )}
        </div>

        <div className="tenant-card__actions">
          <Link href={`/tenants/${tenant.id}`}>Edit</Link>
          <Link href={`/tenants/${tenant.id}/preview`}>Preview</Link>
          <Link href={`/tenants/${tenant.id}/history`}>History</Link>
        </div>
      </div>
    </article>
  );
}
