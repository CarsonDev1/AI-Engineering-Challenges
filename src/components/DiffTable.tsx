'use client';

import type { DiffEntry } from '@/lib/diff/diff-configs';

// Canonical section order + labels — mirrors the editor tabs so a diff reads in the same
// order an admin edits. Shared by the history drawer (version vs current) and the
// tenant-vs-tenant compare page (Task 14); both feed it `diffConfigs` output.
const SECTION_LABELS: Record<string, string> = {
  branding: 'Branding',
  claimTypes: 'Claim Types & Documents',
  approval: 'Approval',
  notifications: 'Notifications',
  sla: 'SLA',
  customFields: 'Custom Fields',
};
const SECTION_ORDER = Object.keys(SECTION_LABELS);

const fmt = (v: unknown): string => {
  if (v === undefined) return '—';
  if (typeof v === 'string') return v;
  return JSON.stringify(v);
};

export function DiffTable({
  entries,
  leftLabel = 'Before',
  rightLabel = 'After',
}: {
  entries: DiffEntry[];
  leftLabel?: string;
  rightLabel?: string;
}) {
  if (entries.length === 0) {
    return (
      <p className="muted" data-testid="diff-empty">
        No differences.
      </p>
    );
  }

  // Group by top-level section, in canonical order; unknown keys (none expected for a
  // valid config) fall to the end in encounter order.
  const bySection = new Map<string, DiffEntry[]>();
  for (const e of entries) {
    const section = e.path.split('.')[0];
    const group = bySection.get(section) ?? [];
    group.push(e);
    bySection.set(section, group);
  }
  const orderedSections = [
    ...SECTION_ORDER.filter((s) => bySection.has(s)),
    ...[...bySection.keys()].filter((s) => !SECTION_ORDER.includes(s)),
  ];

  return (
    <div className="diff" data-testid="diff-table">
      <div className="diff__head">
        <span>Field</span>
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
      {orderedSections.map((section) => (
        <div className="diff__group" key={section}>
          <h4 className="diff__section">{SECTION_LABELS[section] ?? section}</h4>
          {bySection.get(section)!.map((e) => (
            <div className={`diff__row diff__row--${e.kind}`} key={e.path} data-testid="diff-row">
              <span className="diff__path font-mono">{e.path}</span>
              <span className="diff__val">{e.kind === 'added' ? <span className="muted">—</span> : fmt(e.left)}</span>
              <span className="diff__val">{e.kind === 'removed' ? <span className="muted">—</span> : fmt(e.right)}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
