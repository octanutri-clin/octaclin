import { NextResponse } from 'next/server';
import { ErroSessaoAusente, requisitarBackendAutenticado } from '@/lib/server/sessao-bff';
import { montarConsultaPermitida } from '../../../pacientes/[id]/planos-alimentares/_proxy';

const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store', Vary: 'Cookie' };

export async function GET(request: Request) {
  try {
    const consulta = montarConsultaPermitida(request, ['pagina', 'limite']);
    const resposta = await requisitarBackendAutenticado(`/portal/paciente/planos-alimentares${consulta}`);
    return new NextResponse(await resposta.text(), {
      status: resposta.status,
      headers: { ...headers, 'Content-Type': resposta.headers.get('Content-Type') ?? headers['Content-Type'] }
    });
  } catch (erro) {
    if (erro instanceof ErroSessaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 401, headers });
    throw erro;
  }
}
