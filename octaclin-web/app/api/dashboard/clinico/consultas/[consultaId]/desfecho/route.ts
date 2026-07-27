import { NextRequest, NextResponse } from 'next/server';
import {
  ErroPermissaoAusente,
  ErroSessaoAusente,
  requisitarBackendAutenticado
} from '@/lib/server/sessao-bff';
import {
  encaminharRespostaDashboardClinico,
  exigirAcaoDashboardClinico
} from '@/lib/server/dashboard-clinico-acoes-bff';

interface Params {
  params: Promise<{ consultaId: string }>;
}

export async function POST(request: NextRequest, props: Params) {
  try {
    await exigirAcaoDashboardClinico('agenda.consultas.criar');
    const { consultaId } = await props.params;
    const resposta = await requisitarBackendAutenticado(
      `/agenda/dashboard/consultas/${encodeURIComponent(consultaId)}/desfecho`,
      {
        method: 'POST',
        body: await request.text()
      }
    );
    return encaminharRespostaDashboardClinico(resposta);
  } catch (erro) {
    if (erro instanceof ErroSessaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 401 });
    if (erro instanceof ErroPermissaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 403 });
    throw erro;
  }
}
