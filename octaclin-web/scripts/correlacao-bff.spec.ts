import assert from 'node:assert/strict';
import test from 'node:test';
import * as nextHeaders from 'next/headers';
import { NextRequest } from 'next/server';
import { criarRequestIdBff, NOME_CABECALHO_CORRELACAO, normalizarRequestIdBff } from '../lib/server/correlacao-bff';
import { requisitarBackendAutenticado, revogarSessaoAtual } from '../lib/server/sessao-bff';
import { criarHeadersProxyPublico } from '../lib/server/agendamento-publico-bff';
import { POST as login } from '../app/api/auth/login/route';
import { POST as concluirLoginMfa } from '../app/api/auth/mfa/concluir-login/route';
import { POST as configuracaoLoginMfa } from '../app/api/auth/mfa/configuracao-login/route';
import { POST as recuperarSenha } from '../app/api/auth/recuperar-senha/route';
import { POST as validarRecuperacao } from '../app/api/auth/recuperar-senha/validar/route';
import { POST as redefinirSenha } from '../app/api/auth/redefinir-senha/route';
import { GET as obterFormulario } from '../app/api/formularios/[token]/route';
import { POST as responderFormulario } from '../app/api/formularios/[token]/respostas/route';
import { PATCH as rascunhoFormulario } from '../app/api/formularios/[token]/rascunho/route';
import { POST as anexoFormulario } from '../app/api/formularios/[token]/anexos/route';
import { POST as confirmarAnexo } from '../app/api/formularios/[token]/anexos/[arquivoId]/confirmacao/route';
import { GET as obterAgendamentoPublico } from '../app/api/agendamentos-publicos/[token]/route';
import { POST as solicitarAgendamentoPublico } from '../app/api/agendamentos-publicos/[token]/solicitacoes/route';
import { GET as obterConviteAcesso } from '../app/api/pacientes/convites-acesso/[token]/route';
import { POST as ativarConviteAcesso } from '../app/api/pacientes/convites-acesso/ativar/route';

const { __clearCookies, __setCookies, __setCabecalhos } = nextHeaders as typeof nextHeaders & {
  __clearCookies: () => void;
  __setCookies: (cookies: Record<string, string>) => void;
  __setCabecalhos: (cabecalhos: Record<string, string>) => void;
};

const PADRAO_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// Valor hostil sintetico. Nao usa quebra de linha de proposito: a pilha HTTP ja
// recusa esse caractere, e o risco real e o valor que TRANSITA - um id plausivel
// de outra investigacao seguido de conteudo escolhido por quem envia a requisicao.
const REQUEST_ID_HOSTIL = '00000000-0000-4000-8000-000000000000/../../admin?INJETADO=1';

function cookiesSessao() {
  return {
    octaclin_access_token: 'access-token-sintetico',
    octaclin_refresh_token: 'refresh-token-sintetico',
    octaclin_api_url: encodeURIComponent('http://backend.octaclin.local'),
    octaclin_tenant_slug: encodeURIComponent('clinica-sintetica'),
    octaclin_email: encodeURIComponent('profissional@octaclin.local'),
    octaclin_access_expira_em: '2030-08-22T12:00:00.000Z',
    octaclin_papel: 'Professional',
    octaclin_permissoes: encodeURIComponent(JSON.stringify([]))
  };
}

interface ChamadaBackend {
  url: string;
  headers: HeadersInit | undefined;
}

/**
 * Os pontos de saida montam cabecalho de duas formas: objeto literal nas rotas
 * que constroem o `fetch` a mao e `Headers` no proxy publico compartilhado. O
 * teste le as duas para nao provar so metade dos caminhos.
 */
function lerCorrelacao(chamada: ChamadaBackend): string {
  const cabecalhos = chamada.headers;
  if (cabecalhos instanceof Headers) return cabecalhos.get(NOME_CABECALHO_CORRELACAO) ?? '';
  return ((cabecalhos ?? {}) as Record<string, string>)[NOME_CABECALHO_CORRELACAO] ?? '';
}

