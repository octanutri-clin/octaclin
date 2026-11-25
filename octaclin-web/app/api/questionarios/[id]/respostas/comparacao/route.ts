import { NextResponse } from 'next/server';
import { ErroPermissaoAusente, ErroSessaoAusente, exigirPermissaoBff, requisitarBackendAutenticado } from '@/lib/server/sessao-bff';
import { origemMutacaoPermitida } from '@/lib/server/seguranca-bff';
import { lerTextoLimitado } from '@/lib/server/restricoes-bff-comum';
import { UUID_QST } from '@/lib/server/questionarios-paginacao-bff';
import { corpoComparacaoQst, projetarComparacaoQst } from '@/lib/server/questionarios-comparacao-bff';
const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' };
const falhar = (status: number) => NextResponse.json({ mensagem: 'Não foi possível comparar. Confira a seleção e seu acesso, atualize a consulta e tente novamente.' }, { status, headers });

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  try {
    await exigirPermissaoBff('questionarios.ler');
    if (!origemMutacaoPermitida(request)) return falhar(403);
    const { id } = await props.params;
    if (!UUID_QST.test(id)) return falhar(400);
    const texto = await lerTextoLimitado(request, 2048);
    if (texto === null) return falhar(413);
    let dados: ReturnType<typeof corpoComparacaoQst>;
    try { dados = corpoComparacaoQst(JSON.parse(texto)); } catch { return falhar(400); }
    const resposta = await requisitarBackendAutenticado(`/questionarios/${id.toLowerCase()}/respostas/comparacao`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados),
    });
    if (!resposta.ok) return falhar([400, 401, 403, 404, 409, 413, 429].includes(resposta.status) ? resposta.status : 502);
    const resultado = await lerTextoLimitado(resposta, 8 * 1024 * 1024);
    if (resultado === null) return falhar(413);
    return NextResponse.json(projetarComparacaoQst(JSON.parse(resultado), id.toLowerCase(), dados), { headers });
  } catch (e) {
    return falhar(e instanceof ErroSessaoAusente ? 401 : e instanceof ErroPermissaoAusente ? 403 : 502);
  }
}
