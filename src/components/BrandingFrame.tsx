'use client';

import { ConfigProvider } from 'antd';
import type { CSSProperties, ReactNode } from 'react';
import type { TenantConfig } from '@/lib/config/schema';

// Renders its children under a tenant's own branding: the tenant's logo (or name) in a
// tinted bar, with AntD controls recoloured to the tenant's primary colour via a nested
// ConfigProvider (antd themes inherit, so only the colour tokens are overridden). Shared
// by the preview page and the demo page so each insurer's claim experience reads in that
// insurer's colours — branding is exercised, not merely stored.
export function BrandingFrame({
  branding,
  children,
}: {
  branding: TenantConfig['branding'];
  children: ReactNode;
}) {
  const style = { '--brand': branding.primaryColor } as CSSProperties;

  return (
    <ConfigProvider
      theme={{ token: { colorPrimary: branding.primaryColor, colorInfo: branding.primaryColor } }}
    >
      <section className="brand-frame" style={style} data-testid="brand-frame">
        <header className="brand-frame__bar">
          {branding.logoUrl ? (
            // Tenant-supplied logo URLs point at arbitrary remote hosts — plain <img>, not next/image.
            // eslint-disable-next-line @next/next/no-img-element
            <img className="brand-frame__logo" src={branding.logoUrl} alt={`${branding.companyName} logo`} />
          ) : (
            <span className="brand-frame__name">{branding.companyName}</span>
          )}
          <span className="brand-frame__tag">Claims portal</span>
        </header>
        <div className="brand-frame__body">{children}</div>
      </section>
    </ConfigProvider>
  );
}
