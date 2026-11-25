import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const usuarioProfissional = {
  autenticado: true,
  apiUrl: 'http://localhost:3001',
  tenantSlug: 'clinica-carla',
  email: 'dra.carla@octaclin.local',
  expiraEm: '2026-12-31T15:00:00.000Z',
  papel: 'Professional',
  permissoes: ['dashboard.ler', 'questionarios.ler', 'questionarios.gerenciar'],
  destinoInicial: '/questionarios'
};

async function criarSessao(page) {
  await page.context().addCookies([
    { name: 'octaclin_access_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_refresh_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_papel', value: 'Professional', domain: 'localhost', path: '/' },
    { name: 'octaclin_destino_inicial', value: encodeURIComponent('/questionarios'), domain: 'localhost', path: '/' }
  ]);
}

const questionarios = [
  { id: 'q-1', tenantId: 'tenant-1', profissionalId: 'profissional-1', titulo: 'Check-in semanal', descricao: 'Adesão', status: 'rascunho', versao: 1, criadoEm: '2026-07-01T10:00:00.000Z', atualizadoEm: '2026-07-01T10:00:00.000Z' },
  { id: 'q-2', tenantId: 'tenant-1', profissionalId: 'profissional-1', titulo: 'Avaliação mensal', descricao: 'Metricas', status: 'publicado', versao: 2, criadoEm: '2026-07-02T10:00:00.000Z', atualizadoEm: '2026-07-02T10:00:00.000Z' }
];

async function mockarBff(page) {
  await page.route('**/api/auth/session', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(usuarioProfissional) }));
  await page.route('**/api/categorias-pergunta', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: 'cat-1', tenantId: 'tenant-1', nome: 'Nutricao', iconeSvg: 'utensils', corHex: '#247BA0', ordem: 1 }]) }));
  await page.route('**/api/profissionais*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ itens: [{ id: 'profissional-1', tenantId: 'tenant-1', nome: 'Dra. Carla' }], total: 1 }) }));
  await page.route('**/api/pacientes*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ itens: [{ id: 'paciente-1', tenantId: 'tenant-1', nome: 'Joana' }], total: 1 }) }));
  await page.route('**/api/questionarios/modelos', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }));
  await page.route('**/api/biblioteca-perguntas*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }));
  await page.route('**/api/questionarios?*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ itens: questionarios, total: 2 }) }));
  await page.route('**/api/questionarios/q-1/perguntas', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([
    { id: 'p-1', tenantId: 'tenant-1', questionarioId: 'q-1', categoriaId: 'cat-1', tipo: 'likert', enunciado: 'Como foi sua semana?', peso: '1', obrigatoria: true, configuracao: {}, opcoes: [], ordem: 1, visivelBiblioteca: false }
  ]) }));
  await page.route('**/api/questionarios/q-2/perguntas', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }));
  await page.route('**/api/questionarios/*/respostas/leitura-clinica*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ questionarioId: 'q-1', resumo: { totalRespostas: 0, totalPacientes: 0, totalPerguntas: 0, mediaRespostasPorEnvio: 0 }, pacientes: [], perguntas: [], respostas: [] }) }));
}

