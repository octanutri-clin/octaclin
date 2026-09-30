import { NextResponse } from 'next/server';
import { ErroPermissaoAusente, ErroSessaoAusente, exigirPermissaoBff, requisitarBackendAutenticado } from '@/lib/server/sessao-bff';

interface Props { params: Promise<{ id: string }> }

export async function GET(_request: Request, props: Props) {
  try {
    await exigirPermissaoBff('pacientes.ler');
    const { id } = await props.params;
    const resposta = await requisitarBackendAutenticado(`/checkins/revisoes/${encodeURIComponent(id)}`);
    return new NextResponse(await resposta.text(), { status: resposta.status, headers: {
      'Content-Type': 'application/json', 'Cache-Control': 'private, no-store'
    } });
  } catch (erro) {
    if (erro instanceof ErroSessaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 401 });
    if (erro instanceof ErroPermissaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 403 });
    throw erro;
  }
}

export async function PATCH(request: Request, props: Props) {
  try {
    await exigirPermissaoBff('pacientes.gerenciar');
    const { id } = await props.params;
    const resposta = await requisitarBackendAutenticado(`/checkins/revisoes/${encodeURIComponent(id)}`, {
      method: 'PATCH', body: await request.text()
    });
    return new NextResponse(await resposta.text(), { status: resposta.status, headers: {
      'Content-Type': 'application/json', 'Cache-Control': 'private, no-store'
    } });
  } catch (erro) {
    if (erro instanceof ErroSessaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 401 });
    if (erro instanceof ErroPermissaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 403 });
    throw erro;
  }
}
