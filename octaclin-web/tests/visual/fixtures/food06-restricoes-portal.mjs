// FOOD06 P3: dados sintéticos do portal de restrições. Nenhum dado real; nomes e ids inventados.
// As respostas simulam o BFF já projetado (`lib/restricoes-portal.ts`), com campos extras e canários
// para provar que a tela não exibe o que não deve, mesmo que chegue.

export const PROPRIA = '11111111-1111-4111-8111-111111111111';
export const MAE = '22222222-2222-4222-8222-222222222222';
export const FILHO = '33333333-3333-4333-8333-333333333333';

const portalMinimo = {
  paciente: { id: 'paciente-sintetico', nome: 'Júlia Sintética', statusAdesao: 'aderente' },
  perfil: { contato: 's@example.test', email: 's@example.test', preferenciasContato: { email: true, whatsapp: false } },
  resumo: {
    consultasProximas: 0, formulariosPendentes: 0, formulariosRespondidos: 0, mensagensRecentes: 0, tarefasPendentes: 0,
    materiaisDisponiveis: 0, checkinsRecentes: 0, notificacoesPendentes: 0, notificacoesHistorico: 0
  },
  consultasProximas: [], formulariosPendentes: [], formulariosRespondidos: [], mensagensRecentes: [],
  notificacoesPaciente: [], tarefasAcompanhamento: [], materiaisDisponiveis: [], diariosRecentes: [],
  lgpd: { versaoAtual: '2026-07', documentosLegais: [], consentimentos: [], solicitacoes: [] }
};

export const resumoComItens = {
  itens: [
    { id: '44444444-4444-4444-8444-444444444444', grupo: 'alergias', alimento: 'Amendoim', chaveSelo: 'restricoes.portal.registrada', gravidade: 'leve', observacao: 'CANARIO_PRIVADO' },
    { id: '55555555-5555-4555-8555-555555555555', grupo: 'intolerancias', alimento: 'Lactose', chaveSelo: 'restricoes.portal.anotada_pela_equipe' },
    { id: '66666666-6666-4666-8666-666666666666', grupo: 'outras', alimento: 'Trigo', chaveSelo: 'restricoes.portal.informada_por_voce' },
    { id: '77777777-7777-4777-8777-777777777777', grupo: 'escolhas', alimento: '', chaveSelo: 'restricoes.portal.registrada' }
  ],
  ultimaConfirmacaoEm: '2026-09-12T10:00:00.000Z'
};

export const pedidosExemplo = {
  itens: [
    { id: '88888888-8888-4888-8888-888888888888', tipo: 'correcao', chaveTexto: 'restricoes.solicitacao.enviada', criadoEm: '2026-11-10T10:00:00.000Z', podeCancelar: true },
    { id: '99999999-9999-4999-8999-999999999999', tipo: 'remocao', chaveTexto: 'restricoes.solicitacao.recusada', criadoEm: '2026-10-01T10:00:00.000Z', decididoEm: '2026-10-03T10:00:00.000Z', explicacao: 'Conferimos e o registro continua correto.', podeCancelar: false, justificativaInterna: 'CANARIO_PRIVADO' }
  ],
  maisAntigos: false
};

const json = (route, status, corpo) => route.fulfill({ status, contentType: 'application/json', headers: { 'cache-control': 'private, no-store' }, body: JSON.stringify(corpo) });

/**
 * Prepara sessão Patient, o portal mínimo e os mocks das rotas de restrições.
 * `cenario` controla as respostas; `pedidosAoBff` acumula o que o navegador enviou.
 */
export async function prepararPortalRestricoes(page, cenario = {}) {
  const {
    habilitada = true,
    pessoas = [{ pacienteId: PROPRIA, via: 'propria', nome: 'Júlia Sintética' }],
    resumo = () => resumoComItens,
    pedidos = () => pedidosExemplo,
    atrasoResumo = () => 0
  } = cenario;
  const pedidosAoBff = [];
  await page.context().addCookies([
    { name: 'octaclin_access_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_refresh_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_papel', value: 'Patient', domain: 'localhost', path: '/' },
    { name: 'octaclin_destino_inicial', value: encodeURIComponent('/portal'), domain: 'localhost', path: '/' }
  ]);
  await page.route((url) => url.pathname.startsWith('/api/portal/paciente'), async (route) => {
    const url = new URL(route.request().url());
    const caminho = url.pathname;
    if (caminho === '/api/portal/paciente') return json(route, 200, portalMinimo);
    if (!caminho.startsWith('/api/portal/paciente/restricoes')) return json(route, 404, { mensagem: 'indisponível' });
    pedidosAoBff.push({ caminho, metodo: route.request().method(), corpo: route.request().postData() });
    if (caminho.endsWith('/disponibilidade')) return json(route, 200, { habilitada });
    if (caminho.endsWith('/restricoes/pacientes')) return json(route, 200, { itens: pessoas, noLimite: false });
    const [, id, recurso] = caminho.match(/restricoes\/([^/]+)\/(resumo|pedidos)$/) ?? [];
    if (recurso === 'resumo') {
      const atraso = atrasoResumo(id);
      if (atraso) await new Promise((r) => setTimeout(r, atraso));
      const r = resumo(id);
      return typeof r === 'number' ? json(route, r, { mensagem: 'CANARIO_PRIVADO' }) : json(route, 200, r);
    }
    if (recurso === 'pedidos') {
      const r = pedidos(id);
      return typeof r === 'number' ? json(route, r, { mensagem: 'CANARIO_PRIVADO' }) : json(route, 200, r);
    }
    return json(route, 404, { mensagem: 'indisponível' });
  });
  return { pedidosAoBff };
}
