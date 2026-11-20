// FOOD06 P3-3: dados sintéticos da aba "Restrições" do prontuário. Nenhum dado real; nomes e ids inventados.
// Reaproveita o prontuário sintético do console (console-pa06) e simula o BFF já projetado (`lib/restricoes-prontuario.ts`).
import { pacienteId, prepararConsole } from './console-pa06.mjs';

export const PACIENTE = pacienteId;
export const R_PENDENTE = '11111111-1111-4111-8111-111111111111';
export const R_DECLARADA = '22222222-2222-4222-8222-222222222222';
export const R_CONFIRMADA = '33333333-3333-4333-8333-333333333333';
export const R_INATIVA = '44444444-4444-4444-8444-444444444444';
const ISO = '2026-11-10T10:00:00.000Z';
const json = (route, status, corpo) => route.fulfill({ status, contentType: 'application/json', headers: { 'cache-control': 'private, no-store' }, body: JSON.stringify(corpo) });

export const listaExemplo = () => ({ escopo: 'completo', itens: [
  { id: R_PENDENTE, revisao: 2, origem: 'colaborador', estado: 'ativa', confirmacao: 'pendente', criadoEm: ISO,
    conteudo: { natureza: 'clinica', subtipoClinico: 'alergia_alimentar', alvo: { tipo: 'nao_catalogado' }, alvoDeclarado: 'Amendoim', gravidade: 'grave',
      observacao: 'Reação relatada na infância (sintético)' } },
  { id: R_DECLARADA, revisao: 1, origem: 'declaracao_paciente', estado: 'ativa', confirmacao: 'pendente', criadoEm: ISO,
    conteudo: { natureza: 'clinica', subtipoClinico: 'outra_restricao_clinica', alvo: { tipo: 'nao_catalogado' }, alvoDeclarado: 'Leite', classificacaoPeloPaciente: 'nao_sabe' } },
  { id: R_CONFIRMADA, revisao: 3, origem: 'profissional', estado: 'ativa', confirmacao: 'confirmada', criadoEm: ISO,
    conteudo: { natureza: 'escolha', alvo: { tipo: 'nao_catalogado' }, alvoDeclarado: 'Carne vermelha' } },
  { id: R_INATIVA, revisao: 4, origem: 'profissional', estado: 'inativa', confirmacao: 'confirmada', criadoEm: ISO,
    conteudo: { natureza: 'clinica', subtipoClinico: 'intolerancia_alimentar', alvo: { tipo: 'nao_catalogado' }, alvoDeclarado: 'Lactose', gravidade: 'leve' } }
] });

/**
 * Prontuário sintético + mocks da aba. `cenario` troca respostas e papel; `pedidos` acumula caminho e corpo enviados.
 */
export async function prepararAbaRestricoes(page, cenario = {}) {
  const {
    papel = 'Professional',
    permissoes = papel === 'Professional' ? ['pacientes.ler', 'pacientes.gerenciar'] : ['pacientes.ler'],
    disponivel = true,
    lista = listaExemplo,
    avaliacao = () => ({ avaliacao: null }),
    iniciar = () => ({ id: '55555555-5555-4555-8555-555555555555', revisao: 1, situacao: 'nao_informado' }),
    registrar = () => ({ id: '66666666-6666-4666-8666-666666666666', revisao: 1, estado: 'ativa', confirmacao: 'pendente' }),
    confirmar = (corpo, id) => ({ id, revisao: corpo.revisao + 1, confirmacao: 'confirmada' }),
    rejeitar = (corpo, id) => ({ id, revisao: corpo.revisao + 1, confirmacao: 'rejeitada' })
  } = cenario;
  await prepararConsole(page);
  if (papel !== 'Professional') {
    await page.context().addCookies([{ name: 'octaclin_papel', value: papel, domain: 'localhost', path: '/' }]);
  }
  const todas = ['console.acessar', 'pacientes.listar', ...permissoes];
  await page.route((url) => url.pathname === '/api/auth/session', (route) => json(route, 200, { autenticado: true, apiUrl: 'http://localhost:3001',
    tenantSlug: 'clinica-sintetica', email: 'equipe@example.test', expiraEm: '2026-12-30T12:00:00.000Z', papel, permissoes: todas, destinoInicial: '/pacientes' }));
  await page.route((url) => url.pathname === '/api/auth/permissoes', (route) => json(route, 200, { papel, permissoes: todas }));
  await page.route((url) => url.pathname === '/api/restricoes/equipe/disponibilidade', (route) => json(route, 200, { habilitada: disponivel }));
  const pedidos = [];
  await page.route((url) => url.pathname.includes(`/pacientes/${PACIENTE}/restricoes/`), async (route) => {
    const caminho = new URL(route.request().url()).pathname;
    const corpo = route.request().postDataJSON?.() ?? null;
    pedidos.push({ caminho, corpo });
    const id = caminho.match(/restricoes\/([0-9a-f-]{36})\//)?.[1];
    const gerar = caminho.endsWith('/listar') ? lista : caminho.endsWith('/avaliacao') ? avaliacao : caminho.endsWith('/avaliacao/iniciar') ? iniciar
      : caminho.endsWith('/registrar') ? registrar : caminho.endsWith('/confirmar') ? confirmar : rejeitar;
    const r = gerar(corpo, id);
    return typeof r === 'number' ? json(route, r, { mensagem: 'CANARIO_PRIVADO' }) : json(route, 200, r);
  });
  return { pedidos };
}
