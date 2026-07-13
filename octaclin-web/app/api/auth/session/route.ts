import { NextResponse } from 'next/server';
import { obterSessaoBff } from '@/lib/server/sessao-bff';

export function GET() {
  const sessao = obterSessaoBff();
  if (!sessao) return NextResponse.json({ autenticado: false }, { status: 401, headers: { 'Cache-Control': 'no-store' } });

  return NextResponse.json({
    autenticado: true,
    apiUrl: sessao.apiUrl,
    tenantSlug: sessao.tenantSlug,
    email: sessao.email,
    expiraEm: sessao.expiraEm
  }, { headers: { 'Cache-Control': 'no-store' } });
}
