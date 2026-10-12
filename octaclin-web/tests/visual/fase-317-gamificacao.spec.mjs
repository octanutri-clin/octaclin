import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const patientId = '10000000-0000-4000-8000-000000000001';
const circleId = '20000000-0000-4000-8000-000000000002';
const postId = '30000000-0000-4000-8000-000000000003';

async function preparar(page, papel, permissoes) {
  const naoMockadas = [];
  await page.context().addCookies([
    { name: 'octaclin_access_token', value: 'token-sintetico', domain: 'localhost', path: '/' },
    { name: 'octaclin_refresh_token', value: 'refresh-sintetico', domain: 'localhost', path: '/' },
    { name: 'octaclin_papel', value: papel, domain: 'localhost', path: '/' }
  ]);
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    naoMockadas.push(`${route.request().method()} ${url.pathname}`);
    await route.fulfill({ status: 599, contentType: 'application/json', body: JSON.stringify({ message: 'endpoint sintetico nao mockado' }) });
  });
  await page.route('**/api/auth/session', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ autenticado: true, papel, permissoes, apiUrl: 'http://localhost:3001', tenantSlug: 'clinica-sintetica', email: 'teste@octaclin.test', destinoInicial: '/' })
  }));
  await page.route('**/api/notificacoes**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ naoLidas: 0, itens: [] }) }));
  await page.route('**/api/portal/paciente', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) }));
  return naoMockadas;
}

function pagina(itens) { return { itens, temMais: false }; }

test('Fase 317: console revisa atividade e denúncias como texto simples', async ({ page }) => {
  const naoMockadas = await preparar(page, 'Professional', ['console.acessar', 'gamificacao.gerenciar', 'pacientes.gerenciar']);
  const textoSintetico = '<script>window.xssExecutou = true</script> texto da comunidade';
  await page.route('**/api/pacientes/buscar', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ itens: [{ id: patientId, nome: 'Paciente Sintético' }], total: 1 })
  }));
  await page.route('**/api/gamificacao-piloto/console', async (route) => {
    const { acao, cursor } = route.request().postDataJSON();
    const payload = {
      'console-circulos': pagina([{ id: circleId, nome: 'Círculo Sintético', objetivo: 'Apoio entre participantes', estado: 'ativo', versao: 1 }]),
      'console-feed': cursor==='cursor-opaco-sintetico'?pagina([{id:'50000000-0000-4000-8000-000000000005',texto:'Segunda publicação sintética',autor:'Outro Nome',criadoEm:'2026-10-02T12:00:00.000Z',versao:1,proprio:false,reacoes:{total:0,curti:false}}]):{itens:[{ id: postId, texto: textoSintetico, autor: 'Nome de Exibição', criadoEm: '2026-10-01T12:00:00.000Z', versao: 1, proprio: false, reacoes: { total: 0, curti: false } }],temMais:true,proximoCursor:'cursor-opaco-sintetico'},
      'console-denuncias': pagina([{ id: '40000000-0000-4000-8000-000000000004', estado: 'aberta', versao: 1, evidencia: { texto: textoSintetico, motivo: 'Revisão sintética' } }]),
      'console-conquistas': pagina([])
    };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload[acao] ?? { id: circleId, estado: 'ativo', versao: 1 }) });
  });

  await page.goto('/gamificacao/piloto');
  await expect(page.getByRole('heading', { name: 'Conquistas e círculos' })).toBeVisible();
  await page.getByLabel('Buscar na sua carteira').fill('Paciente');
  await expect(page.getByRole('option', { name: 'Paciente Sintético' })).toHaveCount(1);
  await page.getByLabel('Círculo', { exact: true }).selectOption(circleId);
  await expect(page.getByText(textoSintetico, { exact: true })).toHaveCount(2);
  await page.getByRole('button', { name: 'Carregar mais publicações' }).click();
  await expect(page.getByText('Segunda publicação sintética')).toBeVisible();
  expect(await page.evaluate(() => window.xssExecutou)).toBeUndefined();
  expect(page.url()).not.toContain(patientId);
  expect(naoMockadas).toEqual([]);
  const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
  expect(accessibility.violations.map(({ id, impact }) => ({ id, impact }))).toEqual([]);
});

