import Link from 'next/link';

// Global chrome, in Papaya's header format: a papaya-pink rounded badge + bold wordmark.
// Nav grows as pages land (Demo, Compare arrive with their tasks) — only built routes linked.
export function AppHeader() {
  return (
    <header className="app-header">
      <Link href="/" className="wordmark" aria-label="Keystone — home">
        <span className="wordmark__badge" aria-hidden="true">
          K
        </span>
        <span className="wordmark__name">Keystone</span>
        <span className="wordmark__tag">Tenant Config</span>
      </Link>
      <nav className="app-nav" aria-label="Primary">
        <Link href="/">Tenants</Link>
      </nav>
    </header>
  );
}