test.describe('Editor de questionarios', () => {
  test('QPRO-07 tentar novamente relê versões sem fechar o painel e mantém foco', async ({ page }) => {
    await criarSessao(page);
    await mockarBff(page);
    let chamadas = 0, liberar;
    const liberada = new Promise(resolve => { liberar = resolve; });
    await page.route('**/api/questionarios/q-1/versoes', async route => {
      chamadas++;
      if (chamadas === 1) return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ mensagem: 'Falha sintética no histórico.' }) });
      await liberada;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([
        { versaoQuestionario: 1, titulo: 'Check-in semanal', perguntas: [], atual: true, totalEnvios: 0 }
      ]) });
    });
    await page.goto('/questionarios');
    await expect(page.getByLabel('Selecionar', { exact: true })).toHaveValue('q-1');
    await page.getByLabel('Título', { exact: true }).fill('Rascunho sintético preservado');
    const historico = page.getByRole('button', { name: 'Histórico de versões', exact: true });
    await historico.click();
    const tentar = page.getByRole('button', { name: 'Tentar novamente', exact: true });
    await expect(tentar).toBeVisible();
    await expect(page.getByText('Não foi possível carregar o histórico de versões. Tente novamente.', { exact: true })).toBeVisible();
    await expect(tentar.locator('..')).not.toContainText('Falha sintética no histórico.');
    await tentar.locator('..').screenshot({ path: test.info().outputPath('qpro07-erro.png') });
    await tentar.focus();
    await page.keyboard.press('Enter');
    await expect.poll(() => chamadas).toBe(2);
    await expect(historico).toHaveAttribute('aria-expanded', 'true');
    await expect(historico).toBeFocused();
    await expect(page.getByRole('status').filter({ hasText: 'Carregando histórico de versões...' })).toBeVisible();
    await expect(tentar).toHaveCount(0);
    liberar();
    await expect(page.getByRole('button', { name: /^Versão 1/ })).toBeVisible();
    await expect(historico).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByLabel('Selecionar', { exact: true })).toHaveValue('q-1');
    await expect(page.getByLabel('Título', { exact: true })).toHaveValue('Rascunho sintético preservado');
    await page.getByRole('button', { name: /^Versão 1/ }).locator('..').screenshot({ path: test.info().outputPath('qpro07-recuperado.png') });
    expect(chamadas).toBe(2);
  });

  test('QPRO-07 nova falha mantém histórico aberto e permite outra tentativa', async ({ page }) => {
    await criarSessao(page);
    await mockarBff(page);
    let chamadas = 0;
    await page.route('**/api/questionarios/q-1/versoes', route => {
      chamadas++;
      return route.fulfill({ status: chamadas < 3 ? 500 : 200, contentType: 'application/json',
        body: JSON.stringify(chamadas < 3 ? { mensagem: 'Falha sintética no histórico.' } : []) });
    });
    await page.goto('/questionarios');
    const historico = page.getByRole('button', { name: 'Histórico de versões', exact: true });
    await historico.click();
    await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
    await expect.poll(() => chamadas).toBe(2);
    await expect(historico).toHaveAttribute('aria-expanded', 'true');
    await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
    await expect(page.getByText('Nenhuma versão anterior registrada ainda.')).toBeVisible();
    expect(chamadas).toBe(3);
    await expect(page.getByLabel('Selecionar', { exact: true })).toHaveValue('q-1');
  });
  test('P04 amplia uma única prévia e informa larguras efetivas sem habilitar envio', async ({page})=>{
    await criarSessao(page);await mockarBff(page);await page.goto('/questionarios');
    await page.getByRole('tab',{name:'Editor',exact:true}).click();
    await page.getByRole('button',{name:'Ampliar prévia',exact:true}).click();
    const dialogo=page.getByRole('dialog',{name:'Prévia do questionário'});
    await expect(dialogo).toBeVisible();
    await expect(page.getByText('Preview do paciente',{exact:true})).toHaveCount(1);
    const area=dialogo.locator('[data-qst-p04-area]');
    await expect.poll(async()=>Math.round((await area.boundingBox()).width)).toBeGreaterThan(0);
    let largura=Math.round((await area.boundingBox()).width);
    expect(largura).toBe(Math.min(390, page.viewportSize().width - 66));
    await expect(dialogo.getByRole('status')).toHaveText(`Largura da prévia: ${largura} px`);
    await dialogo.getByRole('button',{name:'Desktop — 1024 px',exact:true}).click();
    await expect(dialogo.getByRole('button',{name:'Desktop — 1024 px',exact:true})).toHaveAttribute('aria-pressed','true');
    largura=Math.round((await area.boundingBox()).width);
    expect(largura).toBe(Math.min(1024, page.viewportSize().width - 66));
    await expect(dialogo.getByRole('status')).toHaveText(`Largura da prévia: ${largura} px`);
    expect(await area.locator('input,select,textarea,button').evaluateAll(els=>els.every(el=>el.disabled))).toBe(true);
  });

  test('P04 preserva edição pendente e foco ao fechar sem requests adicionais',async({page})=>{
    await criarSessao(page);await mockarBff(page);await page.goto('/questionarios');
    await page.getByRole('tab',{name:'Editor',exact:true}).click();
    await page.getByLabel('Enunciado',{exact:true}).fill('Pergunta sintética ainda não salva');
    const storageAntes = await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }));
    const requests=[];page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/')) requests.push(r.method());});
    const gatilho=page.getByRole('button',{name:'Ampliar prévia',exact:true});await gatilho.click();
    await expect(page.getByRole('dialog').getByText('Pergunta sintética ainda não salva',{exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Desktop — 1024 px',exact:true}).click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);await expect(gatilho).toBeFocused();
    await expect(page.getByLabel('Enunciado',{exact:true})).toHaveValue('Pergunta sintética ainda não salva');
    expect(requests).toEqual([]);
    expect(await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }))).toEqual(storageAntes);
  });

  test('P04 troca de contexto reinicia modo e não carrega título anterior',async({page})=>{
    await criarSessao(page);await mockarBff(page);await page.goto('/questionarios');
    await page.getByRole('tab',{name:'Editor',exact:true}).click();
    await page.getByRole('button',{name:'Ampliar prévia',exact:true}).click();
    await page.getByRole('button',{name:'Desktop — 1024 px',exact:true}).click();await page.keyboard.press('Escape');
    await page.getByRole('tab',{name:'Formulários',exact:true}).click();await page.getByLabel('Selecionar',{exact:true}).selectOption('q-2');
    await page.getByRole('tab',{name:'Editor',exact:true}).click();await page.getByRole('button',{name:'Ampliar prévia',exact:true}).click();
    const dialogo=page.getByRole('dialog');
    await expect(dialogo.getByRole('button',{name:'Celular — 390 px',exact:true})).toHaveAttribute('aria-pressed','true');
    await expect(dialogo.getByRole('heading',{name:'Avaliação mensal',exact:true})).toBeVisible();
    await expect(dialogo.getByRole('heading',{name:'Check-in semanal',exact:true})).toHaveCount(0);
  });

  test('P04 controles continuam acessíveis com texto ampliado',async({page})=>{
    await criarSessao(page);await mockarBff(page);await page.goto('/questionarios');
    await page.getByRole('tab',{name:'Editor',exact:true}).click();await page.getByRole('button',{name:'Ampliar prévia',exact:true}).click();
    await page.evaluate(()=>{document.documentElement.style.fontSize='200%';});
    const dialogo=page.getByRole('dialog');
    await dialogo.getByRole('button',{name:'Desktop — 1024 px',exact:true}).click();
    await dialogo.getByRole('button', { name: 'Fechar', exact: true }).focus();
    await page.keyboard.press('Shift+Tab');
    await expect(dialogo.getByRole('button', { name: 'Desktop — 1024 px', exact: true })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(dialogo.getByRole('button', { name: 'Fechar', exact: true })).toBeFocused();
    expect(await dialogo.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
    const axe=await new AxeBuilder({page}).include('[role="dialog"]').analyze();expect(axe.violations).toEqual([]);
    await dialogo.locator('[data-qst-p04-area]').getByRole('heading', { name: 'Check-in semanal', exact: true }).scrollIntoViewIfNeeded();
    await expect(dialogo.locator('[data-qst-p04-area]').getByRole('heading', { name: 'Check-in semanal', exact: true })).toBeInViewport();
    await dialogo.screenshot({path:test.info().outputPath('p04-previa.png')});
    await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'Ampliar prévia',exact:true})).toBeFocused();
  });

  test('bloqueia troca de formulario com alteracao nao salva ate confirmar', async ({ page }) => {
    await criarSessao(page);
    await mockarBff(page);
    await page.goto('/questionarios');

    await page.getByRole('tab', { name: 'Formulários' }).click();
    const titulo = page.getByLabel('Título');
    await expect(titulo).toHaveValue('Check-in semanal');
    await titulo.fill('Check-in semanal (editado)');

    await page.getByLabel('Selecionar').selectOption('q-2');
    await expect(page.getByText('Você tem alterações não salvas')).toBeVisible();
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(titulo).toHaveValue('Check-in semanal (editado)');

    await page.getByLabel('Selecionar').selectOption('q-2');
    await page.getByRole('button', { name: 'Trocar mesmo assim' }).click();
    await expect(page.getByLabel('Título')).toHaveValue('Avaliação mensal');
  });

  test('gera recorrencia semanal em linguagem comum sem expor cron', async ({ page }) => {
    let corpoAgendamento = null;
    await criarSessao(page);
    await mockarBff(page);
    await page.route('**/api/agendamentos-questionario', async (route) => {
      corpoAgendamento = route.request().postDataJSON();
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: 'agendamento-1' }) });
    });
    await page.goto('/questionarios');

    await page.getByRole('tab', { name: 'Distribuicoes' }).click();
    await expect(page.getByText('Cron', { exact: true })).toHaveCount(0);

    await page.getByLabel('Paciente do retorno de avaliação recorrente').selectOption('paciente-1');
    await page.getByRole('button', { name: 'Criar retorno de avaliação recorrente' }).click();

    await expect.poll(() => corpoAgendamento).toEqual(
      expect.objectContaining({ regraCron: '0 8 * * 1', pacienteId: 'paciente-1' })
    );
  });

  test('inicia um novo questionario pela opcao do seletor', async ({ page }) => {
    await criarSessao(page);
    await mockarBff(page);
    await page.goto('/questionarios');

    await page.getByRole('tab', { name: 'Formulários' }).click();
    await page.getByLabel('Selecionar').selectOption('');

    await expect(page.getByLabel('Título')).toHaveValue('');
    await expect(page.getByLabel('Descrição')).toHaveValue('');
    await expect(page.getByRole('button', { name: 'Criar questionário' })).toBeVisible();
  });

  test('mostra preview lado a lado com a edicao em telas largas', async ({ page }) => {
    await criarSessao(page);
    await mockarBff(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/questionarios');

    await page.getByRole('tab', { name: 'Editor' }).click();
    await expect(page.getByText('Preview do paciente')).toBeVisible();
    await expect(page.getByRole('button', { name: /Preview paciente/ })).toHaveCount(0);
  });

  test('abre o historico de versoes e expande uma versao anterior', async ({ page }) => {
    await criarSessao(page);
    await mockarBff(page);
    await page.route('**/api/questionarios/q-1/versoes', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          versaoQuestionario: 2,
          titulo: 'Check-in semanal',
          descricao: 'Adesão',
          perguntas: [{ id: 'p-1', categoriaId: 'cat-1', tipo: 'likert', enunciado: 'Como foi sua semana?', peso: '1', obrigatoria: true, configuracao: {}, ordem: 1, opcoes: [] }],
          atual: true,
          totalEnvios: 0
        },
        {
          versaoQuestionario: 1,
          titulo: 'Check-in semanal (original)',
          perguntas: [{ id: 'p-0', categoriaId: 'cat-1', tipo: 'likert', enunciado: 'Pergunta original', peso: '1', obrigatoria: true, configuracao: {}, ordem: 1, opcoes: [] }],
          atual: false,
          capturadoEm: '2026-07-05T10:00:00.000Z',
          totalEnvios: 3
        }
      ])
    }));
    await page.goto('/questionarios');

    await page.getByRole('tab', { name: 'Formulários' }).click();
    await expect(page.getByText('Pergunta original')).toHaveCount(0);

    await page.getByRole('button', { name: 'Histórico de versões' }).click();
    await expect(page.getByRole('button', { name: /Versão 2/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Versão 1/ })).toBeVisible();
    await expect(page.getByText('atual', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: /Versão 1/ }).click();
    await expect(page.getByText('Pergunta original')).toBeVisible();
    await expect(page.getByText('3 envio(s)')).toBeVisible();
  });
});

