// Canonical config-section labels + order, shared by the diff table and the read-only
// config view so both read in the same order an admin edits (mirrors the editor tabs).
export const SECTION_LABELS: Record<string, string> = {
  branding: 'Branding',
  claimTypes: 'Claim Types & Documents',
  approval: 'Approval',
  notifications: 'Notifications',
  sla: 'SLA',
  customFields: 'Custom Fields',
};
export const SECTION_ORDER = Object.keys(SECTION_LABELS);

// Order a set of top-level section keys canonically; unknown keys fall to the end.
export function orderedSections(present: Iterable<string>): string[] {
  const set = new Set(present);
  return [
    ...SECTION_ORDER.filter((s) => set.has(s)),
    ...[...set].filter((s) => !SECTION_ORDER.includes(s)),
  ];
}
