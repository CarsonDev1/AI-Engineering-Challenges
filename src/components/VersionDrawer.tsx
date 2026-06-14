'use client';

import { Drawer } from 'antd';
import { diffConfigs } from '@/lib/diff/diff-configs';
import type { TenantConfig } from '@/lib/config/schema';
import { DiffTable } from './DiffTable';
import { ConfigView } from './ConfigView';

export type VersionForDrawer = { versionNo: number; note: string | null; config: unknown };

// Two read-only ways to inspect a past version: the full config ("view") or what changed
// vs the active config ("diff"). Both the diff and the view read jsonb straight from the
// DB (the diff's equal-serialization precondition) — never against a freshly built literal.
export function VersionDrawer({
  open,
  version,
  mode,
  current,
  onClose,
}: {
  open: boolean;
  version: VersionForDrawer | null;
  mode: 'view' | 'diff';
  current: TenantConfig;
  onClose: () => void;
}) {
  const label = version ? `“${version.note ?? 'configuration update'}”` : '';

  return (
    <Drawer
      open={open}
      onClose={onClose}
      size={680}
      title={version ? (mode === 'diff' ? `Version ${version.versionNo} vs current` : `Version ${version.versionNo}`) : 'Version'}
      destroyOnHidden
    >
      {version && mode === 'diff' && (
        <>
          <p className="muted" style={{ marginTop: 0 }}>
            What changed from <strong>version {version.versionNo}</strong> {label} to the current configuration.
          </p>
          <DiffTable
            entries={diffConfigs(version.config, current)}
            leftLabel={`v${version.versionNo}`}
            rightLabel="Current"
          />
        </>
      )}
      {version && mode === 'view' && (
        <>
          <p className="muted" style={{ marginTop: 0 }}>
            The full configuration saved in <strong>version {version.versionNo}</strong> {label} — read-only.
          </p>
          <ConfigView config={version.config as TenantConfig} />
        </>
      )}
    </Drawer>
  );
}
