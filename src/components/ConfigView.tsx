'use client';

import { flattenConfig } from '@/lib/diff/flatten-config';
import type { TenantConfig } from '@/lib/config/schema';
import { SECTION_LABELS, orderedSections } from './config-sections';

const fmt = (v: unknown): string => (typeof v === 'string' ? v : JSON.stringify(v));

// Read-only view of a single config, grouped by section — used to "view past versions"
// (history drawer). Same section order + atomic-array rules as DiffTable, so a version's
// view and its diff line up field-for-field.
export function ConfigView({ config }: { config: TenantConfig }) {
  const leaves = flattenConfig(config);
  const bySection = new Map<string, typeof leaves>();
  for (const leaf of leaves) {
    const section = leaf.path.split('.')[0];
    const group = bySection.get(section) ?? [];
    group.push(leaf);
    bySection.set(section, group);
  }

  return (
    <div className="config-view" data-testid="config-view">
      {orderedSections(bySection.keys()).map((section) => (
        <div className="config-view__group" key={section}>
          <h4 className="config-view__section">{SECTION_LABELS[section] ?? section}</h4>
          {bySection.get(section)!.map((leaf) => (
            <div className="config-view__row" key={leaf.path}>
              <span className="config-view__path font-mono">{leaf.path}</span>
              <span className="config-view__val">{fmt(leaf.value)}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
