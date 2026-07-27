import { NextResponse } from 'next/server';
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
  params: Promise<{ pacienteId: string; tarefaId: string }>;
}

export async function PATCH(_request: Request, props: Params) {
  try {
    await exigirAcaoDashboardClinico('pacientes.gerenciar');
    const { pacienteId, tarefaId } = await props.params;
    const resposta = await requisitarBackendAutenticado(
      `/pacientes/${encodeURIComponent(pacienteId)}/tarefas-acompanhamento/${encodeURIComponent(tarefaId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status: 'concluida' }),
        headers: { 'x-octaclin-origem': 'dashboard_clinico' }
      }
    );
    return encaminharRespostaDashboardClinico(resposta);
  } catch (erro) {
    if (erro instanceof ErroSessaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 401 });
    if (erro instanceof ErroPermissaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 403 });
    throw erro;
  }
}
