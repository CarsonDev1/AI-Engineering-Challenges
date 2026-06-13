'use client';

import { Drawer } from 'antd';
import { diffConfigs } from '@/lib/diff/diff-configs';
import type { TenantConfig } from '@/lib/config/schema';
import { DiffTable } from './DiffTable';

export type VersionForDiff = { versionNo: number; note: string | null; config: unknown };

// Shows what changed between a chosen version and the tenant's current (active) config.
// Both sides are Postgres jsonb reads, satisfying diffConfigs' equal-serialization
// precondition (never diff a freshly built literal against a DB value here).
export function VersionDiffDrawer({
  open,
  version,
  current,
  onClose,
}: {
  open: boolean;
  version: VersionForDiff | null;
  current: TenantConfig;
  onClose: () => void;
}) {
  const entries = version ? diffConfigs(version.config, current) : [];

  return (
    <Drawer
      open={open}
      onClose={onClose}
      size={680}
      title={version ? `Version ${version.versionNo} vs current` : 'Diff'}
      destroyOnHidden
    >
      {version && (
        <>
          <p className="muted" style={{ marginTop: 0 }}>
            What changed from <strong>version {version.versionNo}</strong>
            {version.note ? ` (“${version.note}”)` : ''} to the current configuration.
          </p>
          <DiffTable entries={entries} leftLabel={`v${version.versionNo}`} rightLabel="Current" />
        </>
      )}
    </Drawer>
  );
}
