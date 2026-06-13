import Link from 'next/link';

// Global chrome in Papaya's own logo lockup: the papaya-pink rounded "P" mark + the
// product wordmark "Papaya Keystone" (Keystone is the tenant-config product within Papaya).
// Nav grows as pages land (Demo, Compare arrive with their tasks) — only built routes linked.
export function AppHeader() {
  return (
    <header className="app-header">
      <Link href="/" className="wordmark" aria-label="Papaya Keystone — home">
        <span className="wordmark__badge" aria-hidden="true">
          P
        </span>
        <span className="wordmark__name">
          Papaya<span className="wordmark__product"> Keystone</span>
        </span>
        <span className="wordmark__tag">Tenant Config</span>
      </Link>
      <nav className="app-nav" aria-label="Primary">
        <Link href="/">Tenants</Link>
      </nav>
    </header>
  );
}
