import { NextResponse } from 'next/server';
import { reseedDemoTenants } from '@/lib/db/tenant-repo';

// Re-seeds only the three sample tenants; any other tenant (e.g. one onboarded through
// the UI) is left untouched, so it survives a demo reset.
export async function POST() {
  const tenants = await reseedDemoTenants();
  return NextResponse.json({ ok: true, count: tenants.length, tenants });
}
