import { GET as consultarAgendas } from '../app/api/questionarios/[id]/agendamentos/route';
import { POST as comandarAgenda } from '../app/api/questionarios/[id]/agendamentos/[agendamentoId]/comandos/route';
import { GET as consultarPagina } from '../app/api/questionarios/[id]/respostas/pagina/route';
import { POST as exportarEscopo } from '../app/api/questionarios/[id]/respostas/exportacao.csv/route';
import { GET as completudeHistorica } from '../app/api/questionarios/[id]/respostas/[respostaId]/completude/route';
import { GET as versaoEditor, POST as conferirEditor } from '../app/api/questionarios/[id]/validacao/route';
import assert from 'node:assert/strict';
import test from 'node:test';
import * as nextHeaders from 'next/headers';
import { POST as revisarEnvio } from '../app/api/questionarios/envios/[envioId]/revisar/route';
import { GET as listarPendentes } from '../app/api/questionarios/revisoes/pendentes/route';
import { GET as abrirResposta } from '../app/api/questionarios/revisoes/[envioId]/route';
import { POST as exportarFiltrados } from '../app/api/questionarios/[id]/respostas/exportar.csv/route';

const { __clearCookies, __setCookies } = nextHeaders as typeof nextHeaders & {
  __clearCookies: () => void;
  __setCookies: (cookies: Record<string, string>) => void;
};