test('Fase 317: portal mostra participação sintética sem interpretar HTML', async ({ page }) => {
  const naoMockadas = await preparar(page, 'Patient', []);
  const textoSintetico = '<img src=x onerror=window.xssExecutou=true> mensagem sintética';
  await page.route('**/api/gamificacao-piloto/portal', async (route) => {
    const { acao, cursor } = route.request().postDataJSON();
    const payload = {
      'portal-conquistas': pagina([]),
      'portal-circulos': pagina([{ id: circleId, nome: 'Círculo Sintético', objetivo: 'Apoio', estado: 'ativo', participacao: 'ativo', participacaoVersao: 1, geracao: 1 }]),
      'portal-privacidade-conquistas': pagina([]),
      'portal-privacidade-circulos': pagina([]),
      'portal-feed': cursor==='cursor-opaco-sintetico'?pagina([{id:'50000000-0000-4000-8000-000000000005',texto:'Segunda mensagem sintética',autor:'Outro Nome',criadoEm:'2026-10-02T12:00:00.000Z',versao:1,proprio:false,reacoes:{total:0,curti:false}}]):{itens:[{ id: postId, texto: textoSintetico, autor: 'Participante Sintético', criadoEm: '2026-10-01T12:00:00.000Z', versao: 1, proprio: true, reacoes: { total: 0, curti: false } }],temMais:true,proximoCursor:'cursor-opaco-sintetico'},
      'portal-comentarios': pagina([])
    };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload[acao] ?? { id: postId, estado: 'ativo', versao: 1 }) });
  });

  await page.goto('/portal/gamificacao');
  await expect(page.getByRole('heading', { name: 'Conquistas e círculos' })).toBeVisible();
  await expect(page.getByText(textoSintetico, { exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.xssExecutou)).toBeUndefined();
  await expect(page.getByRole('button', { name: /Curtir/ })).toBeVisible();
  await page.getByRole('button', { name: 'Carregar mais publicações' }).click();
  await expect(page.getByText('Segunda mensagem sintética')).toBeVisible();
  expect(await page.evaluate(() => location.search)).toBe('');
  expect(naoMockadas).toEqual([]);
  const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
  expect(accessibility.violations.map(({ id, impact }) => ({ id, impact }))).toEqual([]);
});

test('Fase 317: gestor registra exceção com projeção sem evidência clínica', async ({ page }) => {
  const naoMockadas = await preparar(page, 'Client', ['console.acessar', 'cliente.configuracoes.gerenciar']);
  const denunciaId = '60000000-0000-4000-8000-000000000006';
  let holdAte = null;
  let pedido;
  await page.route('**/api/gamificacao-piloto/configuracao', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ conquistas: false, comunidade: false, versao: 0, operacaoAprovada: false }) }));
  await page.route('**/api/gamificacao-piloto/configuracao/retencao', async (route) => {
    if (route.request().method() === 'POST') {
      pedido = route.request().postDataJSON(); holdAte = pedido.holdAte;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: denunciaId, versao: 2, holdAte }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ itens: [{ id: denunciaId, versao: holdAte ? 2 : 1, eliminarEm: '2026-12-31T12:00:00.000Z', holdAte }], temMais: false }) });
  });

  await page.goto('/cliente/gamificacao-piloto');
  await expect(page.getByRole('heading', { name: 'Exceções de retenção documentadas' })).toBeVisible();
  await expect(page.getByText('evidência clínica confidencial')).toHaveCount(0);
  const registro = page.getByLabel('Registro');
  await registro.focus(); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
  await expect(registro).toHaveValue(denunciaId);
  await page.getByLabel('Manter até').fill('2026-11-01T10:00');
  const razao = page.getByLabel('Justificativa legal documentada');
  await razao.focus(); await razao.pressSequentially('Necessidade legal sintética revisada');
  const confirmacao = page.getByLabel(/Confirmo que a clínica documentou/);
  await confirmacao.focus(); await page.keyboard.press('Space'); await expect(confirmacao).toBeChecked();
  const salvar = page.getByRole('button', { name: 'Registrar exceção' });
  await salvar.focus(); await page.keyboard.press('Enter');
  await expect.poll(() => pedido?.confirmacaoLegal).toBe(true);
  expect(pedido.denunciaId).toBe(denunciaId);
  expect(pedido.versaoEsperada).toBe(1);
  expect(pedido).not.toHaveProperty('tenantId');
  await expect(page.getByText(/Hold registrado até/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(naoMockadas).toEqual([]);
  const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
  expect(accessibility.violations.map(({ id, impact }) => ({ id, impact }))).toEqual([]);
});

