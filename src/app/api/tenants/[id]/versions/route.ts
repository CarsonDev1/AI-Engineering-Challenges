import { NextResponse } from 'next/server';
import { listVersions } from '@/lib/db/tenant-repo';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return NextResponse.json(await listVersions(id));
}