test('CSV filtrado exige sessão, permissão, origem e seleção válida sem consultar backend', async () => {
  const fetchOriginal = global.fetch;
  let chamadas = 0;
  global.fetch = (async () => { chamadas++; throw new Error('não chamar'); }) as typeof fetch;
  const id = '00000000-0000-4000-8000-000000000001';
  const requisicao = (body: object, origem = 'http://localhost') => new Request('http://localhost/api/questionarios/exportar', {
    method: 'POST', headers: { Origin: origem, 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
  try {
    __clearCookies();
    assert.equal((await exportarFiltrados(requisicao({ respostaIds: [id] }) as never, { params: Promise.resolve({ id }) })).status, 401);
    __setCookies(cookiesSessaoValida([]));
    assert.equal((await exportarFiltrados(requisicao({ respostaIds: [id] }) as never, { params: Promise.resolve({ id }) })).status, 403);
    __setCookies(cookiesSessaoValida(['questionarios.ler']));
    assert.equal((await exportarFiltrados(requisicao({ respostaIds: [id] }, 'https://outra-origem.example.test') as never, { params: Promise.resolve({ id }) })).status, 403);
    for (const body of [{ respostaIds: [] }, { respostaIds: [id, id] }, { respostaIds: ['incorreto'] }, { respostaIds: [id], tenantId: id }]) {
      const resposta = await exportarFiltrados(requisicao(body) as never, { params: Promise.resolve({ id }) });
      assert.equal(resposta.status, 400); assert.match(resposta.headers.get('Cache-Control') ?? '', /no-store/);
    }
    assert.equal(chamadas, 0);
  } finally { restaurarFetch(fetchOriginal); __clearCookies(); }
});

test('CSV filtrado encaminha apenas IDs e retorna arquivo privado sem propagar erro clínico', async () => {
  const fetchOriginal = global.fetch;
  const id = '00000000-0000-4000-8000-000000000001';
  __setCookies(cookiesSessaoValida(['questionarios.ler']));
  let falhar = false;
  global.fetch = (async (input, init) => {
    assert.equal(new URL(String(input)).pathname, `/questionarios/${id}/respostas/exportar.csv`);
    assert.equal(new URL(String(input)).search, '');
    assert.equal(init?.method, 'POST');
    assert.deepEqual(JSON.parse(String(init?.body)), { respostaIds: [id] });
    return falhar ? new Response('CONTEUDO_INTERNO_NAO_PROPAGAR', { status: 404 })
      : new Response('id,valor\nsintetico,0\n', { headers: { 'Content-Type': 'text/csv; charset=utf-8' } });
  }) as typeof fetch;
  const requisicao = () => new Request('http://localhost/api/exportar', { method: 'POST', headers: { Origin: 'http://localhost' }, body: JSON.stringify({ respostaIds: [id] }) });
  try {
    const resposta = await exportarFiltrados(requisicao() as never, { params: Promise.resolve({ id }) });
    assert.equal(resposta.status, 200); assert.match(resposta.headers.get('Cache-Control') ?? '', /no-store/);
    assert.equal(resposta.headers.get('Vary'), 'Cookie'); assert.match(await resposta.text(), /sintetico,0/);
    falhar = true;
    const negada = await exportarFiltrados(requisicao() as never, { params: Promise.resolve({ id }) });
    assert.equal(negada.status, 404); assert.doesNotMatch(await negada.text(), /CONTEUDO_INTERNO/);
  } finally { restaurarFetch(fetchOriginal); __clearCookies(); }
});

function restaurarFetch(fetchOriginal: typeof global.fetch | undefined) {
  if (fetchOriginal) {
    global.fetch = fetchOriginal;
  } else {
    Reflect.deleteProperty(globalThis, 'fetch');
  }
}

function cookiesSessaoValida(permissoes: string[]) {
  return {
    octaclin_access_token: 'access-token-valido',
    octaclin_refresh_token: 'refresh-token-valido',
    octaclin_api_url: encodeURIComponent('http://backend.octaclin.local'),
    octaclin_tenant_slug: encodeURIComponent('clinica-carla'),
    octaclin_email: encodeURIComponent('dra.carla@octaclin.local'),
    octaclin_access_expira_em: '2030-07-27T15:00:00.000Z',
    octaclin_permissoes: encodeURIComponent(JSON.stringify(permissoes))
  };
}

test('BFF de revisao retorna 401 sem sessao e nao consulta o backend', async () => {
  __clearCookies();
  const fetchOriginal = global.fetch;
  let backendChamado = false;
  global.fetch = (async () => {
    backendChamado = true;
    throw new Error('nao deveria consultar o backend');
  }) as typeof global.fetch;

  try {
    const resposta = await revisarEnvio(new Request('http://localhost/api/revisar'), {
      params: Promise.resolve({ envioId: 'envio-1' })
    });

    assert.equal(resposta.status, 401);
    assert.deepEqual(await resposta.json(), { mensagem: 'Sessão ausente ou expirada.' });
    assert.equal(backendChamado, false);
  } finally {
    restaurarFetch(fetchOriginal);
  }
});

test('BFF de revisao retorna 403 sem permissao e nao consulta o backend', async () => {
  __setCookies(cookiesSessaoValida(['questionarios.ler']));
  const fetchOriginal = global.fetch;
  let backendChamado = false;
  global.fetch = (async () => {
    backendChamado = true;
    throw new Error('nao deveria consultar o backend');
  }) as typeof global.fetch;

  try {
    const resposta = await revisarEnvio(new Request('http://localhost/api/revisar'), {
      params: Promise.resolve({ envioId: 'envio-1' })
    });

    assert.equal(resposta.status, 403);
    assert.deepEqual(await resposta.json(), { mensagem: 'Usuário sem permissão para esta ação.' });
    assert.equal(backendChamado, false);
  } finally {
    restaurarFetch(fetchOriginal);
  }
});

test('BFF generico nao encaminha origem e remove token publico da resposta', async () => {
  __setCookies(cookiesSessaoValida(['questionarios.gerenciar']));
  const fetchOriginal = global.fetch;
  let headersBackend: Headers | undefined;

  global.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    headersBackend = new Headers(init?.headers);
    return new Response(
      JSON.stringify({
        id: 'envio-1',
        tenantId: 'tenant-1',
        pacienteId: 'paciente-1',
        status: 'respondido',
        revisadoEm: '2026-07-27T15:00:00.000Z',
        revisadoPorUsuarioId: 'usuario-1',
        tokenFormulario: 'segredo',
        linkFormulario: 'https://app.octaclin.test/formularios/segredo'
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }) as typeof global.fetch;

  try {
    const resposta = await revisarEnvio(new Request('http://localhost/api/revisar', {
      method: 'POST', headers: { 'x-octaclin-origem': 'dashboard_clinico', 'Content-Type': 'application/json' },
      body: JSON.stringify({ comprovanteLeitura: 'comprovante-sintetico' })
    }), {
      params: Promise.resolve({ envioId: 'envio-1' })
    });
    const corpo = (await resposta.json()) as Record<string, unknown>;

    assert.equal(resposta.status, 200);
    assert.equal(headersBackend?.get('x-octaclin-origem'), null);
    assert.deepEqual(corpo, {
      id: 'envio-1',
      status: 'respondido',
      revisadoEm: '2026-07-27T15:00:00.000Z',
      revisadoPorUsuarioId: 'usuario-1'
    });
    assert.equal('tokenFormulario' in corpo, false);
    assert.equal('linkFormulario' in corpo, false);
  } finally {
    restaurarFetch(fetchOriginal);
  }
});

test('BFF da fila e detalhe exigem permissao antes de consultar o backend', async () => {
  __setCookies(cookiesSessaoValida(['questionarios.ler']));
  const original = global.fetch;
  let chamadas = 0;
  global.fetch = (async () => { chamadas += 1; throw new Error('backend nao deve ser consultado'); }) as typeof global.fetch;
  try {
    const lista = await listarPendentes(new Request('http://localhost/api/questionarios/revisoes/pendentes'));
    const detalhe = await abrirResposta(new Request('http://localhost/api/questionarios/revisoes/envio-1'), { params: Promise.resolve({ envioId: 'envio-1' }) });
    assert.equal(lista.status, 403);
    assert.equal(detalhe.status, 403);
    assert.equal(chamadas, 0);
  } finally { restaurarFetch(original); }
});

test('BFF da fila e detalhe encaminham escopo mínimo sem cache', async () => {
  __setCookies(cookiesSessaoValida(['questionarios.gerenciar']));
  const original = global.fetch;
  const caminhos: string[] = [];
  global.fetch = (async (url: string | URL | Request) => {
    caminhos.push(new URL(url instanceof Request ? url.url : url.toString()).pathname + new URL(url instanceof Request ? url.url : url.toString()).search);
    return new Response(JSON.stringify({ itens: [], total: 0 }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof global.fetch;
  try {
    const lista = await listarPendentes(new Request('http://localhost/api/questionarios/revisoes/pendentes?pagina=2'));
    const detalhe = await abrirResposta(new Request('http://localhost/api/questionarios/revisoes/envio-1'), { params: Promise.resolve({ envioId: 'envio-1' }) });
    assert.deepEqual(caminhos, ['/questionarios/revisoes/pendentes?pagina=2', '/questionarios/revisoes/envio-1']);
    assert.equal(lista.headers.get('Cache-Control'), 'private, no-store');
    assert.equal(detalhe.headers.get('Cache-Control'), 'private, no-store');
  } finally { restaurarFetch(original); }
});

// P05: roteamento e sessão reais; fetch e cookies sintéticos, não prova de banco.
import { GET as prepararCopia } from '../app/api/questionarios/[id]/perguntas/[perguntaId]/copia/route';
import { POST as confirmarCopia } from '../app/api/questionarios/[id]/perguntas/[perguntaId]/duplicar/route';
const idP05 = '00000000-0000-4000-8000-000000000001';
const paramsP05 = () => ({ params: Promise.resolve({ id: idP05, perguntaId: idP05 }) });
const revisaoP05 = 'a'.repeat(64);
const requestP05 = (body: string = JSON.stringify({ revisaoEsperada: revisaoP05 }), origin = 'http://localhost') => new Request('http://localhost/api/copia', {
  method: 'POST', headers: { 'Content-Type': 'application/json', origin }, body
});
async function cenarioP05(permissoes: string[] | null, executar: (chamadas: { url: string; init?: RequestInit }[]) => Promise<void>, corpo: unknown = { perguntaId: idP05, versaoQuestionario: 3 }, status = 201) {
  if (permissoes) __setCookies(cookiesSessaoValida(permissoes)); else __clearCookies();
  const original = global.fetch, chamadas: { url: string; init?: RequestInit }[] = [];
  global.fetch = (async (input, init) => {
    chamadas.push({ url: String(input), init });
    return new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  try { await executar(chamadas); } finally { restaurarFetch(original); __clearCookies(); }
}
test('P05 exige sessão e permissão nas duas rotas antes de fetch', async () => {
  for (const [permissoes, status] of [[null, 401], [['questionarios.ler'], 403]] as const) {
    await cenarioP05(permissoes ? [...permissoes] : null, async chamadas => {
      assert.equal((await prepararCopia(new Request('http://localhost'), paramsP05())).status, status);
      assert.equal((await confirmarCopia(requestP05(), paramsP05())).status, status);
      assert.equal(chamadas.length, 0);
    });
  }
});
test('P05 rejeita origem externa, UUIDs e payload adulterados sem consultar backend', async () => {
  await cenarioP05(['questionarios.gerenciar'], async chamadas => {
    assert.equal((await confirmarCopia(requestP05(undefined, 'https://externo.invalid'), paramsP05())).status, 403);
    for (const campo of ['id', 'perguntaId']) {
      const params = { params: Promise.resolve({ id: idP05, perguntaId: idP05, [campo]: '../outro?tenantId=forjado' }) };
      assert.equal((await prepararCopia(new Request('http://localhost'), params)).status, 400);
      assert.equal((await confirmarCopia(requestP05(), params)).status, 400);
    }
    for (const raw of ['null', '[]', '{}', '{', JSON.stringify({ revisaoEsperada: revisaoP05, tenantId: idP05 }), JSON.stringify({ revisaoEsperada: 1 }), JSON.stringify({ revisaoEsperada: 'A'.repeat(64) }), JSON.stringify({ revisaoEsperada: revisaoP05 + '\n' })])
      assert.equal((await confirmarCopia(requestP05(raw), paramsP05())).status, 400);
    assert.equal((await confirmarCopia(requestP05(' '.repeat(1025)), paramsP05())).status, 413);
    assert.equal(chamadas.length, 0);
  });
});
test('P05 encaminha somente revisão, projeta ACK e não repassa headers/identidade do navegador', async () => {
  await cenarioP05(['questionarios.gerenciar'], async chamadas => {
    const r = await confirmarCopia(requestP05(), paramsP05());
    assert.equal(r.status, 201); assert.equal(r.headers.get('cache-control'), 'private, no-store');
    assert.deepEqual(await r.json(), { perguntaId: idP05, versaoQuestionario: 3 });
    assert.equal(chamadas.length, 1);
    assert.equal(chamadas[0].url, `http://backend.octaclin.local/questionarios/${idP05}/perguntas/${idP05}/duplicar`);
    assert.deepEqual(JSON.parse(String(chamadas[0].init?.body)), { revisaoEsperada: revisaoP05 });
  }, { perguntaId: idP05, versaoQuestionario: 3, token: 'sintético', tenantId: 'não retornar' });
});
test('P05 prepara cópia por allowlist sem chave clínica, IDs e vínculo de biblioteca', async () => {
  const definicao = { categoriaId: idP05, tipo: 'texto_longo', enunciado: 'Sintética', peso: '0.00', obrigatoria: false,
    configuracao: { placeholder: 'Exemplo' }, visivelBiblioteca: false,
    opcoes: [{ rotulo: 'A', valor: 'a', ordem: 1, id: idP05 }], chaveClinica: 'não retornar', tenantId: idP05 };
  await cenarioP05(['questionarios.gerenciar'], async chamadas => {
    const r = await prepararCopia(new Request('http://localhost'), paramsP05());
    assert.equal(r.status, 200); assert.equal(r.headers.get('cache-control'), 'private, no-store');
    assert.deepEqual(await r.json(), { revisao: revisaoP05, definicao: {
      categoriaId: idP05, tipo: 'texto_longo', enunciado: 'Sintética', peso: '0.00', obrigatoria: false,
      configuracao: { placeholder: 'Exemplo' }, visivelBiblioteca: false,
      opcoes: [{ rotulo: 'A', valor: 'a', ordem: 1 }]
    } });
    assert.equal(chamadas[0].init?.method, 'GET');
  }, { revisao: revisaoP05, definicao, interno: 'não retornar' }, 200);
});
test('P05 preserva status de conflito/negação sem divulgar corpo bruto nem repetir comando', async () => {
  for (const status of [400, 401, 403, 404, 409, 429, 500]) {
    await cenarioP05(['questionarios.gerenciar'], async chamadas => {
      const r = await confirmarCopia(requestP05(), paramsP05());
      assert.equal(r.status, status === 500 ? 502 : status);
      assert.equal(r.headers.get('cache-control'), 'private, no-store');
      assert.doesNotMatch(await r.text(), /conteúdo protegido/);
      // O wrapper pode renovar uma sessão em 401, mas nunca repete POST com sucesso simulado.
      assert.equal(chamadas.filter(c => c.url.endsWith('/duplicar')).length, 1);
    }, { mensagem: 'conteúdo protegido', stack: 'conteúdo protegido' }, status);
  }
});
test('P05 falha fechada para ACK inválido', async () => {
  await cenarioP05(['questionarios.gerenciar'], async () => {
    assert.equal((await confirmarCopia(requestP05(), paramsP05())).status, 502);
  }, { perguntaId: 'inválido', versaoQuestionario: 3 });
});


test('QST10-06 prévia exige sessão permissão origem limites e não projeta extras', async()=>{
  const original=global.fetch; const id='00000000-0000-4000-8000-000000000001';
  const params={params:Promise.resolve({id})};const corpo={versaoEsperada:1,titulo:'Sintético',perguntas:[]};let chamadas=0;
  const req=(body:unknown=corpo,origin='http://localhost')=>new Request('http://localhost/api/questionarios/validacao',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
  try{
    global.fetch=(async()=>{chamadas++;return new Response(JSON.stringify({versao:2,problemas:[{perguntaId:id,campo:'enunciado',codigo:'enunciado_ausente',interno:'não expor'}],interno:'não expor'}),{headers:{'Content-Type':'application/json'}});})as typeof fetch;
    __clearCookies();assert.equal((await conferirEditor(req(),params)).status,401);
    __setCookies(cookiesSessaoValida(['questionarios.ler']));assert.equal((await conferirEditor(req(),params)).status,403);
    __setCookies(cookiesSessaoValida(['questionarios.gerenciar']));assert.equal((await conferirEditor(req(corpo,'https://outra.example.test'),params)).status,403);
    for(const d of [{...corpo,tenantId:id},{...corpo,versaoEsperada:0},{...corpo,perguntas:[{id:'errado',dados:{}}]}])assert.equal((await conferirEditor(req(d),params)).status,400);
    assert.equal(chamadas,0);const r=await conferirEditor(req(),params);assert.equal(r.status,200);assert.match(r.headers.get('Cache-Control')??'',/no-store/);
    assert.deepEqual(await r.json(),{versao:2,problemas:[{perguntaId:id,campo:'enunciado',codigo:'enunciado_ausente'}]});
    assert.deepEqual(await(await versaoEditor(new Request('http://localhost'),params)).json(),{versao:2});
    global.fetch=(async()=>new Response(JSON.stringify({versao:2,problemas:[{campo:'secreto',codigo:'interno'}]}),{headers:{'Content-Type':'application/json'}}))as typeof fetch;
    assert.equal((await conferirEditor(req(),params)).status,502);
  }finally{restaurarFetch(original);__clearCookies();}
});


test('QST10-07 leitura histórica exige sessão e permissão e só projeta contagens confiáveis', async()=>{
  const original=global.fetch, id='00000000-0000-4000-8000-000000000001', respostaId='00000000-0000-4000-8000-000000000002';
  const params={params:Promise.resolve({id,respostaId})};const req=new Request('http://localhost/api/completude');let chamadas=0;
  const contagem={estado:'disponivel',versaoQuestionario:2,totalPerguntas:3,respondidas:2,obrigatorias:2,obrigatoriasRespondidas:2};
  try{
    global.fetch=(async()=>{chamadas++;return new Response(JSON.stringify({respostaId,envioId:id,completude:{...contagem,interno:'não expor'},snapshotEstrutura:{texto:'não expor'},comprovanteLeitura:'não expor'}),{headers:{'Content-Type':'application/json'}});})as typeof fetch;
    __clearCookies();assert.equal((await completudeHistorica(req,params)).status,401);
    __setCookies(cookiesSessaoValida(['dashboard.ler']));assert.equal((await completudeHistorica(req,params)).status,403);
    __setCookies(cookiesSessaoValida(['questionarios.ler']));assert.equal((await completudeHistorica(req,{params:Promise.resolve({id:'invalido',respostaId})})).status,400);assert.equal(chamadas,0);
    const resposta=await completudeHistorica(req,params);assert.equal(resposta.status,200);assert.match(resposta.headers.get('Cache-Control')??'',/no-store/);assert.deepEqual(await resposta.json(),{respostaId,completude:contagem});
    for(const c of [{...contagem,respondidas:4},{...contagem,totalPerguntas:null},
      {estado:'desconhecido',motivo:['snapshot_ausente'],versaoQuestionario:null,totalPerguntas:null,respondidas:null,obrigatorias:null,obrigatoriasRespondidas:null}]){
      global.fetch=(async()=>new Response(JSON.stringify({respostaId,completude:c}),{headers:{'Content-Type':'application/json'}}))as typeof fetch;
      assert.equal((await completudeHistorica(req,params)).status,502);
    }
    const desconhecida={estado:'desconhecido',motivo:'snapshot_ausente',versaoQuestionario:null,totalPerguntas:null,respondidas:null,obrigatorias:null,obrigatoriasRespondidas:null};
    global.fetch=(async()=>new Response(JSON.stringify({respostaId,completude:desconhecida}),{headers:{'Content-Type':'application/json'}}))as typeof fetch;
    assert.deepEqual(await(await completudeHistorica(req,params)).json(),{respostaId,completude:desconhecida});
    global.fetch=(async()=>new Response(JSON.stringify({interno:'não expor'}),{status:404}))as typeof fetch;
    const negada=await completudeHistorica(req,params);assert.equal(negada.status,404);assert.doesNotMatch(await negada.text(),/interno|não expor/);
  }finally{restaurarFetch(original);__clearCookies();}
});

test('QST10-08 página exige sessão/permissão e valida contexto antes do backend',async()=>{
 const original=global.fetch,id='00000000-0000-4000-8000-000000000001',params={params:Promise.resolve({id})};let chamadas=0;
 try{
  global.fetch=(async()=>{chamadas++;throw new Error('não consultar');})as typeof fetch;
  __clearCookies();assert.equal((await consultarPagina(new Request('http://localhost/api/pagina'),params)).status,401);
  __setCookies(cookiesSessaoValida([]));assert.equal((await consultarPagina(new Request('http://localhost/api/pagina'),params)).status,403);
  __setCookies(cookiesSessaoValida(['questionarios.ler']));
  for(const query of ['?tamanho=1000','?inicio=2026-02-30','?fim=2026-04-01&inicio=2026-04-02','?tenantId='+id,'?tamanho=25&tamanho=50','?pacienteId=invalido'])assert.equal((await consultarPagina(new Request('http://localhost/api/pagina'+query),params)).status,400);
  assert.equal(chamadas,0);
 }finally{restaurarFetch(original);__clearCookies();}
});

test('QST10-08 página projeta só fatos autorizados e rejeita inconsistências',async()=>{
 const original=global.fetch,id='00000000-0000-4000-8000-000000000001',params={params:Promise.resolve({id})};
 const dados={questionarioId:id,filtros:{tamanho:25},timezone:'America/Sao_Paulo',totalConsulta:30,proximoCursor:'opaco',resumo:{totalRespostas:1,totalPacientes:1,totalPerguntas:1,mediaRespostasPorEnvio:1},pacientes:[{pacienteId:id,totalRespostas:1,totalValoresRespondidos:1,mediaRespostasPorEnvio:1}],perguntas:[{perguntaId:id,enunciado:'Quantidade',tipo:'metrica',totalRespostas:1,mediaNumerica:0,textosRecentes:[],distribuicao:[{valor:'0',total:1}]}],respostas:[{respostaId:id,envioId:id,pacienteId:id,questionarioId:id,totalRespostas:1,respostas:[{perguntaId:id,enunciado:'Quantidade',tipo:'metrica',valor:0}]}]};
 try{
  __setCookies(cookiesSessaoValida(['questionarios.ler']));
  global.fetch=(async(input)=>{assert.equal(new URL(String(input)).pathname,`/questionarios/${id}/respostas/pagina`);return new Response(JSON.stringify({...dados,snapshotEstrutura:'não expor',comprovanteLeitura:'não expor',respostas:dados.respostas.map(r=>({...r,interno:'não expor',respostas:r.respostas.map(v=>({...v,interno:'não expor'}))}))}),{headers:{'Content-Type':'application/json'}});})as typeof fetch;
  const r=await consultarPagina(new Request('http://localhost/api/pagina'),params);assert.equal(r.status,200);assert.match(r.headers.get('Cache-Control')??'',/no-store/);assert.deepEqual(await r.json(),dados);
  for(const alteracao of [{questionarioId:'outro'},{respostas:Array(101).fill(dados.respostas[0])},{totalConsulta:-1},{proximoCursor:['errado']},{resumo:{...dados.resumo,totalRespostas:2}},{timezone:'Não existe'}]){
   global.fetch=(async()=>new Response(JSON.stringify({...dados,...alteracao}),{headers:{'Content-Type':'application/json'}}))as typeof fetch;
   assert.equal((await consultarPagina(new Request('http://localhost/api/pagina'),params)).status,502);
  }
  global.fetch=(async()=>new Response(JSON.stringify({interno:'segredo sintético'}),{status:404}))as typeof fetch;
  const negada=await consultarPagina(new Request('http://localhost/api/pagina'),params);assert.equal(negada.status,404);assert.doesNotMatch(await negada.text(),/segredo/);
 }finally{restaurarFetch(original);__clearCookies();}
});

test('QST10-08 três CSV validam alcance, origem e conteúdo privado',async()=>{
 const original=global.fetch,id='00000000-0000-4000-8000-000000000001',params={params:Promise.resolve({id})};let chamadas=0;let falhar=false;
 const req=(body:unknown,origin='http://localhost')=>new Request('http://localhost/api/exportacao',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
 try{
  global.fetch=(async(input,init)=>{chamadas++;assert.equal(new URL(String(input)).pathname,`/questionarios/${id}/respostas/exportacao.csv`);assert.ok(init?.body);return falhar ? new Response('segredo sintético',{status:400}) : new Response('respostaId\n',{headers:{'Content-Type':'text/csv'}});})as typeof fetch;
  __clearCookies();assert.equal((await exportarEscopo(req({escopo:'questionario'}),params)).status,401);
  __setCookies(cookiesSessaoValida(['questionarios.ler']));assert.equal((await exportarEscopo(req({escopo:'questionario'},'https://outra.example.test'),params)).status,403);
  for(const body of [{escopo:'visiveis'},{escopo:'consulta',respostaIds:[id]},{escopo:'questionario',filtros:{pacienteId:id}},{escopo:'visiveis',respostaIds:[id,id]},{escopo:'consulta',filtros:{timezone:'UTC'}},{escopo:'consulta',filtros:{fim:'2026-02-30'}},{escopo:'questionario',tenantId:id}])assert.equal((await exportarEscopo(req(body),params)).status,400);
  assert.equal(chamadas,0);
  for(const body of [{escopo:'visiveis',respostaIds:[id]},{escopo:'consulta',filtros:{inicio:'2026-11-01'}},{escopo:'questionario'}]){const r=await exportarEscopo(req(body),params);assert.equal(r.status,200);assert.match(r.headers.get('Cache-Control')??'',/no-store/);assert.match(r.headers.get('Content-Type')??'',/text\/csv/);}
  falhar=true;const r=await exportarEscopo(req({escopo:'questionario'}),params);assert.equal(r.status,400);assert.doesNotMatch(await r.text(),/segredo/);
 }finally{restaurarFetch(original);__clearCookies();}
});

const agendaId='00000000-0000-4000-8000-000000000003';
const questionarioAgendaId='00000000-0000-4000-8000-000000000001';
const pacienteAgendaId='00000000-0000-4000-8000-000000000002';
function agendaSintetica(){return {id:agendaId,questionarioId:questionarioAgendaId,pacienteId:pacienteAgendaId,revisao:2,ativo:false,estado:'pausado',
  proximaOcorrenciaFutura:'2026-11-25T11:00:00Z',reconfirmacaoNecessaria:true,timezone:'America/Sao_Paulo',regraCron:'0 8 * * *',dataFixa:null,pausadoEm:'2026-11-24T12:00:00Z',ultimaExecucaoEm:null,proximaExecucaoEm:'2026-11-25T11:00:00Z'};}
const parametrosAgenda=()=>({params:Promise.resolve({id:questionarioAgendaId,agendamentoId:agendaId})});
const requisicaoAgenda=(dados:unknown,origem='http://localhost')=>new Request('http://localhost/api/agenda',{
  method:'POST',headers:{Origin:origem,'Content-Type':'application/json'},body:JSON.stringify(dados)});
const comandoSintetico=()=>({pacienteId:pacienteAgendaId,acao:'pausar',revisaoEsperada:1,confirmar:true});

test('controle de agendas exige sessão/permissão/origem e rejeita campos manipulados sem backend',async()=>{
  const original=global.fetch;let chamadas=0;global.fetch=(async()=>{chamadas++;throw new Error('Não chamar');}) as typeof fetch;
  try{
    __clearCookies();assert.equal((await comandarAgenda(requisicaoAgenda(comandoSintetico()),parametrosAgenda())).status,401);
    __setCookies(cookiesSessaoValida(['questionarios.ler']));assert.equal((await comandarAgenda(requisicaoAgenda(comandoSintetico()),parametrosAgenda())).status,403);
    __setCookies(cookiesSessaoValida(['questionarios.gerenciar']));
    assert.equal((await comandarAgenda(requisicaoAgenda(comandoSintetico(),'https://outro.example.test'),parametrosAgenda())).status,403);
    for(const dados of [{...comandoSintetico(),confirmar:'true'},{...comandoSintetico(),revisaoEsperada:0},{...comandoSintetico(),tenantId:pacienteAgendaId},{...comandoSintetico(),acao:'excluir'}]){
      assert.equal((await comandarAgenda(requisicaoAgenda(dados),parametrosAgenda())).status,400);
    }
    assert.equal(chamadas,0);
  }finally{restaurarFetch(original);__clearCookies();}
});
test('agenda: projeção remove ator interno, tenant, token e metadados extras',async()=>{
  const original=global.fetch;__setCookies(cookiesSessaoValida(['questionarios.gerenciar']));
  global.fetch=(async(input,init)=>{
    assert.match(String(input),new RegExp(`/questionarios/${questionarioAgendaId}/agendamentos/${agendaId}/comandos$`));
    assert.deepEqual(JSON.parse(String(init?.body)),comandoSintetico());
    return Response.json({...agendaSintetica(),autorizadoPorUsuarioId:'NÃO EXPOR',tenantId:'INTERNO',token:'SECRETO'});
  }) as typeof fetch;
  try{
    const r=await comandarAgenda(requisicaoAgenda(comandoSintetico()),parametrosAgenda());
    assert.equal(r.status,200);assert.match(r.headers.get('Cache-Control')??'',/no-store/);
    assert.deepEqual(await r.json(),agendaSintetica());
  }finally{restaurarFetch(original);__clearCookies();}
});
test('agenda: revisão/identidade inesperadas e erro do backend não vazam conteúdo',async()=>{
  const original=global.fetch;__setCookies(cookiesSessaoValida(['questionarios.gerenciar']));
  try{
    for(const resposta of [Response.json({...agendaSintetica(),id:pacienteAgendaId}),Response.json({...agendaSintetica(),revisao:1}),new Response('DADO INTERNO',{status:409})]){
      global.fetch=(async()=>resposta) as typeof fetch;
      const r=await comandarAgenda(requisicaoAgenda(comandoSintetico()),parametrosAgenda());
      assert.equal(r.status,resposta.status===409?409:502);assert.doesNotMatch(await r.text(),/DADO INTERNO/);
    }
  }finally{restaurarFetch(original);__clearCookies();}
});
test('lista de agendas limita escopo/página e valida projeção de cada item',async()=>{
  const original=global.fetch;__setCookies(cookiesSessaoValida(['questionarios.gerenciar']));let chamadas=0;
  global.fetch=(async()=>{chamadas++;return Response.json({itens:[agendaSintetica()],pagina:1,temMais:false,interno:'não expor'});}) as typeof fetch;
  try{
    const url=`http://localhost/api/questionarios/${questionarioAgendaId}/agendamentos?pacienteId=${pacienteAgendaId}`;
    for(const extra of ['&tenantId=x','&pagina=0',`&pacienteId=${pacienteAgendaId}`])assert.equal((await consultarAgendas(new Request(url+extra),parametrosAgenda())).status,400);
    assert.equal(chamadas,0);
    const r=await consultarAgendas(new Request(url),parametrosAgenda());assert.equal(r.status,200);
    assert.deepEqual(await r.json(),{itens:[agendaSintetica()],pagina:1,temMais:false});
  }finally{restaurarFetch(original);__clearCookies();}
});