test('Fase 317: retirada elimina comentários e curtidas em memória e ignora resposta antiga', async ({ page }) => {
  await preparar(page,'Patient',[]);
  let retirado=false,comentarios=0,liberar;
  const commentId='70000000-0000-4000-8000-000000000007';
  const post={id:postId,texto:'Publicação sintética ativa',autor:'Nome A',versao:1,proprio:false,reacoes:{total:1,curti:false}};
  const comment={id:commentId,texto:'Comentário sintético retirado',autor:'Nome B',versao:1,proprio:true,reacoes:{total:0,curti:false}};
  await page.route('**/api/gamificacao-piloto/portal',async route=>{
    const {acao}=route.request().postDataJSON();let payload=pagina([]);
    if(acao==='portal-circulos')payload=pagina([{id:circleId,nome:'Círculo Sintético',estado:'ativo',participacao:'ativo',participacaoVersao:1,geracao:1}]);
    if(acao==='portal-feed')payload=pagina([post]);
    if(acao==='portal-comentarios'){
      comentarios++;
      if(comentarios===2)await new Promise(resolve=>{liberar=resolve;});
      payload=pagina([comment]);
    }
    if(acao==='portal-curtidas')payload=pagina([{nome:'Pessoa sintética que curtiu'}]);
    if(acao==='retirar-comentario'){retirado=true;payload={id:commentId,estado:'retirado',versao:2};}
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(payload)});
  });
  page.on('dialog',dialog=>dialog.accept());
  await page.goto('/portal/gamificacao');
  await expect(page.getByText(post.texto,{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Comentários',exact:true}).click();
  await expect(page.getByText(comment.texto,{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Quem curtiu',exact:true}).first().click();
  await expect(page.getByText(/Pessoa sintética que curtiu/)).toBeVisible();
  await page.getByRole('button',{name:'Comentários',exact:true}).click();
  await expect.poll(()=>typeof liberar).toBe('function');
  await page.getByRole('button',{name:'Retirar',exact:true}).click();
  await expect.poll(()=>retirado).toBe(true);
  await expect(page.getByText('Solicitação registrada.',{exact:false})).toBeVisible();
  const respostaAntiga=page.waitForResponse(response=>response.url().includes('/api/gamificacao-piloto/portal')&&response.request().postDataJSON().acao==='portal-comentarios');
  liberar();await (await respostaAntiga).finished();
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await expect(page.getByText(comment.texto,{exact:true})).toHaveCount(0);
  await expect(page.getByText(/Pessoa sintética que curtiu/)).toHaveCount(0);
});

test('Fase 317: moderador retira comentário e publicação sem denúncia',async({page})=>{
  await preparar(page,'Professional',['console.acessar','gamificacao.gerenciar','pacientes.gerenciar']);
  const commentId='70000000-0000-4000-8000-000000000007';let commentRemoved=false,postRemoved=false;
  const post={id:postId,texto:'Publicação sintética sem denúncia',autor:'Nome A',criadoEm:'2026-01-01T12:00:00Z',versao:1,reacoes:{total:0,curti:false}};
  await page.route('**/api/pacientes/buscar',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({itens:[],total:0})}));
  await page.route('**/api/gamificacao-piloto/console',async route=>{
    const {acao}=route.request().postDataJSON();let payload=pagina([]);
    if(acao==='console-circulos')payload=pagina([{id:circleId,nome:'Círculo Sintético',estado:'ativo',versao:1}]);
    if(acao==='console-feed')payload=pagina(postRemoved?[]:[post]);
    if(acao==='console-comentarios')payload=pagina(commentRemoved?[]:[{...post,id:commentId,texto:'Comentário sintético sem denúncia'}]);
    if(acao==='console-retirar-comentario'){commentRemoved=true;payload={id:commentId,estado:'retirado',versao:2};}
    if(acao==='console-retirar-post'){postRemoved=true;payload={id:postId,estado:'retirado',versao:2};}
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(payload)});
  });
  page.on('dialog',dialog=>dialog.accept());
  await page.goto('/gamificacao/piloto');
  await expect(page.getByText(post.texto,{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Ver comentários',exact:true}).click();
  await expect(page.getByText('Comentário sintético sem denúncia',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Retirar comentário',exact:true}).click();
  await expect.poll(()=>commentRemoved).toBe(true);
  await expect(page.getByText('Comentário sintético sem denúncia',{exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Retirar publicação',exact:true}).click();
  await expect.poll(()=>postRemoved).toBe(true);await expect(page.getByText(post.texto,{exact:true})).toHaveCount(0);
});

test('Fase 317: termo integral e novo convite exigem checkbox novo',async({page})=>{
  await preparar(page,'Patient',[]);let geracao=1,ativo=false;
  await page.route('**/api/gamificacao-piloto/portal',async route=>{
    const {acao}=route.request().postDataJSON();let payload=pagina([]);
    if(acao==='aceitar-circulo')ativo=true;
    if(acao==='sair-circulo'){geracao=2;ativo=false;}
    if(acao==='portal-circulos')payload=pagina([{id:circleId,nome:'Convite Sintético',destinatarios:{clinica:'Clínica sintética',profissional:'Profissional sintético'},estado:'ativo',participacao:ativo?'ativo':'convidado',participacaoVersao:geracao,geracao,termoVersao:'317-comunidade-v1'}]);
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(payload)});
  });
  page.on('dialog',dialog=>dialog.accept());await page.goto('/portal/gamificacao');
  await expect(page.getByText(/Clínica: Clínica sintética · Profissional responsável: Profissional sintético/)).toBeVisible();
  await expect(page.getByText(/pela necessidade legal específica registrada/)).toBeVisible();
  await expect(page.getByText(/Para retornar, precisarei de novo convite e aceite/)).toBeVisible();
  await page.getByLabel('Nome de exibição',{exact:true}).fill('Nome confirmado');
  const aceite=page.getByLabel('Li o termo proposto e quero participar deste círculo.');
  await aceite.check();await page.getByRole('button',{name:'Aceitar convite',exact:true}).click();
  const sairDoCirculo=page.locator('#conteudo-principal').getByRole('button',{name:'Sair',exact:true});
  await expect(sairDoCirculo).toBeVisible();await sairDoCirculo.click();
  await expect(aceite).not.toBeChecked();await expect(page.getByRole('button',{name:'Aceitar convite',exact:true})).toBeDisabled();
});
