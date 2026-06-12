import type { ReactNode } from 'react';
import { issuesAt, type Issue } from './issues';

export function FieldError({
  issues,
  path,
  exact,
}: {
  issues: Issue[];
  path: (string | number)[];
  exact?: boolean;
}) {
  const matched = issuesAt(issues, path, exact);
  if (matched.length === 0) return null;
  return (
    <div className="field-error" data-testid="field-error" role="alert">
      {matched[0].message}
    </div>
  );
}

// A labelled control with its validation message underneath. `htmlFor` should match the
// control's `id` so the label is announced (and Playwright's getByLabel finds it).
export function Field({
  label,
  htmlFor,
  issues,
  path,
  children,
}: {
  label: string;
  htmlFor?: string;
  issues: Issue[];
  path: (string | number)[];
  children: ReactNode;
}) {
  return (
    <div className="field">
      <label className="field__label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      <FieldError issues={issues} path={path} />
    </div>
  );
}
