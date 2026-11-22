import { NextRequest, NextResponse } from 'next/server';
import { ErroPermissaoAusente, ErroSessaoAusente, exigirPermissaoBff, requisitarBackendAutenticado } from '@/lib/server/sessao-bff';
import { origemMutacaoPermitida } from '@/lib/server/seguranca-bff';
import { lerTextoLimitado } from '@/lib/server/restricoes-bff-comum';

interface Params {
  params: Promise<{ id: string }>;
}

/** Seleção opaca: texto clínico e busca não são transportados na URL. */
export async function POST(request: NextRequest, props: Params) {
  const privados = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' };
  const falhar = (status: number) => NextResponse.json({ mensagem: status === 413
    ? 'Exportação acima do limite. Refine os filtros.'
    : 'Não foi possível exportar a seleção. Atualize as respostas e tente novamente.' }, { status, headers: privados });
  try {
    await exigirPermissaoBff('questionarios.ler');
    if (!origemMutacaoPermitida(request)) return falhar(403);
    const { id } = await props.params;
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuid.test(id)) return falhar(400);
    const texto = await lerTextoLimitado(request, 64 * 1024);
    if (texto === null) return falhar(413);
    let dados: unknown;
    try { dados = JSON.parse(texto); } catch { return falhar(400); }
    if (!dados || typeof dados !== 'object' || Array.isArray(dados) || Object.keys(dados).length !== 1 || !('respostaIds' in dados)) return falhar(400);
    const ids = dados.respostaIds;
    if (!Array.isArray(ids) || !ids.length || ids.length > 1000 || ids.some(i => typeof i !== 'string' || !uuid.test(i))) return falhar(400);
    const normalizados = ids.map(i => i.toLowerCase());
    if (new Set(normalizados).size !== normalizados.length) return falhar(400);
    const resposta = await requisitarBackendAutenticado(`/questionarios/${id}/respostas/exportar.csv`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ respostaIds: normalizados })
    });
    if (!resposta.ok) return falhar([400, 401, 403, 404, 409, 413, 429].includes(resposta.status) ? resposta.status : 502);
    if (!resposta.headers.get('Content-Type')?.toLowerCase().startsWith('text/csv')) return falhar(502);
    const csv = await lerTextoLimitado(resposta, 16 * 1024 * 1024);
    if (csv === null) return falhar(413);
    return new NextResponse(csv, { status: 200, headers: { ...privados,
      'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="octaclin-respostas-filtradas.csv"',
      'X-Content-Type-Options': 'nosniff' } });
  } catch (erro) {
    return falhar(erro instanceof ErroSessaoAusente ? 401 : erro instanceof ErroPermissaoAusente ? 403 : 502);
  }
}

export async function GET(_request: NextRequest, props: Params) {
  const params = await props.params;
  try {
    const resposta = await requisitarBackendAutenticado(`/questionarios/${params.id}/respostas/exportar.csv`);
    return new NextResponse(await resposta.text(), {
      status: resposta.status,
      headers: {
        'Content-Type': resposta.headers.get('Content-Type') ?? 'text/csv; charset=utf-8',
        'Content-Disposition':
          resposta.headers.get('Content-Disposition') ??
          'attachment; filename="octaclin-respostas-formulario.csv"'
      }
    });
  } catch (erro) {
    if (erro instanceof ErroSessaoAusente) return NextResponse.json({ mensagem: erro.message }, { status: 401 });
    throw erro;
  }
}
