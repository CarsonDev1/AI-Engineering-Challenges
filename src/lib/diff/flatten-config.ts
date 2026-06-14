export type ConfigLeaf = { path: string; value: unknown };

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Flattens a config to dotted-path leaves for a read-only view. Mirrors diffConfigs'
 * shape rules — objects are recursed (keys sorted for stable order), arrays are atomic
 * leaves — so a version's "view" and its "diff" line up field-for-field.
 */
export function flattenConfig(value: unknown, base = ''): ConfigLeaf[] {
  if (isPlainObject(value)) {
    return Object.keys(value)
      .sort()
      .flatMap((k) => flattenConfig(value[k], base ? `${base}.${k}` : k));
  }
  return [{ path: base, value }];
}
