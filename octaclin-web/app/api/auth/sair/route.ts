import { NextResponse } from 'next/server';
import { revogarSessaoAtual } from '@/lib/server/sessao-bff';

export async function POST() {
  await revogarSessaoAtual();
  return new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
}
