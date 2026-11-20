// FOOD06 P3-6: dados sintéticos das telas de equipe (delegação e representantes). Nenhum dado real.
// As respostas simulam o BFF já projetado (`lib/restricoes-equipe.ts`), com canários para provar o que a tela não mostra.

export const PACIENTE = '44444444-4444-4444-8444-444444444444';
export const COLAB_A = '55555555-5555-4555-8555-555555555555';
export const COLAB_B = '66666666-6666-4666-8666-666666666666';
export const DELEGACAO = '77777777-7777-4777-8777-777777777777';
export const REP_FICHA = '88888888-8888-4888-8888-888888888888';
export const REP_MASC = '99999999-9999-4999-8999-999999999999';
export const VINCULO_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const VINCULO_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ISO = '2026-11-10T10:00:00.000Z';

const json = (route, status, corpo) => route.fulfill({ status, contentType: 'application/json', headers: { 'cache-control': 'private, no-store' }, body: JSON.stringify(corpo) });

export const delegacoesExemplo = () => ({ itens: [{ id: DELEGACAO, colaboradorUsuarioId: COLAB_A, email: 'carla.sintetica@example.test', concedidaEm: ISO }] });
export const candidatosExemplo = () => ({ itens: [
  { usuarioId: COLAB_A, email: 'carla.sintetica@example.test' },
  { usuarioId: COLAB_B, email: 'bia.sintetica@example.test' }
], noLimite: false });
export const representantesExemplo = () => ({ itens: [
  { id: VINCULO_A, representanteUsuarioId: REP_FICHA, tipoVerificacao: 'presencial', verificadoEm: ISO, identificacao: { tipo: 'nome_ficha', nome: 'Helena Sintética' } },
  { id: VINCULO_B, representanteUsuarioId: REP_MASC, tipoVerificacao: 'procuracao', verificadoEm: ISO, identificacao: { tipo: 'email_mascarado', email: 'p***@e***.test' } }
] });

/**
 * Sessão sintética do console e mocks do BFF de equipe. `cenario` troca respostas; `pedidos` acumula o que o navegador
 * mandou (caminho, método e corpo) para provar a forma exata e que o e-mail nunca vai na URL.
 */
export async function prepararEquipe(page, cenario = {}) {
  const {
    papel = 'Professional',
    disponivel = true,
    delegacoes = delegacoesExemplo,
    candidatos = candidatosExemplo,
    conceder = (corpo) => ({ id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', colaboradorUsuarioId: corpo.colaboradorUsuarioId, email: 'bia.sintetica@example.test', concedidaEm: ISO }),
    revogarDelegacao = () => ({ id: DELEGACAO, revogada: true }),
    representantes = representantesExemplo,
    buscar = () => ({ candidato: null }),
    registrar = (corpo) => ({ id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', representanteUsuarioId: corpo.representanteUsuarioId, tipoVerificacao: corpo.tipoVerificacao, verificadoEm: ISO,
      identificacao: { tipo: 'email_mascarado', email: 'n***@e***.test' } }),
    revogarRepresentante = () => ({ id: VINCULO_B, revogado: true })
  } = cenario;
  const pedidos = [];
  const permissoes = ['console.acessar', 'pacientes.listar', 'pacientes.ler', ...(papel === 'Professional' ? ['pacientes.gerenciar'] : [])];
  await page.context().addCookies([
    { name: 'octaclin_access_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_refresh_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_papel', value: papel, domain: 'localhost', path: '/' },
    { name: 'octaclin_destino_inicial', value: encodeURIComponent('/pacientes'), domain: 'localhost', path: '/' }
  ]);
  await page.route((url) => url.pathname === '/api/auth/session', (route) => json(route, 200, { autenticado: true, apiUrl: 'http://localhost:3001',
    tenantSlug: 'clinica-sintetica', email: 'profissional@example.test', expiraEm: '2026-12-30T12:00:00.000Z', papel, permissoes, destinoInicial: '/pacientes' }));
  await page.route((url) => url.pathname === '/api/auth/permissoes', (route) => json(route, 200, { papel, permissoes }));
  await page.route((url) => url.pathname === '/api/notificacoes', (route) => json(route, 200, { naoLidas: 0, itens: [], resumos: [] }));
  await page.route((url) => url.pathname === '/api/notificacoes/resumos/gerar', (route) => json(route, 200, { gerado: false }));
  await page.route((url) => url.pathname === '/api/restricoes/equipe/disponibilidade', (route) => {
    pedidos.push({ caminho: '/api/restricoes/equipe/disponibilidade', metodo: route.request().method(), corpo: null });
    return json(route, 200, { habilitada: disponivel });
  });
  const responder = async (route, gerar) => {
    const corpo = route.request().postDataJSON?.() ?? null;
    const r = gerar(corpo);
    return typeof r === 'number' ? json(route, r, { mensagem: 'CANARIO_PRIVADO' }) : json(route, 200, r);
  };
  await page.route((url) => url.pathname.startsWith('/api/profissional/delegacoes-carteira/'), async (route) => {
    const caminho = new URL(route.request().url()).pathname;
    pedidos.push({ caminho, metodo: route.request().method(), corpo: route.request().postData() });
    if (caminho.endsWith('/listar')) return responder(route, delegacoes);
    if (caminho.endsWith('/candidatos')) return responder(route, candidatos);
    if (caminho.endsWith('/conceder')) return responder(route, conceder);
    return responder(route, revogarDelegacao);
  });
  await page.route((url) => url.pathname === `/api/pacientes/${PACIENTE}`, (route) => json(route, 200, { id: PACIENTE, tenantId: 'tenant-sintetico',
    profissionalResponsavelId: 'profissional-sintetico', nome: 'Rafael Sintético' }));
  await page.route((url) => url.pathname.startsWith(`/api/pacientes/${PACIENTE}/representantes/`), async (route) => {
    const caminho = new URL(route.request().url()).pathname;
    pedidos.push({ caminho, url: route.request().url(), metodo: route.request().method(), corpo: route.request().postData() });
    if (caminho.endsWith('/listar')) return responder(route, representantes);
    if (caminho.endsWith('/buscar')) return responder(route, buscar);
    if (caminho.endsWith('/registrar')) return responder(route, registrar);
    return responder(route, revogarRepresentante);
  });
  return { pedidos };
}
