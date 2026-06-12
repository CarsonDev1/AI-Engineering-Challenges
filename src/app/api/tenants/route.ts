import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { tenantConfigSchema } from '@/lib/config/schema';
import { listTenants, createTenant } from '@/lib/db/tenant-repo';

export async function GET() {
  return NextResponse.json(await listTenants());
}

const createBody = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/, 'slug must be lowercase letters, numbers, or hyphens'),
  name: z.string().min(1),
  config: tenantConfigSchema,
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = createBody.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: 'Invalid tenant', issues: parsed.error.issues }, { status: 400 });
  try {
    const tenant = await createTenant(parsed.data.slug, parsed.data.name, parsed.data.config);
    return NextResponse.json(tenant, { status: 201 });
  } catch (e) {
    if ((e as { code?: string }).code === 'P2002')
      return NextResponse.json({ error: `Slug "${parsed.data.slug}" already exists` }, { status: 409 });
    throw e;
  }
}
