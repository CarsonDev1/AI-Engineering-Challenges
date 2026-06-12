import { NextRequest, NextResponse } from 'next/server';
import { rollbackToVersion } from '@/lib/db/tenant-repo';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body.versionId !== 'string')
    return NextResponse.json({ error: 'versionId is required' }, { status: 400 });
  try {
    const version = await rollbackToVersion(id, body.versionId);
    return NextResponse.json({ version });
  } catch (e) {
    if ((e as { code?: string }).code === 'P2025')
      return NextResponse.json({ error: 'Version not found' }, { status: 404 });
    throw e;
  }
}
