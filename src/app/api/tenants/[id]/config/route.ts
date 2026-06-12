import { NextRequest, NextResponse } from 'next/server';
import { tenantConfigSchema } from '@/lib/config/schema';
import { createVersion } from '@/lib/db/tenant-repo';

// The server-side validation chokepoint: a config is parsed by the shared Zod schema
// here, so an invalid config is rejected with field-level issues even when the API is
// called directly, bypassing the UI.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = tenantConfigSchema.safeParse(body?.config);
  if (!parsed.success)
    return NextResponse.json({ error: 'Invalid config', issues: parsed.error.issues }, { status: 400 });
  try {
    const note = typeof body?.note === 'string' ? body.note : undefined;
    const version = await createVersion(id, parsed.data, note);
    return NextResponse.json({ version });
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === 'P2025' || code === 'P2003')
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    throw e;
  }
}