function espionarFetch() {
  const chamadas: ChamadaBackend[] = [];
  const original = global.fetch;
  global.fetch = (async (entrada: RequestInfo | URL, init?: RequestInit) => {
    chamadas.push({ url: String(entrada), headers: init?.headers });
    // Corpo com forma de par de tokens: varias rotas publicas seguem processando
    // a resposta do backend, e um corpo vazio faria a rota morrer antes do ponto
    // que o teste observa.
    return new Response(
      JSON.stringify({ accessToken: 'a', refreshToken: 'r', tipoToken: 'Bearer', expiraEmSegundos: 900 }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }) as typeof global.fetch;

  const restaurar = () => {
    if (original) global.fetch = original;
    else Reflect.deleteProperty(globalThis, 'fetch');
  };

  return { chamadas, restaurar };
}

function prepararRequisicao(cabecalhos: Record<string, string>) {
  __clearCookies();
  __setCookies(cookiesSessao());
  __setCabecalhos(cabecalhos);
}

test('emite id no alfabeto e tamanho aceitos pelo backend, sem repetir valor', () => {
  const primeiro = criarRequestIdBff();
  const segundo = criarRequestIdBff();

  assert.match(primeiro, PADRAO_UUID);
  assert.notEqual(primeiro, segundo);
  // A linha abaixo REPLICA a regra do backend, nao a importa: a fonte e
  // `sanitizarRequestId` em
  // `octaclin-backend/src/infraestrutura/observabilidade/contexto-requisicao.ts:38-45`
  // (alfabeto `[a-zA-Z0-9._:/-]`, `TAMANHO_MAXIMO_REQUEST_ID` = 128). Aquela
  // funcao nao e exportada e vive fora do `rootDir` desta compilacao, entao nao
  // ha como importa-la daqui. Se o backend apertar o alfabeto ou baixar o
  // limite, ESTE teste continua verde e a correlacao quebra em producao por
  // truncamento silencioso.
  //
  // Quem reprova esse drift e o lado de la:
  // `contexto-requisicao.spec.ts` -> 'deve devolver intacto o uuid que o BFF
  // emite em x-request-id' roda a regra de verdade sobre um `randomUUID()`.
  // Aqui o que se prova e so o outro lado do contrato: o id emitido pelo BFF
  // ja e um subconjunto estrito do que o backend aceita hoje.
  assert.equal(primeiro.replace(/[^a-zA-Z0-9._:/-]/g, '').slice(0, 128), primeiro);
});

test('recusa valor externo fora do formato UUID', () => {
  for (const hostil of [REQUEST_ID_HOSTIL, 'x'.repeat(4096), '../../admin', '', ' ', null, undefined]) {
    const normalizado = normalizarRequestIdBff(hostil);
    assert.match(normalizado, PADRAO_UUID);
    assert.notEqual(normalizado, hostil);
  }
});

// Contrapartida do teste acima, e o limite honesto da funcao: ela aceita
// QUALQUER UUID v4, venha do middleware ou nao, porque um route handler nao tem
// como distinguir a origem de um cabecalho. Quem impede o cliente de escolher o
// id e o middleware; o teste do matcher, em `test-correlacao-bff.mjs`, e o que
// guarda essa parte.
test('preserva um id ja no formato do BFF, como o que o middleware fixa', () => {
  const doMiddleware = criarRequestIdBff();
  assert.equal(normalizarRequestIdBff(doMiddleware), doMiddleware);
});

test('a chamada autenticada ao backend leva o id da requisicao em curso', async () => {
  const { chamadas, restaurar } = espionarFetch();
  const requestId = criarRequestIdBff();

  try {
    prepararRequisicao({ [NOME_CABECALHO_CORRELACAO]: requestId });
    await requisitarBackendAutenticado('/pacientes');
  } finally {
    restaurar();
  }

  assert.equal(chamadas.length, 1);
  assert.equal(lerCorrelacao(chamadas[0]), requestId);
});

test('valor hostil do cliente nao chega cru ao backend', async () => {
  const { chamadas, restaurar } = espionarFetch();

  try {
    prepararRequisicao({ [NOME_CABECALHO_CORRELACAO]: REQUEST_ID_HOSTIL });
    await requisitarBackendAutenticado('/pacientes');
  } finally {
    restaurar();
  }

  const propagado = lerCorrelacao(chamadas[0]);
  assert.match(propagado, PADRAO_UUID);
  assert.notEqual(propagado, REQUEST_ID_HOSTIL);
  assert.equal(propagado.includes('INJETADO'), false);
});

test('requisicao sem id nenhum ainda sai correlacionada', async () => {
  const { chamadas, restaurar } = espionarFetch();

  try {
    prepararRequisicao({});
    await requisitarBackendAutenticado('/pacientes');
  } finally {
    restaurar();
  }

  assert.match(lerCorrelacao(chamadas[0]), PADRAO_UUID);
});

test('chamador nao consegue substituir o id pelo cabecalho do init', async () => {
  const { chamadas, restaurar } = espionarFetch();
  const requestId = criarRequestIdBff();

  try {
    prepararRequisicao({ [NOME_CABECALHO_CORRELACAO]: requestId });
    await requisitarBackendAutenticado('/pacientes', {
      headers: { [NOME_CABECALHO_CORRELACAO]: REQUEST_ID_HOSTIL }
    });
  } finally {
    restaurar();
  }

  assert.equal(lerCorrelacao(chamadas[0]), requestId);
});

// Mesmo ataque, outra grafia. Com objeto literal `X-Request-Id` e
// `x-request-id` sao duas chaves, o `fetch` as concatena com virgula e o valor
// do chamador acaba no INICIO do id gravado na trilha imutavel. Com `Headers`,
// `set` substitui qualquer grafia. Sem este caso, so a grafia minuscula ficava
// coberta e a troca para `Headers` poderia ser desfeita sem reprovar nada.
test('chamador nao consegue substituir o id usando outra caixa no nome do cabecalho', async () => {
  const { chamadas, restaurar } = espionarFetch();
  const requestId = criarRequestIdBff();

  try {
    prepararRequisicao({ [NOME_CABECALHO_CORRELACAO]: requestId });
    await requisitarBackendAutenticado('/pacientes', {
      headers: { 'X-Request-Id': REQUEST_ID_HOSTIL, 'X-REQUEST-ID': REQUEST_ID_HOSTIL }
    });
  } finally {
    restaurar();
  }

  const propagado = lerCorrelacao(chamadas[0]);
  assert.equal(propagado, requestId);
  assert.equal(propagado.includes('INJETADO'), false);
});

// O chamador tambem pode entregar uma instancia de `Headers` em vez de objeto:
// o spread de objeto a descartaria por inteiro (nao tem propriedade enumeravel
// propria), engolindo em silencio cabecalhos legitimos e escondendo o hostil.
test('cabecalho do chamador entregue como Headers e considerado, sem deslocar o id', async () => {
  const { chamadas, restaurar } = espionarFetch();
  const requestId = criarRequestIdBff();

  try {
    prepararRequisicao({ [NOME_CABECALHO_CORRELACAO]: requestId });
    await requisitarBackendAutenticado('/pacientes', {
      headers: new Headers({ 'X-Request-Id': REQUEST_ID_HOSTIL, 'X-Octaclin-Teste': 'preservado' })
    });
  } finally {
    restaurar();
  }

  const cabecalhos = chamadas[0].headers as Headers;
  assert.ok(cabecalhos instanceof Headers);
  assert.equal(cabecalhos.get(NOME_CABECALHO_CORRELACAO), requestId);
  assert.equal(cabecalhos.get('x-octaclin-teste'), 'preservado');
});

test('o logout tambem sai correlacionado', async () => {
  const { chamadas, restaurar } = espionarFetch();
  const requestId = criarRequestIdBff();

  try {
    prepararRequisicao({ [NOME_CABECALHO_CORRELACAO]: requestId });
    await revogarSessaoAtual();
  } finally {
    restaurar();
  }

  assert.equal(chamadas.length, 1);
  assert.match(chamadas[0].url, /\/auth\/sair$/);
  assert.equal(lerCorrelacao(chamadas[0]), requestId);
});

test('o id propagado nao carrega token, cookie nem dado de sessao', async () => {
  const { chamadas, restaurar } = espionarFetch();

  try {
    prepararRequisicao({});
    await requisitarBackendAutenticado('/pacientes');
  } finally {
    restaurar();
  }

  const propagado = lerCorrelacao(chamadas[0]);
  for (const segredo of Object.values(cookiesSessao())) {
    assert.equal(propagado.includes(segredo), false, `id de correlacao vazou o valor de sessao ${segredo}`);
  }
});

// ---------------------------------------------------------------------------
// Rotas publicas do BFF.
//
// Confirmado por leitura do backend nesta rodada: `/auth/login` e
// `/auth/mfa/login` sao os unicos caminhos publicos que hoje gravam em
// `user_action_logs` (`auth.login.sucesso`, `auth.login.falha`,
// `auth.mfa.validado`, `auth.mfa.habilitado`, `auth.mfa.codigo_recuperacao_usado`).
// As demais rotas entram na mesma bateria porque compartilham o mecanismo: se a
// propagacao valesse so onde hoje existe evento, o dia em que uma delas passar a
// auditar nasceria de novo sem correlacao - que e exatamente a lacuna que a
// EXC-AUD-004 descreve.
// ---------------------------------------------------------------------------

function cookiesDesafioMfa() {
  return {
    octaclin_mfa_desafio: 'desafio-mfa-sintetico',
    octaclin_mfa_email: encodeURIComponent('profissional@octaclin.local'),
    octaclin_mfa_modo: 'configurar'
  };
}

function requisicao(corpo?: string) {
  return new NextRequest('http://localhost/api/rota-publica', { method: 'POST', body: corpo ?? '{}' });
}

function parametros() {
  return { params: Promise.resolve({ token: 'token-sintetico', arquivoId: 'arquivo-sintetico' }) };
}

const ROTAS_PUBLICAS: { nome: string; invocar: () => Promise<unknown> }[] = [
  { nome: 'auth/login', invocar: () => login(requisicao(JSON.stringify({ email: 'a@b.local', senha: 'x' }))) },
  { nome: 'auth/mfa/concluir-login', invocar: () => concluirLoginMfa(requisicao(JSON.stringify({ codigo: '123456' }))) },
  { nome: 'auth/mfa/configuracao-login', invocar: () => configuracaoLoginMfa() },
  { nome: 'auth/recuperar-senha', invocar: () => recuperarSenha(requisicao(JSON.stringify({ email: 'a@b.local' }))) },
  { nome: 'auth/recuperar-senha/validar', invocar: () => validarRecuperacao(requisicao()) },
  { nome: 'auth/redefinir-senha', invocar: () => redefinirSenha(requisicao()) },
  { nome: 'formularios/[token]', invocar: () => obterFormulario(requisicao(), parametros()) },
  { nome: 'formularios/[token]/respostas', invocar: () => responderFormulario(requisicao(), parametros()) },
  { nome: 'formularios/[token]/rascunho', invocar: () => rascunhoFormulario(requisicao(), parametros()) },
  { nome: 'formularios/[token]/anexos', invocar: () => anexoFormulario(requisicao(), parametros()) },
  { nome: 'formularios/[token]/anexos/[arquivoId]/confirmacao', invocar: () => confirmarAnexo(requisicao(), parametros()) },
  { nome: 'agendamentos-publicos/[token]', invocar: () => obterAgendamentoPublico(requisicao(), parametros()) },
  { nome: 'agendamentos-publicos/[token]/solicitacoes', invocar: () => solicitarAgendamentoPublico(requisicao(), parametros()) },
  { nome: 'pacientes/convites-acesso/[token]', invocar: () => obterConviteAcesso(requisicao(), parametros()) },
  { nome: 'pacientes/convites-acesso/ativar', invocar: () => ativarConviteAcesso(requisicao()) }
];

/**
 * O que a bateria prova e o cabecalho que SAI. O que a rota faz com a resposta
 * do backend depois disso e assunto de outro teste, entao a excecao pos-fetch e
 * engolida de proposito. Engolir a chamada que nunca aconteceu, nao: a asercao
 * de que houve pelo menos um fetch e o que impede o teste de passar por
 * vacuidade se a rota mudar e parar de falar com o backend.
 */
async function saidasDaRota(
  rota: { invocar: () => Promise<unknown> },
  cabecalhosEntrada: Record<string, string>
): Promise<ChamadaBackend[]> {
  const { chamadas, restaurar } = espionarFetch();
  __clearCookies();
  __setCookies({ ...cookiesSessao(), ...cookiesDesafioMfa() });
  __setCabecalhos(cabecalhosEntrada);

  try {
    await rota.invocar();
  } catch {
    // ver comentario acima
  } finally {
    restaurar();
  }

  return chamadas;
}

for (const rota of ROTAS_PUBLICAS) {
  test(`${rota.nome}: leva ao backend o id da requisicao em curso`, async () => {
    const requestId = criarRequestIdBff();
    const chamadas = await saidasDaRota(rota, { [NOME_CABECALHO_CORRELACAO]: requestId });

    assert.ok(chamadas.length > 0, `${rota.nome} nao chamou o backend`);
    for (const chamada of chamadas) assert.equal(lerCorrelacao(chamada), requestId);
  });

  test(`${rota.nome}: valor hostil do cliente nao passa cru`, async () => {
    const chamadas = await saidasDaRota(rota, { [NOME_CABECALHO_CORRELACAO]: REQUEST_ID_HOSTIL });

    assert.ok(chamadas.length > 0, `${rota.nome} nao chamou o backend`);
    for (const chamada of chamadas) {
      const propagado = lerCorrelacao(chamada);
      assert.match(propagado, PADRAO_UUID);
      assert.notEqual(propagado, REQUEST_ID_HOSTIL);
      assert.equal(propagado.includes('INJETADO'), false);
    }
  });

  test(`${rota.nome}: requisicao sem id nenhum ainda recebe um`, async () => {
    const chamadas = await saidasDaRota(rota, {});

    assert.ok(chamadas.length > 0, `${rota.nome} nao chamou o backend`);
    for (const chamada of chamadas) assert.match(lerCorrelacao(chamada), PADRAO_UUID);
  });
}

test('o proxy publico compartilhado correlaciona e nao deixa o cliente escolher o id', async () => {
  __setCabecalhos({ [NOME_CABECALHO_CORRELACAO]: REQUEST_ID_HOSTIL });
  const comHostil = await criarHeadersProxyPublico();
  assert.match(comHostil.get(NOME_CABECALHO_CORRELACAO) ?? '', PADRAO_UUID);
  assert.notEqual(comHostil.get(NOME_CABECALHO_CORRELACAO), REQUEST_ID_HOSTIL);

  __setCabecalhos({});
  assert.match((await criarHeadersProxyPublico()).get(NOME_CABECALHO_CORRELACAO) ?? '', PADRAO_UUID);

  const requestId = criarRequestIdBff();
  __setCabecalhos({ [NOME_CABECALHO_CORRELACAO]: requestId });
  assert.equal((await criarHeadersProxyPublico()).get(NOME_CABECALHO_CORRELACAO), requestId);

  // O unico nome que o cliente controla neste proxy e o `Content-Type` copiado
  // da requisicao. A assercao abaixo prova que os dois cabecalhos coexistem -
  // nao que a ordem das chamadas protege alguma coisa: sao nomes diferentes num
  // `Headers`, e inverte-las nao mudaria o resultado. O caso em que a ordem
  // decide e o de `requisitarBackendAutenticado`, coberto pelos testes de
  // substituicao do id acima.
  const comCorpo = await criarHeadersProxyPublico(
    new Request('http://localhost', { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' } })
  );
  assert.equal(comCorpo.get(NOME_CABECALHO_CORRELACAO), requestId);
  assert.equal(comCorpo.get('Content-Type'), 'application/json');
});
