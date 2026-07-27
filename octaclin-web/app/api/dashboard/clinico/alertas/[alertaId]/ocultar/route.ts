import { NextResponse } from 'next/server';
import {
  ErroPermissaoAusente,
  ErroSessaoAusente,
  exigirPermissaoBff,
  requisitarBackendAutenticado
} from '@/lib/server/sessao-bff';

interface Params {
  params: Promise<{ alertaId: string }>;
}

export async function POST(_request: Request, props: Params) {
  try {
    const sessao = await exigirPermissaoBff('dashboard.ler');
    if (sessao.papel !== 'SuperAdmin' && sessao.papel !== 'Professional') throw new ErroPermissaoAusente();
    const { alertaId } = await props.params;
    const resposta = await requisitarBackendAutenticado(
      `/dashboard/clinico/alertas/${encodeURIComponent(alertaId)}/ocultar`,
      { method: 'POST', headers: { 'x-octaclin-origem': 'dashboard_clinico' } }
    );
    return new NextResponse(resposta.body, {
      status: resposta.status,
      headers: { 'Content-Type': resposta.headers.get('Content-Type') ?? 'application/json' }
    });
  } catch (erro) {
    if (erro instanceof ErroSessaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 401 });
    if (erro instanceof ErroPermissaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 403 });
    throw erro;
  }
}
