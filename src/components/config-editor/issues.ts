// Zod issues from the client-side safeParse and the API's serialized 400 issues share
// this shape; paths are normalized to strings so both sources map to fields identically
// (the error-mapping contract: every schema refinement carries an explicit path).
export type Issue = { path: string[]; message: string };

export function toIssues(raw: { path: readonly PropertyKey[]; message: string }[]): Issue[] {
  return raw.map((i) => ({ path: i.path.map(String), message: i.message }));
}

// Issues at (exact) or under (prefix) a path, e.g. ['approval', 'tiers'] also matches
// ['approval', 'tiers', 0, 'role'].
export function issuesAt(issues: Issue[], path: readonly (string | number)[], exact = false): Issue[] {
  return issues.filter(
    (i) =>
      (exact ? i.path.length === path.length : i.path.length >= path.length) &&
      path.every((p, idx) => i.path[idx] === String(p)),
  );
}
