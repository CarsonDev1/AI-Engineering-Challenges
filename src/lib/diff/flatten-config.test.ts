import { describe, it, expect } from 'vitest';
import { flattenConfig } from './flatten-config';

describe('flattenConfig', () => {
  it('flattens nested objects to sorted dotted-path leaves', () => {
    expect(flattenConfig({ b: 2, a: { y: 1, x: 'k' } })).toEqual([
      { path: 'a.x', value: 'k' },
      { path: 'a.y', value: 1 },
      { path: 'b', value: 2 },
    ]);
  });
  it('treats arrays as atomic leaves (same rule as diffConfigs)', () => {
    expect(flattenConfig({ docs: ['a', 'b'] })).toEqual([{ path: 'docs', value: ['a', 'b'] }]);
  });
  it('keeps a primitive root as a single empty-path leaf', () => {
    expect(flattenConfig(5)).toEqual([{ path: '', value: 5 }]);
  });
});
