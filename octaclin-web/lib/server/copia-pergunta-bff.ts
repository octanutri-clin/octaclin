import { NextResponse } from 'next/server';
import { ErroPermissaoAusente, ErroSessaoAusente, exigirPermissaoBff, requisitarBackendAutenticado } from './sessao-bff';
import { origemMutacaoPermitida } from './seguranca-bff';
import { lerTextoLimitado } from './restricoes-bff-comum';

interface ParamsCopiaPergunta { id: string; perguntaId: string }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REVISAO = /^[a-f0-9]{64}$/;
const cabecalhos = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' };
const responder = (dados: unknown, status: number) => NextResponse.json(dados, { status, headers: cabecalhos });
const mensagens: Record<number, string> = {
  400: 'Confira os dados da solicitação.', 401: 'Sessão ausente ou expirada.',
  403: 'Operação não autorizada.', 404: 'Pergunta indisponível.',
  409: 'Não foi possível duplicar. Confira o estado atual do questionário antes de tentar novamente.',
  413: 'Solicitação acima do limite.', 429: 'Muitas tentativas. Aguarde antes de tentar novamente.',
  502: 'Não foi possível consultar o serviço de questionários.'
};
const erro = (status: number) => responder({ mensagem: mensagens[status] }, status);
const objeto = (valor: unknown): valor is Record<string, unknown> => typeof valor === 'object' && valor !== null && !Array.isArray(valor);

/** Projeção da definição salva, não uma entidade ORM nem uma nova regra de cópia. */
function projetarPrevia(valor: unknown) {
  if (!objeto(valor) || typeof valor.revisao !== 'string' || !REVISAO.test(valor.revisao) || !objeto(valor.definicao)) return null;
  const d = valor.definicao;
  if (typeof d.tipo !== 'string' || typeof d.enunciado !== 'string' || typeof d.obrigatoria !== 'boolean' ||
      typeof d.peso !== 'string' || !/^\d{1,4}(?:\.\d{1,2})?$/.test(d.peso) || d.visivelBiblioteca !== false || !Array.isArray(d.opcoes) || !objeto(d.configuracao)) return null;
  const opcoes = [];
  for (const o of d.opcoes) {
    if (!objeto(o) || typeof o.rotulo !== 'string' || typeof o.valor !== 'string' || !Number.isInteger(o.ordem)) return null;
    opcoes.push({ rotulo: o.rotulo, valor: o.valor, ordem: o.ordem,
      ...(typeof o.imagemUrl === 'string' || o.imagemUrl === null ? { imagemUrl: o.imagemUrl } : {}) });
  }
  return { revisao: valor.revisao, definicao: {
    ...(typeof d.categoriaId === 'string' ? { categoriaId: d.categoriaId } : {}),
    tipo: d.tipo, enunciado: d.enunciado, peso: d.peso, obrigatoria: d.obrigatoria,
    configuracao: d.configuracao, visivelBiblioteca: false, opcoes
  } };
}

export async function atenderCopiaPergunta(request: Request, params: ParamsCopiaPergunta, confirmar: boolean) {
  try {
    await exigirPermissaoBff('questionarios.gerenciar');
    if (confirmar && !origemMutacaoPermitida(request)) return erro(403);
    const { id, perguntaId } = params;
    if (!UUID.test(id) || !UUID.test(perguntaId)) return erro(400);
    let body: string | undefined;
    if (confirmar) {
      const raw = await lerTextoLimitado(request, 1024);
      if (raw === null) return erro(413);
      let dados: unknown;
      try { dados = JSON.parse(raw); } catch { return erro(400); }
      if (!objeto(dados) || Object.keys(dados).length !== 1 || typeof dados.revisaoEsperada !== 'string' || !REVISAO.test(dados.revisaoEsperada)) return erro(400);
      body = JSON.stringify({ revisaoEsperada: dados.revisaoEsperada });
    }
    const resposta = await requisitarBackendAutenticado(`/questionarios/${id}/perguntas/${perguntaId}/${confirmar ? 'duplicar' : 'copia'}`, {
      method: confirmar ? 'POST' : 'GET', ...(confirmar ? { body, headers: { 'Content-Type': 'application/json' } } : {})
    });
    if (!resposta.ok) return erro([400, 401, 403, 404, 409, 429].includes(resposta.status) ? resposta.status : 502);
    const raw = await lerTextoLimitado(resposta, 512 * 1024);
    if (raw === null) return erro(502);
    let valor: unknown;
    try { valor = JSON.parse(raw); } catch { return erro(502); }
    if (!confirmar) {
      const previa = projetarPrevia(valor);
      return previa ? responder(previa, 200) : erro(502);
    }
    if (!objeto(valor) || typeof valor.perguntaId !== 'string' || !UUID.test(valor.perguntaId) || !Number.isSafeInteger(valor.versaoQuestionario) || (valor.versaoQuestionario as number) < 1) return erro(502);
    return responder({ perguntaId: valor.perguntaId, versaoQuestionario: valor.versaoQuestionario }, 201);
  } catch (e) {
    if (e instanceof ErroSessaoAusente) return erro(401);
    if (e instanceof ErroPermissaoAusente) return erro(403);
    return erro(502);
  }
}
