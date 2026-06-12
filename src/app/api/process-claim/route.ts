import { NextRequest, NextResponse } from 'next/server';
import { processClaim } from '@/lib/engine/process-claim';
import { claimInputSchema } from '@/lib/engine/claim-input';
import { getActiveConfig } from '@/lib/db/tenant-repo';

// The single endpoint behind runtime, preview, and the demo page — they all call this,
// so preview can never drift from runtime. The claim body is shape-validated before the
// pure engine runs (malformed input → 400, never a 500 inside the engine).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.tenantId !== 'string')
    return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
  const parsed = claimInputSchema.safeParse(body.claim);
  if (!parsed.success)
    return NextResponse.json({ error: 'Invalid claim', issues: parsed.error.issues }, { status: 400 });
  const config = await getActiveConfig(body.tenantId);
  if (!config) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
  return NextResponse.json(processClaim(config, parsed.data));
}
