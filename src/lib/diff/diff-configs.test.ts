import { describe, it, expect } from 'vitest';
import { diffConfigs } from './diff-configs';

describe('diffConfigs', () => {
  it('reports changed leaf values', () =>
    expect(diffConfigs({ a: { b: 1 } }, { a: { b: 2 } }))
      .toEqual([{ path: 'a.b', kind: 'changed', left: 1, right: 2 }]));
  it('reports keys only in left as removed', () =>
    expect(diffConfigs({ a: 1, x: 9 }, { a: 1 }))
      .toEqual([{ path: 'x', kind: 'removed', left: 9 }]));
  it('reports keys only in right as added', () =>
    expect(diffConfigs({ a: 1 }, { a: 1, y: 5 }))
      .toEqual([{ path: 'y', kind: 'added', right: 5 }]));
  it('reports changed array-valued leaf', () =>
    expect(diffConfigs({ docs: ['x'] }, { docs: ['x', 'y'] }))
      .toEqual([{ path: 'docs', kind: 'changed', left: ['x'], right: ['x', 'y'] }]));
  it('returns [] for identical objects', () =>
    expect(diffConfigs({ a: { b: [1, 2] } }, { a: { b: [1, 2] } })).toEqual([]));
  it('treats array of objects as an atomic leaf — equal arrays produce no diff', () =>
    expect(diffConfigs(
      { approval: { tiers: [{ upTo: 100, role: 'assessor' }, { upTo: null, role: 'director' }] } },
      { approval: { tiers: [{ upTo: 100, role: 'assessor' }, { upTo: null, role: 'director' }] } }
    )).toEqual([]));
  it('treats array of objects as an atomic leaf — changed array produces one changed entry', () =>
    expect(diffConfigs(
      { approval: { tiers: [{ upTo: 100, role: 'assessor' }, { upTo: null, role: 'director' }] } },
      { approval: { tiers: [{ upTo: 200, role: 'assessor' }, { upTo: null, role: 'director' }] } }
    )).toEqual([{
      path: 'approval.tiers',
      kind: 'changed',
      left:  [{ upTo: 100, role: 'assessor' }, { upTo: null, role: 'director' }],
      right: [{ upTo: 200, role: 'assessor' }, { upTo: null, role: 'director' }],
    }]));
});
