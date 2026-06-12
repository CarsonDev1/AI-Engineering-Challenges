export type DiffEntry = { path: string; kind: 'added' | 'removed' | 'changed'; left?: unknown; right?: unknown };

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Deep-diffs two tenant configs (typed as unknown so callers can diff pre-parse data).
 * Arrays are ATOMIC LEAVES — compared via JSON.stringify, never recursed into.
 * Safe because both sides always come from Postgres JSONB (consistent key
 * serialization). Do NOT pass a freshly constructed literal on one side and a DB
 * value on the other — key order of objects inside arrays could differ for equal data.
 */
export function diffConfigs(left: unknown, right: unknown, base = ''): DiffEntry[] {
  if (isPlainObject(left) && isPlainObject(right)) {
    const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])].sort();
    return keys.flatMap(k => {
      const p = base ? `${base}.${k}` : k;
      if (!(k in right)) return [{ path: p, kind: 'removed' as const, left: left[k] }];
      if (!(k in left)) return [{ path: p, kind: 'added' as const, right: right[k] }];
      return diffConfigs(left[k], right[k], p);
    });
  }
  return JSON.stringify(left) === JSON.stringify(right)
    ? [] : [{ path: base, kind: 'changed' as const, left, right }];
}
