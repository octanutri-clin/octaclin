import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { PACIENTE, R_CONFIRMADA, R_PENDENTE, R_DECLARADA, listaExemplo, prepararAbaRestricoes } from './fixtures/food06-restricoes-prontuario.mjs';

// FOOD06 P3-3: aba "Restrições" do prontuário com dados sintéticos e BFF simulado. Não prova authz, carteira, concessão
// nem RLS: isso é do backend (P2/P3-0a) e do test:authz. Prova o que a tela mostra, esconde, confirma e anuncia.

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const aba = (page) => page.getByRole('region', { name: 'Restrições alimentares' });

async function abrirAba(page) {
  await page.goto(`/pacientes/${PACIENTE}`);
  await page.getByRole('tab', { name: 'Plano', exact: true }).click();
  await page.getByRole('tab', { name: 'Restrições', exact: true }).click();
  await expect(aba(page).getByRole('heading', { name: 'Restrições alimentares' })).toBeVisible();
}

async function semViolacoes(page, seletor = 'section[aria-label="Restrições alimentares"]') {
  const { violations } = await new AxeBuilder({ page }).include(seletor).withTags(TAGS).analyze();
  expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(',')}`)).toEqual([]);
}

test.describe('FOOD06 P3-3 — aba Restrições no prontuário', () => {
  test('área desligada: a aba não existe na área Plano', async ({ page }) => {
    await prepararAbaRestricoes(page, { disponivel: false });
    // Rota literal (id sintético = PACIENTE) para a matriz de acessibilidade reconhecer a visita.
    await page.goto('/pacientes/paciente-pa06-sintetico');
    await page.getByRole('tab', { name: 'Plano', exact: true }).click();
    await expect(page.getByRole('tab', { name: 'Condutas terapêuticas', exact: true })).toBeVisible();
    await page.waitForTimeout(300);
    await expect(page.getByRole('tab', { name: 'Restrições', exact: true })).toHaveCount(0);
  });

  test('profissional com permissão clínica: aviso, grupos, marca do paciente, observação e recolhidas', async ({ page }) => {
    await prepararAbaRestricoes(page);
    await abrirAba(page);
    const regiao = aba(page);
    await expect(regiao.getByRole('note')).toHaveText('Estes registros ainda não geram alerta automático no plano alimentar. Confira antes de prescrever.');
    await expect(regiao.getByRole('heading', { name: 'Para conferir (2)' })).toBeVisible();
    await expect(regiao.getByRole('heading', { name: 'Confirmadas (1)' })).toBeVisible();
    await expect(regiao.getByText('Tipo não informado pelo paciente')).toBeVisible();
    await expect(regiao.getByText('Reação relatada na infância (sintético)')).toBeVisible();
    await expect(regiao.getByText('Alergia alimentar · Gravidade: Grave')).toBeVisible();
    // Inativa recolhida, fechada por padrão.
    await expect(regiao.getByText('Inativas e rejeitadas (1)')).toBeVisible();
    await expect(regiao.getByText('Lactose')).toBeHidden();
    // Escolha alimentar não mostra gravidade; confirmadas não têm ações.
    await expect(regiao.getByRole('listitem').getByText('Escolha alimentar', { exact: true })).toBeVisible();
    await expect(regiao.getByRole('button', { name: /Confirmar: escolha alimentar/ })).toHaveCount(0);
    const texto = await regiao.innerText();
    for (const proibido of [/nao_catalogado|declaracao_paciente|alergia_alimentar|CANARIO|[0-9a-f]{8}-[0-9a-f]{4}-/]) expect(texto).not.toMatch(proibido);
    await expect(regiao.getByText('A conferência geral das restrições deste paciente ainda não foi iniciada.')).toBeVisible();
    await semViolacoes(page);
  });

  test('confirmar: diálogo com a descrição, corpo só com a revisão, anúncio e lista recarregada', async ({ page }) => {
    let lista = listaExemplo();
    const { pedidos } = await prepararAbaRestricoes(page, {
      lista: () => lista,
      confirmar: (corpo, id) => {
        lista = { ...lista, itens: lista.itens.map((i) => (i.id === id ? { ...i, confirmacao: 'confirmada', revisao: corpo.revisao + 1 } : i)) };
        return { id, revisao: corpo.revisao + 1, confirmacao: 'confirmada' };
      }
    });
    await abrirAba(page);
    const regiao = aba(page);
    await regiao.getByRole('button', { name: 'Confirmar: alergia alimentar: Amendoim' }).click();
    const dialogo = page.getByRole('dialog', { name: 'Confirmar alergia alimentar: Amendoim?' });
    await expect(dialogo).toContainText('A restrição passa a valer como confirmada');
    await dialogo.getByRole('button', { name: 'Confirmar' }).click();
    await expect(regiao.getByRole('status').filter({ hasText: 'alergia alimentar: Amendoim foi confirmada.' })).toBeVisible();
    await expect(regiao.getByRole('heading', { name: 'Confirmadas (2)' })).toBeVisible();
    expect(pedidos.find((p) => p.caminho.endsWith(`/${R_PENDENTE}/confirmar`)).corpo).toEqual({ revisao: 2 });
  });

  test('rejeitar exige justificativa (foco e aviso), manda revisão e justificativa', async ({ page }) => {
    const { pedidos } = await prepararAbaRestricoes(page);
    await abrirAba(page);
    const regiao = aba(page);
    await regiao.getByRole('button', { name: 'Rejeitar: restrição de tipo não informado: Leite' }).click();
    const dialogo = page.getByRole('dialog', { name: 'Rejeitar restrição de tipo não informado: Leite?' });
    await dialogo.getByRole('button', { name: 'Rejeitar registro' }).click();
    const campo = dialogo.getByLabel('Justificativa (só a equipe vê)');
    await expect(campo).toHaveAttribute('aria-invalid', 'true');
    await expect(dialogo.getByText('Escreva a justificativa.', { exact: false })).toBeVisible();
    expect(pedidos.filter((p) => p.caminho.endsWith('/rejeitar'))).toEqual([]);
    await campo.fill('Item já registrado em outra restrição (sintético).');
    await semViolacoes(page, '[role="dialog"]');
    await dialogo.getByRole('button', { name: 'Rejeitar registro' }).click();
    await expect(regiao.getByRole('status').filter({ hasText: 'foi rejeitada.' })).toBeVisible();
    expect(pedidos.find((p) => p.caminho.endsWith(`/${R_DECLARADA}/rejeitar`)).corpo)
      .toEqual({ revisao: 1, justificativa: 'Item já registrado em outra restrição (sintético).' });
  });

  test('registrar: campos obrigatórios com foco, gravidade só em clínica, quebra de linha avisada e corpo exato', async ({ page }) => {
    const { pedidos } = await prepararAbaRestricoes(page);
    await abrirAba(page);
    const regiao = aba(page);
    const registrar = regiao.getByRole('button', { name: 'Registrar para conferência' });
    await registrar.click();
    await expect(regiao.getByLabel('Tipo', { exact: true })).toBeFocused();
    await regiao.getByLabel('Tipo', { exact: true }).selectOption('escolha');
    await expect(regiao.getByLabel('Gravidade')).toHaveCount(0);
    await regiao.getByLabel('Tipo', { exact: true }).selectOption('intolerancia');
    await expect(regiao.getByLabel('Gravidade')).toHaveValue('nao_informada');
    await registrar.click();
    await expect(regiao.getByLabel('Alimento ou item')).toBeFocused();
    await regiao.getByLabel('Alimento ou item').fill('Glúten');
    await regiao.getByLabel('Gravidade').selectOption('moderada');
    await regiao.getByLabel('Observação (opcional, só a equipe vê)').fill('linha um\nlinha dois');
    await expect(regiao.getByText('As quebras de linha foram trocadas por espaços.', { exact: false })).toBeVisible();
    await registrar.click();
    await expect(regiao.getByRole('status').filter({ hasText: 'Glúten foi registrado para conferência.' })).toBeVisible();
    const envio = pedidos.find((p) => p.caminho.endsWith('/registrar'));
    expect(envio.caminho).toBe(`/api/pacientes/${PACIENTE}/restricoes/registrar`);
    expect(Object.keys(envio.corpo).sort()).toEqual(['alimento', 'chaveCriacao', 'gravidade', 'observacao', 'tipo']);
    expect(envio.corpo).toMatchObject({ tipo: 'intolerancia', alimento: 'Glúten', gravidade: 'moderada', observacao: 'linha um linha dois' });
    await expect(regiao.getByLabel('Alimento ou item')).toHaveValue('');
  });

  test('registro incerto reaproveita a mesma chave ao repetir (sem duplicar)', async ({ page }) => {
    let tentativa = 0;
    const { pedidos } = await prepararAbaRestricoes(page, { registrar: () => (++tentativa === 1 ? 503 : { id: '66666666-6666-4666-8666-666666666666', revisao: 1, estado: 'ativa', confirmacao: 'pendente' }) });
    await abrirAba(page);
    const regiao = aba(page);
    await regiao.getByLabel('Tipo', { exact: true }).selectOption('alergia');
    await regiao.getByLabel('Alimento ou item').fill('Camarão');
    await regiao.getByRole('button', { name: 'Registrar para conferência' }).click();
    await expect(regiao.getByRole('alert').filter({ hasText: 'Não conseguimos confirmar se a ação foi concluída.' })).toBeVisible();
    await regiao.getByRole('button', { name: 'Registrar para conferência' }).click();
    await expect(regiao.getByRole('status').filter({ hasText: 'Camarão foi registrado para conferência.' })).toBeVisible();
    const chaves = pedidos.filter((p) => p.caminho.endsWith('/registrar')).map((p) => p.corpo.chaveCriacao);
    expect(chaves).toHaveLength(2);
    expect(chaves[0]).toBe(chaves[1]);
  });

  test('conflito (409) ao confirmar: mensagem fixa, lista recarregada, sem eco', async ({ page }) => {
    const { pedidos } = await prepararAbaRestricoes(page, { confirmar: () => 409 });
    await abrirAba(page);
    const regiao = aba(page);
    await regiao.getByRole('button', { name: 'Confirmar: alergia alimentar: Amendoim' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Confirmar' }).click();
    await expect(regiao.getByRole('status').filter({ hasText: 'Esta informação mudou ou um limite foi atingido.' })).toBeVisible();
    await expect(regiao).not.toContainText('CANARIO');
    await expect.poll(() => pedidos.filter((p) => p.caminho.endsWith('/listar')).length).toBeGreaterThanOrEqual(2);
  });

  test('iniciar a conferência geral e mostrar a situação com as datas', async ({ page }) => {
    let iniciada = false;
    const { pedidos } = await prepararAbaRestricoes(page, {
      avaliacao: () => (iniciada ? { avaliacao: { id: '55555555-5555-4555-8555-555555555555', revisao: 1, situacao: 'nao_informado', confirmadoEm: null, venceEm: null } } : { avaliacao: null }),
      iniciar: () => { iniciada = true; return { id: '55555555-5555-4555-8555-555555555555', revisao: 1, situacao: 'nao_informado' }; }
    });
    await abrirAba(page);
    const regiao = aba(page);
    await regiao.getByRole('button', { name: 'Iniciar conferência' }).click();
    await expect(regiao.getByRole('status').filter({ hasText: 'Conferência iniciada.' })).toBeVisible();
    await expect(regiao.getByText('Restrições ainda não conferidas com o paciente.')).toBeVisible();
    expect(pedidos.find((p) => p.caminho.endsWith('/avaliacao/iniciar')).corpo).toEqual({});

    const outra = await page.context().newPage();
    await prepararAbaRestricoes(outra, { avaliacao: () => ({ avaliacao: { id: '55555555-5555-4555-8555-555555555555', revisao: 2,
      situacao: 'restricoes_registradas', confirmadoEm: '2026-11-10T10:00:00.000Z', venceEm: '2027-05-09T10:00:00.000Z' } }) });
    await abrirAba(outra);
    await expect(aba(outra).getByText('Restrições conferidas em 10/11/2026. Reconferir até 09/05/2027.')).toBeVisible();
  });

  test('colaborador: só os próprios registros, texto próprio de vazio, sem ações de conferência, registro pela rota de colaborador', async ({ page }) => {
    const { pedidos } = await prepararAbaRestricoes(page, { papel: 'Collaborator', lista: () => ({ escopo: 'autoria', itens: [] }) });
    await abrirAba(page);
    const regiao = aba(page);
    await expect(regiao.getByText('Você vê apenas os registros que fez. Outros registros podem existir.').first()).toBeVisible();
    await expect(regiao.getByText('Nenhuma restrição registrada.', { exact: false })).toHaveCount(0);
    await expect(regiao.getByRole('button', { name: /^Confirmar|^Rejeitar|Iniciar conferência/ })).toHaveCount(0);
    expect(pedidos.some((p) => p.caminho.endsWith('/avaliacao'))).toBe(false);
    expect(pedidos.find((p) => p.caminho.endsWith('/listar')).caminho).toBe(`/api/colaborador/pacientes/${PACIENTE}/restricoes/listar`);
    await regiao.getByLabel('Tipo', { exact: true }).selectOption('alergia');
    await regiao.getByLabel('Alimento ou item').fill('Castanha');
    await regiao.getByRole('button', { name: 'Registrar para conferência' }).click();
    await expect(regiao.getByRole('status').filter({ hasText: 'Castanha foi registrado para conferência.' })).toBeVisible();
    expect(pedidos.find((p) => p.caminho.endsWith('/registrar')).caminho).toBe(`/api/colaborador/pacientes/${PACIENTE}/restricoes/registrar`);
    await semViolacoes(page);
  });

  test('profissional sem a permissão clínica (escopo de autoria): aviso próprio e nenhuma ação de conferência', async ({ page }) => {
    await prepararAbaRestricoes(page, { lista: () => ({ escopo: 'autoria', itens: [listaExemplo().itens[0]] }) });
    await abrirAba(page);
    const regiao = aba(page);
    await expect(regiao.getByText('Confirmar ou rejeitar restrições exige profissional com permissão clínica.', { exact: false })).toBeVisible();
    await expect(regiao.getByText('Amendoim')).toBeVisible();
    await expect(regiao.getByRole('button', { name: /^Confirmar|^Rejeitar/ })).toHaveCount(0);
  });

  test('a 320 px (equivalente a 400% de zoom) a aba não cria rolagem horizontal', async ({ page }) => {
    await prepararAbaRestricoes(page);
    await page.setViewportSize({ width: 320, height: 720 });
    await abrirAba(page);
    await expect(aba(page).getByText('Amendoim')).toBeVisible();
    const medidas = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, vp: document.documentElement.clientWidth }));
    expect(medidas.doc).toBeLessThanOrEqual(medidas.vp + 1);
  });

  // Etapa B (2026-11-20): ajustes da revisão de UX.
  test('UX B: item "Não sei dizer" não usa o rótulo do tipo como fato; diálogo repete gravidade, origem e observação', async ({ page }) => {
    await prepararAbaRestricoes(page);
    await abrirAba(page);
    const regiao = aba(page);
    // NUX-01: o cartão e o diálogo não afirmam "Outra restrição clínica" quando o paciente não soube dizer.
    const leite = regiao.getByRole('listitem').filter({ hasText: 'Leite' });
    await expect(leite.getByText('Tipo não informado pelo paciente')).toBeVisible();
    await expect(leite.getByText('Outra restrição clínica')).toHaveCount(0);
    await regiao.getByRole('button', { name: 'Confirmar: restrição de tipo não informado: Leite' }).click();
    const dialogoLeite = page.getByRole('dialog', { name: 'Confirmar restrição de tipo não informado: Leite?' });
    await expect(dialogoLeite).toContainText('O tipo e a gravidade continuam não informados');
    await dialogoLeite.getByRole('button', { name: 'Voltar' }).click();
    // NUX-02: gravidade, origem e observação no diálogo.
    await regiao.getByRole('button', { name: 'Confirmar: alergia alimentar: Amendoim' }).click();
    const dialogo = page.getByRole('dialog', { name: 'Confirmar alergia alimentar: Amendoim?' });
    await expect(dialogo).toContainText('Gravidade: Grave');
    await expect(dialogo).toContainText('Registrada por colaborador');
    await expect(dialogo).toContainText('Reação relatada na infância (sintético)');
  });

  test('UX B: conferência geral mostra pendentes; atalho para o formulário; rejeição orienta avisar o paciente', async ({ page }) => {
    await prepararAbaRestricoes(page, { avaliacao: () => ({ avaliacao: { id: '55555555-5555-4555-8555-555555555555', revisao: 2,
      situacao: 'restricoes_registradas', confirmadoEm: '2026-11-10T10:00:00.000Z', venceEm: '2027-05-09T10:00:00.000Z' } }) });
    await abrirAba(page);
    const regiao = aba(page);
    // NUX-03: "conferidas" nunca aparece sozinho quando há pendentes.
    await expect(regiao.getByRole('region', { name: 'Conferência geral das restrições' }).getByText('2 registros ainda aguardam conferência.')).toBeVisible();
    // NUX-05: atalho no topo leva o foco ao formulário.
    await regiao.getByRole('link', { name: 'Ir para registrar restrição' }).click();
    await expect(regiao.getByLabel('Tipo', { exact: true })).toBeFocused();
    // PUX-01: a rejeição avisa que o paciente não é notificado.
    await regiao.getByRole('button', { name: 'Rejeitar: alergia alimentar: Amendoim' }).click();
    await expect(page.getByRole('dialog')).toContainText('O paciente não é avisado automaticamente');
  });

  test('UX B: 409 ao rejeitar não perde a justificativa; o diálogo continua aberto com a versão atual', async ({ page }) => {
    let tentativa = 0;
    const { pedidos } = await prepararAbaRestricoes(page, {
      lista: () => (tentativa === 0 ? listaExemplo() : { ...listaExemplo(), itens: listaExemplo().itens.map((i) => (i.id === R_PENDENTE ? { ...i, revisao: 3 } : i)) }),
      rejeitar: (corpo, id) => (++tentativa === 1 ? 409 : { id, revisao: corpo.revisao + 1, confirmacao: 'rejeitada' })
    });
    await abrirAba(page);
    const regiao = aba(page);
    await regiao.getByRole('button', { name: 'Rejeitar: alergia alimentar: Amendoim' }).click();
    const dialogo = page.getByRole('dialog');
    await dialogo.getByLabel('Justificativa (só a equipe vê)').fill('Texto longo sintético que não pode se perder.');
    await dialogo.getByRole('button', { name: 'Rejeitar registro' }).click();
    await expect(dialogo.getByRole('alert')).toContainText('Esta informação mudou');
    await expect(dialogo.getByLabel('Justificativa (só a equipe vê)')).toHaveValue('Texto longo sintético que não pode se perder.');
    await dialogo.getByRole('button', { name: 'Rejeitar registro' }).click();
    await expect(regiao.getByRole('status').filter({ hasText: 'foi rejeitada.' })).toBeVisible();
    const envios = pedidos.filter((p) => p.caminho.endsWith(`/${R_PENDENTE}/rejeitar`)).map((p) => p.corpo.revisao);
    expect(envios).toEqual([2, 3]);
  });
});

// FOOD06 P3-4a: ações protegidas sobre restrição confirmada. A proteção da alergia, a concessão e a carteira são do
// backend; aqui se prova o que a tela pede, em que ordem, e o que diz quando um passo falha.
const NOVA = '66666666-6666-4666-8666-666666666666';
/** Lista com estado: as ações simuladas alteram os itens como o backend faria, para a tela recarregar a versão atual. */
function listaViva() {
  const estado = { lista: listaExemplo() };
  estado.lista.itens = estado.lista.itens.map((i) => (i.id === R_PENDENTE ? { ...i, confirmacao: 'confirmada', revisao: 3 } : i));
  const trocar = (id, mudar) => { estado.lista = { ...estado.lista, itens: estado.lista.itens.map((i) => (i.id === id ? mudar(i) : i)) }; };
  return {
    estado,
    lista: () => estado.lista,
    inativar: (corpo, id) => { trocar(id, (i) => ({ ...i, estado: 'inativa', revisao: corpo.revisao + 1 })); return { id, revisao: corpo.revisao + 1, estado: 'inativa' }; },
    reavaliar: (corpo, id) => { trocar(id, (i) => ({ ...i, estado: corpo.destino, revisao: corpo.revisao + 1 })); return { id, revisao: corpo.revisao + 1, estado: corpo.destino }; },
    registrar: (corpo) => {
      estado.lista = { ...estado.lista, itens: [...estado.lista.itens, { id: NOVA, revisao: 1, origem: 'profissional', estado: 'ativa', confirmacao: 'pendente',
        criadoEm: '2026-11-20T10:00:00.000Z', conteudo: { natureza: 'clinica', subtipoClinico: 'alergia_alimentar', alvo: { tipo: 'nao_catalogado' },
          alvoDeclarado: corpo.alimento, gravidade: corpo.gravidade } }] };
      return { id: NOVA, revisao: 1, estado: 'ativa', confirmacao: 'pendente' };
    },
    confirmar: (corpo, id) => { trocar(id, (i) => ({ ...i, confirmacao: 'confirmada', revisao: corpo.revisao + 1 })); return { id, revisao: corpo.revisao + 1, confirmacao: 'confirmada' }; },
  };
}

test.describe('FOOD06 P3-4a — reavaliar, inativar e corrigir restrição confirmada', () => {
  test('reavaliar e encerrar a reavaliação: diálogo, corpo exato e item muda de grupo', async ({ page }) => {
    const viva = listaViva();
    const { pedidos } = await prepararAbaRestricoes(page, viva);
    await abrirAba(page);
    const regiao = aba(page);
    await regiao.getByRole('button', { name: 'Marcar para reavaliação: escolha alimentar: Carne vermelha' }).click();
    const dialogo = page.getByRole('dialog', { name: 'Marcar escolha alimentar: Carne vermelha para reavaliação?' });
    await expect(dialogo).toContainText('A restrição continua valendo enquanto é reavaliada.');
    await dialogo.getByRole('button', { name: 'Marcar para reavaliação' }).click();
    await expect(regiao.getByRole('status').filter({ hasText: 'foi marcada para reavaliação e continua valendo.' })).toBeVisible();
    await expect(regiao.getByRole('heading', { name: 'Em reavaliação (1)' })).toBeVisible();
    await regiao.getByRole('button', { name: 'Manter como confirmada: escolha alimentar: Carne vermelha' }).click();
    await page.getByRole('dialog', { name: 'Encerrar a reavaliação de escolha alimentar: Carne vermelha?' }).getByRole('button', { name: 'Manter como confirmada' }).click();
    await expect(regiao.getByRole('status').filter({ hasText: 'continua confirmada.' })).toBeVisible();
    expect(pedidos.filter((p) => p.caminho.endsWith('/reavaliar')).map((p) => p.corpo))
      .toEqual([{ revisao: 3, destino: 'em_reavaliacao' }, { revisao: 4, destino: 'ativa' }]);
    // Pendentes e recolhidas não recebem ações protegidas.
    await expect(regiao.getByRole('button', { name: /Inativar: restrição de tipo não informado/ })).toHaveCount(0);
  });

  test('inativar em dois passos: campos obrigatórios, quebra de linha vira espaço, frase com tipo e alimento, só então envia', async ({ page }) => {
    const viva = listaViva();
    const { pedidos } = await prepararAbaRestricoes(page, viva);
    await abrirAba(page);
    const regiao = aba(page);
    await regiao.getByRole('button', { name: 'Inativar: alergia alimentar: Amendoim' }).click();
    const dialogo = page.getByRole('dialog', { name: 'Inativar alergia alimentar: Amendoim?' });
    await dialogo.getByRole('button', { name: 'Continuar' }).click();
    await expect(dialogo.getByLabel('Motivo')).toBeFocused();
    await expect(dialogo.getByText('Escolha o motivo.')).toBeVisible();
    await dialogo.getByLabel('Motivo').selectOption({ label: 'Informação clínica revisada' });
    await dialogo.getByLabel('Justificativa (só a equipe vê)').fill('Teste de provocação negativo\nem consulta (sintético).');
    await expect(dialogo.getByText('As quebras de linha foram trocadas por espaços.', { exact: false })).toBeVisible();
    await semViolacoes(page, '[role="dialog"]');
    await dialogo.getByRole('button', { name: 'Continuar' }).click();
    const frase = dialogo.getByText('Você está inativando alergia alimentar confirmada: Amendoim. O histórico é preservado.');
    await expect(frase).toBeFocused();
    expect(pedidos.filter((p) => p.caminho.endsWith('/inativar'))).toEqual([]);
    await semViolacoes(page, '[role="dialog"]');
    // Voltar preserva o texto digitado.
    await dialogo.getByRole('button', { name: 'Voltar' }).click();
    await expect(dialogo.getByLabel('Justificativa (só a equipe vê)')).toHaveValue('Teste de provocação negativo em consulta (sintético).');
    await dialogo.getByRole('button', { name: 'Continuar' }).click();
    await dialogo.getByRole('button', { name: 'Inativar alergia alimentar' }).click();
    await expect(regiao.getByRole('status').filter({ hasText: 'alergia alimentar: Amendoim foi inativada. O histórico foi preservado.' })).toBeVisible();
    expect(pedidos.find((p) => p.caminho.endsWith(`/${R_PENDENTE}/inativar`)).corpo).toEqual({ revisao: 3, motivo: 'informacao_clinica_revisada',
      justificativa: 'Teste de provocação negativo em consulta (sintético).', confirmacaoEmDoisPassos: true });
    await expect(regiao.getByText('Inativas e rejeitadas (2)')).toBeVisible();
  });

  test('inativar com conflito (409): volta ao passo 1 com o texto preservado e a mensagem fixa, sem eco', async ({ page }) => {
    const viva = listaViva();
    await prepararAbaRestricoes(page, { ...viva, inativar: () => 409 });
    await abrirAba(page);
    await aba(page).getByRole('button', { name: 'Inativar: escolha alimentar: Carne vermelha' }).click();
    const dialogo = page.getByRole('dialog', { name: 'Inativar escolha alimentar: Carne vermelha?' });
    await dialogo.getByLabel('Motivo').selectOption({ label: 'Registro incorreto' });
    await dialogo.getByLabel('Justificativa (só a equipe vê)').fill('Registrada por engano (sintético).');
    await dialogo.getByRole('button', { name: 'Continuar' }).click();
    await dialogo.getByRole('button', { name: 'Inativar escolha alimentar' }).click();
    await expect(dialogo.getByRole('alert')).toHaveText('Esta informação mudou ou um limite foi atingido. A lista foi recarregada; confira antes de tentar de novo.');
    await expect(dialogo.getByLabel('Justificativa (só a equipe vê)')).toHaveValue('Registrada por engano (sintético).');
    expect(await page.locator('body').innerText()).not.toMatch(/CANARIO/);
  });

  test('corrigir registro (NUX-01): registra a corrigida, confirma a corrigida e só então inativa a anterior', async ({ page }) => {
    const viva = listaViva();
    const { pedidos } = await prepararAbaRestricoes(page, viva);
    await abrirAba(page);
    const regiao = aba(page);
    await regiao.getByRole('button', { name: 'Corrigir registro: alergia alimentar: Amendoim' }).click();
    const dialogo = page.getByRole('dialog', { name: 'Corrigir alergia alimentar: Amendoim' });
    await expect(dialogo.getByText('A restrição atual continua valendo até a nova estar confirmada.', { exact: false })).toBeVisible();
    await expect(dialogo.getByRole('heading', { name: 'Passo 1 de 3: Registrar a restrição corrigida', level: 3 })).toBeFocused();
    // O formulário parte da anterior.
    await expect(dialogo.getByLabel('Alimento ou item')).toHaveValue('Amendoim');
    await expect(dialogo.getByLabel('Gravidade')).toHaveValue('grave');
    await dialogo.getByLabel('Gravidade').selectOption('moderada');
    await semViolacoes(page, '[role="dialog"]');
    await dialogo.getByRole('button', { name: 'Registrar a corrigida' }).click();
    await expect(dialogo.getByRole('heading', { name: 'Passo 2 de 3: Confirmar a restrição corrigida', level: 3 })).toBeFocused();
    expect(pedidos.filter((p) => /\/(confirmar|inativar)$/.test(p.caminho))).toEqual([]);
    await dialogo.getByRole('button', { name: 'Confirmar a corrigida' }).click();
    await expect(dialogo.getByRole('heading', { name: 'Passo 3 de 3: Inativar a restrição anterior', level: 3 })).toBeFocused();
    await expect(dialogo.getByLabel('Motivo')).toHaveValue('registro_incorreto');
    await dialogo.getByRole('button', { name: 'Continuar' }).click();
    await expect(dialogo.getByText('Você está inativando alergia alimentar confirmada: Amendoim. O histórico é preservado.')).toBeVisible();
    // NUX (etapa B): com duas confirmadas iguais, a anterior é identificada; o motivo e o efeito no portal aparecem.
    await expect(dialogo.getByText('Anterior: gravidade grave, registrada em 10/11/2026.')).toBeVisible();
    await expect(dialogo.getByText('Motivo: Registro incorreto.')).toBeVisible();
    await expect(dialogo.getByText('sem aviso automático', { exact: false })).toBeVisible();
    await dialogo.getByRole('button', { name: 'Inativar alergia alimentar' }).click();
    await expect(dialogo).toBeHidden();
    await expect(regiao.getByRole('status').filter({ hasText: 'Correção concluída:' })).toBeVisible();
    const ordem = pedidos.filter((p) => /\/(registrar|confirmar|inativar)$/.test(p.caminho)).map((p) => p.caminho.split('/restricoes/')[1]);
    expect(ordem).toEqual(['registrar', `${NOVA}/confirmar`, `${R_PENDENTE}/inativar`]);
    expect(pedidos.find((p) => p.caminho.endsWith('/registrar')).corpo).toMatchObject({ tipo: 'alergia', alimento: 'Amendoim', gravidade: 'moderada',
      observacao: 'Reação relatada na infância (sintético)' });
    expect(pedidos.find((p) => p.caminho.endsWith(`/${NOVA}/confirmar`)).corpo).toEqual({ revisao: 1 });
    expect(pedidos.find((p) => p.caminho.endsWith('/inativar')).corpo).toMatchObject({ revisao: 3, motivo: 'registro_incorreto', confirmacaoEmDoisPassos: true });
  });

  test('corrigir registro: falha ao confirmar a corrigida para no passo 2 e a anterior continua confirmada', async ({ page }) => {
    const viva = listaViva();
    const { pedidos } = await prepararAbaRestricoes(page, { ...viva, confirmar: () => 409 });
    await abrirAba(page);
    const regiao = aba(page);
    await regiao.getByRole('button', { name: 'Corrigir registro: alergia alimentar: Amendoim' }).click();
    const dialogo = page.getByRole('dialog', { name: 'Corrigir alergia alimentar: Amendoim' });
    await dialogo.getByRole('button', { name: 'Registrar a corrigida' }).click();
    await dialogo.getByRole('button', { name: 'Confirmar a corrigida' }).click();
    await expect(dialogo.getByRole('alert')).toContainText('A correção parou no passo 2.');
    await dialogo.getByRole('button', { name: 'Parar a correção aqui' }).click();
    await expect(regiao.getByRole('status').filter({ hasText: 'A restrição antiga continua valendo.' })).toBeVisible();
    await expect(regiao.getByRole('heading', { name: 'Confirmadas (2)' })).toBeVisible();
    expect(pedidos.filter((p) => p.caminho.endsWith('/inativar'))).toEqual([]);
  });

  test('corrigir registro: parar no passo 3 diz que falta inativar a anterior e não inativa nada', async ({ page }) => {
    const viva = listaViva();
    const { pedidos } = await prepararAbaRestricoes(page, viva);
    await abrirAba(page);
    const regiao = aba(page);
    await regiao.getByRole('button', { name: 'Corrigir registro: alergia alimentar: Amendoim' }).click();
    const dialogo = page.getByRole('dialog', { name: 'Corrigir alergia alimentar: Amendoim' });
    await dialogo.getByRole('button', { name: 'Registrar a corrigida' }).click();
    await dialogo.getByRole('button', { name: 'Confirmar a corrigida' }).click();
    await expect(dialogo.getByRole('heading', { name: 'Passo 3 de 3: Inativar a restrição anterior', level: 3 })).toBeFocused();
    await dialogo.getByRole('button', { name: 'Parar a correção aqui' }).click();
    await expect(regiao.getByRole('status').filter({ hasText: 'A correção parou no passo 3.' })).toContainText('Para concluir, inative a anterior.');
    await expect(regiao.getByRole('heading', { name: 'Confirmadas (3)' })).toBeVisible();
    expect(pedidos.filter((p) => p.caminho.endsWith('/inativar'))).toEqual([]);
  });

  test('R4: se a corrigida deixou de valer (outra aba) antes do passo 3, a anterior não é inativada', async ({ page }) => {
    const viva = listaViva();
    let confirmou = false;
    const { pedidos } = await prepararAbaRestricoes(page, { ...viva,
      confirmar: (corpo, id) => { confirmou = true; return viva.confirmar(corpo, id); },
      lista: () => (confirmou ? { ...viva.lista(), itens: viva.lista().itens.map((i) => (i.id === NOVA ? { ...i, estado: 'inativa', revisao: 9 } : i)) } : viva.lista()) });
    await abrirAba(page);
    const regiao = aba(page);
    await regiao.getByRole('button', { name: 'Corrigir registro: alergia alimentar: Amendoim' }).click();
    const dialogo = page.getByRole('dialog', { name: 'Corrigir alergia alimentar: Amendoim' });
    await dialogo.getByRole('button', { name: 'Registrar a corrigida' }).click();
    await dialogo.getByRole('button', { name: 'Confirmar a corrigida' }).click();
    // Mesmo que a recarga logo após confirmar já mostre a corrigida inativa, o passo 3 só envia depois de conferir de novo.
    await dialogo.getByRole('button', { name: 'Continuar' }).click();
    await dialogo.getByRole('button', { name: 'Inativar alergia alimentar' }).click();
    await expect(regiao.getByRole('status').filter({ hasText: 'a restrição corrigida não está mais confirmada' })).toBeVisible();
    expect(pedidos.filter((p) => p.caminho.endsWith('/inativar'))).toEqual([]);
  });

  test('item de catálogo não oferece "Corrigir registro" (o vínculo se perderia); inativar mostra a conferência geral', async ({ page }) => {
    const viva = listaViva();
    const base = viva.lista();
    await prepararAbaRestricoes(page, { ...viva,
      avaliacao: () => ({ avaliacao: { id: '55555555-5555-4555-8555-555555555555', revisao: 2, situacao: 'restricoes_registradas',
        confirmadoEm: '2026-11-10T10:00:00.000Z', venceEm: '2027-05-09T10:00:00.000Z' } }),
      lista: () => ({ ...base, itens: base.itens.map((i) => (i.id === R_CONFIRMADA ? { ...i, conteudo: { natureza: 'escolha', alvo: { tipo: 'categoria_escolha', id: 'vegetariano' } } } : i)) }) });
    await abrirAba(page);
    const regiao = aba(page);
    await expect(regiao.getByRole('button', { name: /^Inativar: escolha alimentar/ })).toBeVisible();
    await expect(regiao.getByRole('button', { name: /^Corrigir registro: escolha alimentar/ })).toHaveCount(0);
    await regiao.getByRole('button', { name: 'Inativar: alergia alimentar: Amendoim' }).click();
    const dialogo = page.getByRole('dialog', { name: 'Inativar alergia alimentar: Amendoim?' });
    await dialogo.getByLabel('Motivo').selectOption({ label: 'Outro' });
    await dialogo.getByLabel('Justificativa (só a equipe vê)').fill('Texto com hífen\u00ADoculto');
    await dialogo.getByRole('button', { name: 'Continuar' }).click();
    await expect(dialogo.getByText('Remova caracteres invisíveis ou especiais da justificativa.', { exact: false })).toBeVisible();
    await dialogo.getByLabel('Justificativa (só a equipe vê)').fill('Texto sintético simples.');
    await dialogo.getByRole('button', { name: 'Continuar' }).click();
    await expect(dialogo.getByText('A conferência geral das restrições volta para "não conferida"', { exact: false })).toBeVisible();
  });

  test('sem a permissão clínica (escopo de autoria) e colaborador: nenhuma ação protegida', async ({ page }) => {
    const viva = listaViva();
    await prepararAbaRestricoes(page, { ...viva, papel: 'Collaborator', lista: () => ({ ...viva.lista(), escopo: 'autoria' }) });
    await abrirAba(page);
    await expect(aba(page).getByRole('heading', { name: 'Confirmadas (2)' })).toBeVisible();
    for (const nome of [/^Inativar/, /^Corrigir registro/, /^Marcar para reavaliação/]) await expect(aba(page).getByRole('button', { name: nome })).toHaveCount(0);
  });
});