async function cenarioCopiaP05(page, falha=false) {
  await criarSessao(page);await mockarBff(page);
  const origem={id:'p-1',tenantId:'tenant-1',questionarioId:'q-1',categoriaId:'cat-1',tipo:'texto_longo',enunciado:'Pergunta salva',peso:'1.00',obrigatoria:true,configuracao:{limiteCaracteres:1000},opcoes:[],ordem:1,chaveClinica:'original',visivelBiblioteca:true};
  const itens=[origem,{...origem,id:'p-2',enunciado:'Pergunta seguinte',ordem:2}],comandos=[];
  await page.route('**/api/questionarios/q-1/perguntas',r=>r.fulfill({json:itens}));
  await page.route('**/api/questionarios/q-1/perguntas/p-1/copia',r=>r.fulfill({json:{revisao:'a'.repeat(64),definicao:{...origem,visivelBiblioteca:false}}}));
  await page.route('**/api/questionarios/q-1/perguntas/p-1/duplicar',async r=>{
    comandos.push(r.request().postDataJSON());
    if(falha)return r.fulfill({status:409,json:{mensagem:'Confira novamente.'}});
    itens.splice(1,0,{...origem,id:'p-copia',ordem:2,chaveClinica:null,visivelBiblioteca:false});itens[2].ordem=3;
    await r.fulfill({status:201,json:{perguntaId:'p-copia',versaoQuestionario:2}});
  });
  await page.goto('/questionarios');await page.getByRole('tab',{name:'Editor',exact:true}).click();
  await expect(page.getByLabel('Enunciado',{exact:true})).toHaveValue('Pergunta salva');
  return {itens,comandos};
}
test('P05 confirma cópia salva, seleciona nova identidade e foca enunciado',async({page})=>{
  const {comandos}=await cenarioCopiaP05(page);
  await page.getByRole('button',{name:'Duplicar pergunta',exact:true}).click();
  const d=page.getByRole('dialog',{name:'Duplicar pergunta salva'});
  await expect(d.getByText('Pergunta salva',{exact:true})).toBeVisible();expect(comandos).toEqual([]);
  await d.getByRole('button',{name:'Confirmar cópia',exact:true}).click();
  await expect(d).toHaveCount(0);await expect(page.getByLabel('Enunciado',{exact:true})).toBeFocused();
  await expect(page.getByLabel('Chave clínica',{exact:true})).toHaveValue('');
  await expect(page.getByRole('checkbox',{name:/Disponível na biblioteca/})).not.toBeChecked();
  expect(comandos).toEqual([{revisaoEsperada:'a'.repeat(64)}]);
});
test('P05 bloqueia pendências com explicação visível e sem POST',async({page})=>{
  const {comandos}=await cenarioCopiaP05(page);
  await page.getByLabel('Enunciado',{exact:true}).fill('Ainda não salva');
  await expect(page.getByRole('button',{name:'Duplicar pergunta',exact:true})).toBeDisabled();
  await expect(page.getByText('Salve as alterações para duplicar esta pergunta.',{exact:true})).toBeVisible();expect(comandos).toEqual([]);
});
test('P05 cancela com teclado e mantém acessibilidade com fonte ampliada',async({page})=>{
  const {comandos}=await cenarioCopiaP05(page);
  await page.getByRole('button',{name:'Duplicar pergunta',exact:true}).focus();await page.keyboard.press('Enter');
  const d=page.getByRole('dialog',{name:'Duplicar pergunta salva'});await expect(d).toBeVisible();
  await page.evaluate(()=>{document.documentElement.style.fontSize='200%';});
  expect(await d.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
  expect((await new AxeBuilder({page}).include('[role="dialog"]').analyze()).violations).toEqual([]);
  await d.screenshot({path:test.info().outputPath('p05-modal.png')});
  await page.keyboard.press('Escape');await expect(d).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Duplicar pergunta',exact:true})).toBeFocused();expect(comandos).toEqual([]);
});
test('P05 conflito preserva origem e exige conferir lista sem retry automático',async({page})=>{
  const {comandos}=await cenarioCopiaP05(page,true);
  await page.getByRole('button',{name:'Duplicar pergunta',exact:true}).click();await page.getByRole('button',{name:'Confirmar cópia',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Duplicar pergunta salva'})).toHaveCount(0);
  await expect(page.getByLabel('Enunciado',{exact:true})).toHaveValue('Pergunta salva');
  await expect(page.getByRole('button',{name:'Duplicar pergunta',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Conferir lista de perguntas',exact:true}).click();
  await expect(page.getByRole('button',{name:'Duplicar pergunta',exact:true})).toBeEnabled();expect(comandos).toHaveLength(1);
  await expect(page.getByText('Lista atualizada. Confira se a cópia já está presente antes de duplicar novamente.',{exact:true})).toBeVisible();
});

test('P05 também bloqueia alterações do formulário',async({page})=>{
  const {comandos}=await cenarioCopiaP05(page);
  await page.getByRole('tab',{name:'Formulários',exact:true}).click();await page.getByLabel('Título',{exact:true}).fill('Título pendente');
  await page.getByRole('tab',{name:'Editor',exact:true}).click();await expect(page.getByRole('button',{name:'Duplicar pergunta',exact:true})).toBeDisabled();
  expect(comandos).toEqual([]);
});

test('P05 ignora prévia tardia após troca de formulário',async({page})=>{
  const {comandos,itens}=await cenarioCopiaP05(page);
  let liberar;const espera=new Promise(r=>{liberar=r;});let iniciou=false;
  await page.route('**/api/questionarios/q-1/perguntas/p-1/copia',async r=>{iniciou=true;await espera;await r.fulfill({json:{revisao:'a'.repeat(64),definicao:{...itens[0],visivelBiblioteca:false}}});});
  await page.getByRole('button',{name:'Duplicar pergunta',exact:true}).click();await expect.poll(()=>iniciou).toBe(true);
  await page.getByRole('tab',{name:'Formulários',exact:true}).click();await page.getByLabel('Selecionar',{exact:true}).selectOption('q-2');
  const recebeu=page.waitForResponse(r=>r.url().endsWith('/copia'));liberar();await recebeu;
  await page.getByRole('tab',{name:'Editor',exact:true}).click();await expect(page.getByRole('dialog',{name:'Duplicar pergunta salva'})).toHaveCount(0);
  expect(comandos).toEqual([]);
});

test('P05 não envia duas confirmações enquanto aguarda ACK e não permite cancelamento pós-confirmação',async({page})=>{
  const {comandos,itens}=await cenarioCopiaP05(page);
  let liberar;const espera=new Promise(r=>{liberar=r;});
  await page.route('**/api/questionarios/q-1/perguntas/p-1/duplicar',async r=>{
    comandos.push(r.request().postDataJSON());await espera;
    itens.splice(1,0,{...itens[0],id:'p-copia',ordem:2,chaveClinica:null,visivelBiblioteca:false});itens[2].ordem=3;
    await r.fulfill({status:201,json:{perguntaId:'p-copia',versaoQuestionario:2}});
  });
  await page.getByRole('button',{name:'Duplicar pergunta',exact:true}).click();await page.getByRole('button',{name:'Confirmar cópia',exact:true}).click();
  await expect(page.getByRole('button',{name:'Confirmando…',exact:true})).toBeDisabled();
  await page.keyboard.press('Escape');await expect(page.getByRole('dialog',{name:'Duplicar pergunta salva'})).toBeVisible();
  expect(comandos).toHaveLength(1);liberar();
  await expect(page.getByRole('dialog',{name:'Duplicar pergunta salva'})).toHaveCount(0);expect(comandos).toHaveLength(1);
});

test('P05 falha de leitura após ACK não cria cópia local nem repete POST',async({page})=>{
  const {comandos,itens}=await cenarioCopiaP05(page);let falhou=false;
  await page.route('**/api/questionarios/q-1/perguntas',r=>{
    if(comandos.length && !falhou){falhou=true;return r.fulfill({status:500,json:{mensagem:'Falha sintética'}});}
    return r.fulfill({json:itens});
  });
  await page.getByRole('button',{name:'Duplicar pergunta',exact:true}).click();await page.getByRole('button',{name:'Confirmar cópia',exact:true}).click();
  await expect(page.getByRole('button',{name:'Conferir lista de perguntas',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Reordenar pergunta',exact:true})).toHaveCount(2);
  await page.getByLabel('Enunciado',{exact:true}).fill('Edição preservada após falha');
  await expect(page.getByRole('button',{name:'Conferir lista de perguntas',exact:true})).toBeDisabled();
  expect(comandos).toHaveLength(1);
});

test('P05 mantém a ordem adjacente e a edição da cópia não altera a origem',async({page})=>{
  await cenarioCopiaP05(page);await page.getByRole('button',{name:'Duplicar pergunta',exact:true}).click();await page.getByRole('button',{name:'Confirmar cópia',exact:true}).click();
  await expect(page.getByLabel('Enunciado',{exact:true})).toBeFocused();
  const lista=page.getByRole('list').filter({has:page.getByRole('button',{name:/Pergunta seguinte/})});
  await expect(lista.locator('li')).toHaveCount(3);
  await expect(lista.locator('li').nth(0)).toContainText('Pergunta salva');await expect(lista.locator('li').nth(1)).toContainText('Pergunta salva');await expect(lista.locator('li').nth(2)).toContainText('Pergunta seguinte');
  await page.getByLabel('Enunciado',{exact:true}).fill('Somente a cópia');
  await page.getByRole('button',{name:/Pergunta salva/}).first().click();
  await expect(page.getByLabel('Enunciado',{exact:true})).toHaveValue('Pergunta salva');await expect(page.getByLabel('Chave clínica',{exact:true})).toHaveValue('original');
});

test('P05 espera ACK de salvar pergunta antes de liberar a cópia',async({page})=>{
  const {comandos,itens}=await cenarioCopiaP05(page);let liberar;const espera=new Promise(r=>{liberar=r;});let salvamento=false;
  await page.route('**/api/questionarios/q-1/perguntas/p-1',async r=>{
    salvamento=true;await espera;Object.assign(itens[0],r.request().postDataJSON());await r.fulfill({json:itens[0]});
  });
  await page.getByLabel('Enunciado',{exact:true}).fill('Edição para salvar');await page.getByRole('button',{name:'Salvar pergunta',exact:true}).click();
  await expect.poll(()=>salvamento).toBe(true);await expect(page.getByRole('button',{name:'Duplicar pergunta',exact:true})).toBeDisabled();expect(comandos).toEqual([]);
  liberar();await expect(page.getByRole('button',{name:'Duplicar pergunta',exact:true})).toBeEnabled();
});

test('P05 não disponibiliza duplicação em publicados ou arquivados',async({page})=>{
  const {comandos}=await cenarioCopiaP05(page);
  for(const status of ['publicado','arquivado']){
    await page.route('**/api/questionarios?*',r=>r.fulfill({json:{itens:questionarios.map(q=>q.id==='q-1'?{...q,status}:q),total:2}}));
    await page.reload();await page.getByRole('tab',{name:'Editor',exact:true}).click();
    await expect(page.getByRole('button',{name:'Duplicar pergunta',exact:true})).toBeDisabled();
    await expect(page.getByText('Duplique perguntas somente em um rascunho.',{exact:true})).toBeVisible();
  }
  expect(comandos).toEqual([]);
});

test('P05 salvar B não apaga a pendência nem a edição de A',async({page})=>{
  const {comandos,itens}=await cenarioCopiaP05(page);
  await page.route('**/api/questionarios/q-1/perguntas/p-2',r=>r.fulfill({json:itens[1]}));
  await page.getByLabel('Enunciado',{exact:true}).fill('A ainda não salva');
  await page.getByRole('button',{name:/Pergunta seguinte/}).click();
  await page.getByRole('button',{name:'Salvar pergunta',exact:true}).click();
  await expect(page.getByText('Pergunta salva.',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Duplicar pergunta',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:/A ainda não salva/}).click();await expect(page.getByLabel('Enunciado',{exact:true})).toHaveValue('A ainda não salva');
  expect(comandos).toEqual([]);
});

test('P05 cópia aguarda ACK da reordenação por teclado',async({page})=>{
  const {comandos,itens}=await cenarioCopiaP05(page);let liberar;const espera=new Promise(r=>{liberar=r;});let iniciou=false;
  await page.route('**/api/questionarios/q-1/perguntas/ordem',async r=>{
    iniciou=true;const ordem=r.request().postDataJSON().perguntas;await espera;
    await r.fulfill({json:ordem.map(o=>({...itens.find(i=>i.id===o.id),ordem:o.ordem}))});
  });
  await page.getByRole('button',{name:'Reordenar pergunta',exact:true}).first().focus();
  await page.keyboard.press('Space');
  await expect(page.getByRole('button',{name:'Reordenar pergunta',exact:true}).first()).toHaveAttribute('aria-pressed','true');
  await expect(page.getByRole('status').filter({hasText:'was moved over droppable area p-1'})).toBeAttached();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('status').filter({hasText:'p-2'})).toBeAttached();
  await page.keyboard.press('Space');
  await expect.poll(()=>iniciou).toBe(true);
  try{await expect(page.getByRole('button',{name:'Duplicar pergunta',exact:true})).toBeDisabled();expect(comandos).toEqual([]);}finally{liberar();}
  await expect(page.getByRole('button',{name:'Duplicar pergunta',exact:true})).toBeEnabled();
});

test('P05 ACK tardio não substitui outro contexto nem cria sucesso falso',async({page})=>{
  const {comandos,itens}=await cenarioCopiaP05(page);const erros=[];page.on('pageerror',e=>erros.push(e.message));
  let liberar;const espera=new Promise(r=>{liberar=r;});let iniciou=false;
  await page.route('**/api/questionarios/q-1/perguntas/p-1/duplicar',async r=>{
    iniciou=true;comandos.push(r.request().postDataJSON());await espera;
    itens.splice(1,0,{...itens[0],id:'p-copia',ordem:2,chaveClinica:null,visivelBiblioteca:false});
    await r.fulfill({status:201,json:{perguntaId:'p-copia',versaoQuestionario:2}});
  });
  await page.getByRole('button',{name:'Duplicar pergunta',exact:true}).click();await page.getByRole('button',{name:'Confirmar cópia',exact:true}).click();await expect.poll(()=>iniciou).toBe(true);
  // Ativação DOM controlada simula mudança externa/assistiva enquanto o ponteiro está contido pelo modal.
  await page.getByRole('tab',{name:'Formulários',exact:true}).evaluate(el=>el.click());
  await page.getByLabel('Selecionar',{exact:true}).selectOption('q-2');await expect(page.getByLabel('Título',{exact:true})).toHaveValue('Avaliação mensal');
  const releu=page.waitForResponse(r=>r.url().endsWith('/q-1/perguntas'));liberar();await releu;
  await page.getByRole('tab',{name:'Editor',exact:true}).click();
  await expect(page.getByRole('button',{name:'Reordenar pergunta',exact:true})).toHaveCount(0);
  await expect(page.getByText('Pergunta duplicada. A cópia está selecionada para edição.',{exact:true})).toHaveCount(0);expect(comandos).toHaveLength(1);expect(erros).toEqual([]);
});

test('P05 conteúdo extenso preserva leitura e alcance das ações com fonte200',async({page})=>{
  const {itens,comandos}=await cenarioCopiaP05(page);
  itens[0].tipo='multipla_escolha';itens[0].enunciado='EnunciadoSemEspaços'.repeat(35);itens[0].configuracao={multipla:false};
  itens[0].opcoes=[{rotulo:'AlternativaExtensa'.repeat(35),valor:'a',ordem:1},{rotulo:'Outra alternativa',valor:'b',ordem:2}];
  await page.getByRole('button',{name:'Duplicar pergunta',exact:true}).click();
  const d=page.getByRole('dialog',{name:'Duplicar pergunta salva'});await expect(d).toBeVisible();
  await page.evaluate(()=>{document.documentElement.style.fontSize='200%';});
  expect(await d.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
  await d.getByRole('button',{name:'Confirmar cópia',exact:true}).scrollIntoViewIfNeeded();await expect(d.getByRole('button',{name:'Confirmar cópia',exact:true})).toBeInViewport();
  await d.getByRole('button',{name:'Cancelar',exact:true}).click();await expect(d).toHaveCount(0);expect(comandos).toEqual([]);
});

test('P05 leitura antiga do seletor não remove cópia após A-B-A',async({page})=>{
  await cenarioCopiaP05(page);let liberar;const espera=new Promise(r=>{liberar=r;});let iniciou=false;
  await page.route('**/api/questionarios/q-2/perguntas',async r=>{iniciou=true;await espera;await r.fulfill({json:[]});});
  await page.getByRole('tab',{name:'Formulários',exact:true}).click();await page.getByLabel('Selecionar',{exact:true}).selectOption('q-2');await expect.poll(()=>iniciou).toBe(true);
  const leuA=page.waitForResponse(r=>r.url().endsWith('/q-1/perguntas'));
  await page.getByLabel('Selecionar',{exact:true}).selectOption('q-1');await (await leuA).finished();
  await page.getByRole('tab',{name:'Editor',exact:true}).click();await page.getByRole('button',{name:'Duplicar pergunta',exact:true}).click();await page.getByRole('button',{name:'Confirmar cópia',exact:true}).click();
  await expect(page.getByLabel('Enunciado',{exact:true})).toBeFocused();
  const antiga=page.waitForResponse(r=>r.url().endsWith('/q-2/perguntas'));liberar();await (await antiga).finished();
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await expect(page.getByRole('button',{name:'Reordenar pergunta',exact:true})).toHaveCount(3);
  await expect(page.getByLabel('Enunciado',{exact:true})).toHaveValue('Pergunta salva');
});

test('QST10-06 checklist usa edição local sem salvar e ignora resposta após nova edição', async ({ page }) => {
  await criarSessao(page); await mockarBff(page); let entrada, liberar, chamadas = 0;
  const espera = new Promise(resolve => { liberar = resolve; });
  await page.route('**/api/questionarios/q-1/validacao', async route => {
    chamadas++; entrada = route.request().postDataJSON(); if (chamadas === 2) await espera;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ versao: 1, problemas: [{ perguntaId: 'p-1', campo: 'configuracao', codigo: 'configuracao_invalida' }] }) });
  });
  let escritas = 0; page.on('request', r => { if (/api\/questionarios/.test(r.url()) && ['PATCH', 'PUT', 'DELETE'].includes(r.method())) escritas++; });
  await page.goto('/questionarios'); await page.getByRole('tab', { name: 'Editor', exact: true }).click();
  await page.getByLabel('Enunciado', { exact: true }).fill('Edição local ainda não salva');
  await page.getByRole('button', { name: 'Conferir questionário', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Checklist do questionário' })).toContainText('Revise os limites e a configuração desta pergunta.');
  await page.locator('[data-qst10-checklist]').screenshot({ path: test.info().outputPath('qst10-06-checklist.png') });
  expect(entrada.perguntas[0].dados.enunciado).toBe('Edição local ainda não salva'); expect(entrada.versaoEsperada).toBe(1); expect(escritas).toBe(0);
  await page.getByRole('button', { name: 'Corrigir pergunta 1: configuração', exact: true }).click();
  await expect(page.locator('#configuracao-pergunta')).toBeFocused();
  await page.getByRole('button', { name: 'Conferir questionário', exact: true }).click(); await expect.poll(() => chamadas).toBe(2);
  await page.getByLabel('Enunciado', { exact: true }).fill('Edição mais recente'); liberar();
  await expect(page.getByRole('region', { name: 'Checklist do questionário' })).toHaveCount(0);
  await expect(page.getByLabel('Enunciado', { exact: true })).toHaveValue('Edição mais recente');
});

test('QST10-06 conflito preserva rascunho e nova conferência exige ação explícita', async ({ page }) => {
  await criarSessao(page); await mockarBff(page); let chamadas = 0, consultas = 0;
  await page.route('**/api/questionarios/q-1/validacao', route => {
    if (route.request().method() === 'GET') { consultas++; return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ versao: 2 }) }); }
    chamadas++; const entrada = route.request().postDataJSON();
    return route.fulfill({ status: entrada.versaoEsperada === 1 ? 409 : 200, contentType: 'application/json', body: JSON.stringify(entrada.versaoEsperada === 1 ? { message: 'Confira novamente.' } : { versao: 2, problemas: [] }) });
  });
  await page.goto('/questionarios'); await page.getByRole('tab', { name: 'Editor', exact: true }).click();
  await page.getByLabel('Enunciado', { exact: true }).fill('Rascunho preservado');
  await page.getByRole('button', { name: 'Conferir questionário', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Checklist do questionário' })).toContainText('Não foi possível concluir a conferência');
  expect(chamadas).toBe(1); expect(consultas).toBe(0); await expect(page.getByLabel('Enunciado', { exact: true })).toHaveValue('Rascunho preservado');
  await page.getByRole('button', { name: 'Conferir com a versão salva atual', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Checklist do questionário' })).toContainText('Nenhuma pendência nas regras verificadas');
  expect(chamadas).toBe(2); expect(consultas).toBe(1); await expect(page.getByLabel('Enunciado', { exact: true })).toHaveValue('Rascunho preservado');
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  const resultado = await new AxeBuilder({ page }).include('[data-qst10-checklist]').analyze(); expect(resultado.violations).toEqual([]);
});

test('QST10-06 conferência não reaparece após ida e volta de edição ou falha ao salvar', async ({ page }) => {
  await criarSessao(page); await mockarBff(page);
  await page.route('**/api/questionarios/q-1/validacao', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ versao: 1, problemas: [] }) }));
  await page.route('**/api/questionarios/q-1/perguntas/p-1', route => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ mensagem: 'Falha sintética ao salvar.' }) }));
  await page.goto('/questionarios'); await page.getByRole('tab', { name: 'Editor', exact: true }).click();
  const enunciado = page.getByLabel('Enunciado', { exact: true });
  await enunciado.fill('Edição A');
  await page.getByRole('button', { name: 'Conferir questionário', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Checklist do questionário' })).toContainText('Nenhuma pendência');
  await enunciado.fill('Edição B'); await enunciado.fill('Edição A');
  await expect(page.getByRole('region', { name: 'Checklist do questionário' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Conferir questionário', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Checklist do questionário' })).toContainText('Nenhuma pendência');
  await page.getByRole('button', { name: 'Salvar pergunta', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Salvar pergunta', exact: true })).toBeEnabled();
  await expect(page.getByRole('region', { name: 'Checklist do questionário' })).toHaveCount(0);
  await expect(enunciado).toHaveValue('Edição A');
});

test('QST10-06 resposta tardia de A não é aceita após editar para B e voltar a A', async ({ page }) => {
  await criarSessao(page); await mockarBff(page); let liberar;
  const espera = new Promise(resolve => { liberar = resolve; });
  await page.route('**/api/questionarios/q-1/validacao', async route => { await espera; await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ versao: 1, problemas: [] }) }); });
  await page.goto('/questionarios'); await page.getByRole('tab', { name: 'Editor', exact: true }).click();
  const enunciado = page.getByLabel('Enunciado', { exact: true }); await enunciado.fill('Edição A');
  const envio = page.waitForRequest(r => r.url().endsWith('/validacao'));
  await page.getByRole('button', { name: 'Conferir questionário', exact: true }).click(); await envio;
  await enunciado.fill('Edição B'); await enunciado.fill('Edição A');
  const resposta = page.waitForResponse(r => r.url().endsWith('/validacao')); liberar();
  await (await resposta).finished();
  // A ausência deve permanecer após a resposta e o próximo ciclo de renderização.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await expect(page.getByRole('region', { name: 'Checklist do questionário' })).toHaveCount(0);
  await expect(enunciado).toHaveValue('Edição A');
});
