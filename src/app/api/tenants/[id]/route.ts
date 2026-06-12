import { NextResponse } from 'next/server';
import { getTenant, deleteTenant } from '@/lib/db/tenant-repo';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenant = await getTenant(id);
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
  return NextResponse.json(tenant);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await deleteTenant(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if ((e as { code?: string }).code === 'P2025')
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    throw e;
  }
}
