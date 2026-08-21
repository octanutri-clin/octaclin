import { NextRequest, NextResponse } from 'next/server';
import {
  ErroPermissaoAusente,
  ErroSessaoAusente,
  exigirPermissaoBff,
  requisitarBackendAutenticado
} from '@/lib/server/sessao-bff';

const periodosValidos = new Set(['hoje', 'sete_dias', 'trinta_dias']);

function encaminhar(resposta: Response) {
  return new NextResponse(resposta.body, {
    status: resposta.status,
    headers: { 'Content-Type': resposta.headers.get('Content-Type') ?? 'application/json' }
  });
}

export async function GET(request: NextRequest) {
  try {
    const sessao = await exigirPermissaoBff('dashboard.ler');
    if (sessao.papel !== 'SuperAdmin' && sessao.papel !== 'Professional') {
      throw new ErroPermissaoAusente();
    }

    const periodoSolicitado = request.nextUrl.searchParams.get('periodo') ?? 'hoje';
    if (!periodosValidos.has(periodoSolicitado)) {
      return NextResponse.json({ mensagem: 'Período clínico invalido.' }, { status: 400 });
    }

    const parametros = new URLSearchParams({ periodo: periodoSolicitado });
    const profissionalId = request.nextUrl.searchParams.get('profissionalId');
    if (sessao.papel === 'SuperAdmin' && profissionalId) parametros.set('profissionalId', profissionalId);

    return encaminhar(await requisitarBackendAutenticado(`/dashboard/clinico?${parametros.toString()}`));
  } catch (erro) {
    if (erro instanceof ErroSessaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 401 });
    if (erro instanceof ErroPermissaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 403 });
    throw erro;
  }
}
