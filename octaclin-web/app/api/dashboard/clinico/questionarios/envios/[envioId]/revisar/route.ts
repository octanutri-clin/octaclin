import { NextResponse } from 'next/server';
import {
  ErroPermissaoAusente,
  ErroSessaoAusente,
  requisitarBackendAutenticado
} from '@/lib/server/sessao-bff';
import { exigirAcaoDashboardClinico } from '@/lib/server/dashboard-clinico-acoes-bff';

interface Params {
  params: Promise<{ envioId: string }>;
}

export async function POST(_request: Request, props: Params) {
  try {
    await exigirAcaoDashboardClinico('questionarios.gerenciar');
    const { envioId } = await props.params;
    const resposta = await requisitarBackendAutenticado(
      `/questionarios/envios/${encodeURIComponent(envioId)}/revisar`,
      { method: 'POST', headers: { 'x-octaclin-origem': 'dashboard_clinico' } }
    );
    const texto = await resposta.text();
    if (!resposta.ok) {
      return new NextResponse(texto, {
        status: resposta.status,
        headers: { 'Content-Type': resposta.headers.get('Content-Type') ?? 'application/json' }
      });
    }

    const corpo = JSON.parse(texto) as Record<string, unknown>;
    return NextResponse.json({
      id: corpo.id,
      status: corpo.status,
      ...(typeof corpo.revisadoEm === 'string' ? { revisadoEm: corpo.revisadoEm } : {}),
      ...(typeof corpo.revisadoPorUsuarioId === 'string'
        ? { revisadoPorUsuarioId: corpo.revisadoPorUsuarioId }
        : {})
    });
  } catch (erro) {
    if (erro instanceof ErroSessaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 401 });
    if (erro instanceof ErroPermissaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 403 });
    throw erro;
  }
}
