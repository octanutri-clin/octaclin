import { expect, test } from '@playwright/test';

async function prepararSessaoCliente(page) {
  await page.context().addCookies([
    { name: 'octaclin_access_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_refresh_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_papel', value: 'Client', domain: 'localhost', path: '/' },
    { name: 'octaclin_destino_inicial', value: encodeURIComponent('/cliente'), domain: 'localhost', path: '/' }
  ]);

  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        autenticado: true,
        apiUrl: 'http://localhost:3001',
        tenantSlug: 'clinica-carla',
        email: 'gestor@octaclin.local',
        expiraEm: '2026-07-22T15:00:00.000Z',
        papel: 'Client',
        permissoes: [
          'cliente.acessar',
          'cliente.assinatura.ler',
          'cliente.usuarios.ler',
          'cliente.usuarios.convidar',
          'cliente.usuarios.desativar',
          'cliente.convites.gerenciar',
          'cliente.configuracoes.gerenciar'
        ],
        destinoInicial: '/cliente'
      })
    });
  });

  await page.route('**/api/cliente/resumo', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        conta: {
          tenantId: 'tenant-1',
          nome: 'Clinica Octa Real',
          slug: 'clinica-octa-real',
          status: 'ativo',
          criadoEm: '2026-07-01T10:00:00.000Z',
          atualizadoEm: '2026-07-20T10:00:00.000Z'
        },
        assinatura: {
          plano: 'Plano gratuito',
          status: 'ativa',
          origem: 'base_inicial'
        },
        usuarios: {
          totalAtivos: 4,
          clientes: 1,
          profissionais: 2,
          pacientes: 1
        },
        acesso: {
          usuarioId: 'cliente-1',
          papel: 'Client',
          escopoDados: 'conta_cliente',
          destinoInicial: '/cliente'
        }
      })
    });
  });

  await page.route('**/api/cliente/usuarios', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          itens: [
            {
              id: 'cliente-1',
              tenantId: 'tenant-1',
              email: 'gestor@octaclin.local',
              role: 'Client',
              ativo: true,
              ultimoLoginEm: '2026-07-21T10:00:00.000Z',
              criadoEm: '2026-07-01T10:00:00.000Z',
              atualizadoEm: '2026-07-21T10:00:00.000Z'
            },
            {
              id: 'colaborador-1',
              tenantId: 'tenant-1',
              email: 'agenda@octaclin.local',
              role: 'Collaborator',
              ativo: true,
              criadoEm: '2026-07-12T10:00:00.000Z',
              atualizadoEm: '2026-07-20T10:00:00.000Z'
            }
          ],
          total: 2
        })
      });
      return;
    }

    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'novo-1',
        tenantId: 'tenant-1',
        email: 'novo@octaclin.local',
        role: 'Collaborator',
        ativo: true,
        criadoEm: '2026-07-22T10:00:00.000Z',
        atualizadoEm: '2026-07-22T10:00:00.000Z'
      })
    });
  });

  await page.route('**/api/cliente/usuarios/convites', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        itens: [
          {
            id: 'token-1',
            usuarioId: 'colaborador-1',
            tenantId: 'tenant-1',
            email: 'agenda@octaclin.local',
            role: 'Collaborator',
            status: 'pendente',
            expiraEm: '2026-07-29T10:00:00.000Z',
            criadoEm: '2026-07-22T10:00:00.000Z',
            criadoPorUsuarioId: 'cliente-1'
          }
        ],
        total: 1
      })
    });
  });

  await page.route('**/api/cliente/configuracoes', async (route) => {
    if (route.request().method() === 'PATCH') {
      const corpo = JSON.parse(route.request().postData() ?? '{}');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          tenantId: 'tenant-1',
          slug: 'clinica-octa-real',
          status: 'ativo',
          atualizadoEm: '2026-07-22T10:00:00.000Z',
          ...corpo
        })
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        tenantId: 'tenant-1',
        nome: 'Clinica Octa Real',
        slug: 'clinica-octa-real',
        status: 'ativo',
        timezone: 'America/Sao_Paulo',
        idioma: 'pt-BR',
        canaisPadrao: {
          email: true,
          whatsapp: true,
          googleCalendar: true
        },
        marca: {
          nomeExibido: 'Clinica Octa Real',
          emailRemetente: 'contato@octaclin.com.br',
          corPrimaria: '#197d8f'
        },
        atualizadoEm: '2026-07-20T10:00:00.000Z'
      })
    });
  });

  await page.route('**/api/cliente/perfil-empresa', async (route) => {
    if (route.request().method() === 'PATCH') {
      const corpo = JSON.parse(route.request().postData() ?? '{}');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          tenantId: 'tenant-1',
          atualizadoEm: '2026-07-22T10:00:00.000Z',
          ...corpo
        })
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        tenantId: 'tenant-1',
        tipoPessoa: 'pj',
        documento: '12.345.678/0001-90',
        nomeLegal: 'OctaClin Consultoria LTDA',
        nomeFantasia: 'OctaClin Prime',
        inscricaoEstadual: 'isento',
        inscricaoMunicipal: '123456',
        responsavel: {
          nome: 'Carla Octa',
          email: 'carla@octaclin.com.br',
          telefone: '5511999990000',
          cargo: 'Diretora'
        },
        endereco: {
          cep: '01310-100',
          logradouro: 'Avenida Paulista',
          numero: '1000',
          complemento: 'cj 101',
          bairro: 'Bela Vista',
          cidade: 'Sao Paulo',
          uf: 'SP',
          pais: 'BR'
        },
        contatos: {
          emailFinanceiro: 'financeiro@octaclin.com.br',
          telefoneFinanceiro: '5511888880000',
          whatsappAtendimento: '5511992362080',
          emailAtendimento: 'atendimento@octaclin.com.br'
        },
        fiscal: {
          prepararRecibos: true,
          observacoes: 'Emitir recibos em nome do responsavel financeiro.'
        },
        atualizadoEm: '2026-07-20T10:00:00.000Z'
      })
    });
  });
}

async function assertSemOverflowHorizontal(page) {
  const medidas = await page.evaluate(() => ({
    larguraDocumento: document.documentElement.scrollWidth,
    larguraViewport: document.documentElement.clientWidth
  }));

  expect(medidas.larguraDocumento).toBeLessThanOrEqual(medidas.larguraViewport + 1);
}

test.describe('portal do cliente', () => {
  test('renderiza base de conta sem expor console ou portal do paciente', async ({ page }, testInfo) => {
    await prepararSessaoCliente(page);
    await page.goto('/cliente');

    await expect(page.getByRole('heading', { name: 'Portal do cliente' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Navegacao do cliente' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Conta' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Assinatura' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Usuarios' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Configuracoes' })).toBeVisible();
    const resumoConta = page.locator('#conta');
    await expect(resumoConta.getByText('Resumo da conta')).toBeVisible();
    await expect(resumoConta.getByText('Clinica Octa Real')).toBeVisible();
    await expect(resumoConta.getByText('clinica-octa-real')).toBeVisible();
    await expect(resumoConta.getByText('Plano gratuito')).toBeVisible();
    await expect(page.getByText('4 usuarios ativos')).toBeVisible();
    await expect(page.getByText('2 profissionais')).toBeVisible();
    await expect(page.getByText('1 paciente')).toBeVisible();
    const gestaoUsuarios = page.locator('#gestao-usuarios');
    await expect(gestaoUsuarios.getByRole('heading', { name: 'Gerenciar usuarios' })).toBeVisible();
    await expect(gestaoUsuarios.getByRole('button', { name: 'Convidar usuario' })).toBeVisible();
    await expect(gestaoUsuarios.getByText('Link de primeiro acesso enviado por email')).toBeVisible();
    await expect(gestaoUsuarios.getByText('Senha inicial')).toHaveCount(0);
    await expect(gestaoUsuarios.getByText('gestor@octaclin.local')).toBeVisible();
    await expect(gestaoUsuarios.locator('span').filter({ hasText: 'agenda@octaclin.local' })).toBeVisible();
    await expect(gestaoUsuarios.locator('span').filter({ hasText: 'Collaborator' })).toBeVisible();
    const convitesUsuarios = page.locator('#convites-usuarios');
    await expect(convitesUsuarios.getByRole('heading', { name: 'Convites pendentes' })).toBeVisible();
    await expect(convitesUsuarios.getByText('agenda@octaclin.local')).toBeVisible();
    await expect(convitesUsuarios.getByText('Expira em 29/07/26')).toBeVisible();
    await expect(convitesUsuarios.getByRole('button', { name: 'Reenviar convite para agenda@octaclin.local' })).toBeVisible();
    await expect(convitesUsuarios.getByRole('button', { name: 'Revogar convite de agenda@octaclin.local' })).toBeVisible();
    await expect(page.getByText('Acesso profissional separado')).toBeVisible();
    const configuracoes = page.locator('#configuracoes');
    await expect(configuracoes.getByRole('heading', { name: 'Configuracoes da conta' })).toBeVisible();
    await expect(configuracoes.getByLabel('Nome da clinica')).toHaveValue('Clinica Octa Real');
    await expect(configuracoes.getByLabel('Timezone')).toHaveValue('America/Sao_Paulo');
    await expect(configuracoes.getByLabel('Idioma')).toHaveValue('pt-BR');
    await expect(configuracoes.getByLabel('Email remetente')).toHaveValue('contato@octaclin.com.br');
    await expect(configuracoes.getByRole('checkbox', { name: 'Email' })).toBeChecked();
    await expect(configuracoes.getByRole('checkbox', { name: 'WhatsApp' })).toBeChecked();
    await configuracoes.getByLabel('Nome exibido').fill('Octa Prime');
    await configuracoes.getByRole('checkbox', { name: 'WhatsApp' }).uncheck();
    await configuracoes.getByRole('button', { name: 'Salvar configuracoes' }).click();
    await expect(configuracoes.getByText('Configuracoes salvas.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Perfil fiscal' })).toBeVisible();
    const perfilFiscal = page.locator('#perfil-fiscal');
    await expect(perfilFiscal.getByRole('heading', { name: 'Perfil fiscal' })).toBeVisible();
    await expect(perfilFiscal.getByLabel('Tipo de pessoa')).toHaveValue('pj');
    await expect(perfilFiscal.getByLabel('Documento fiscal')).toHaveValue('12.345.678/0001-90');
    await expect(perfilFiscal.getByLabel('Nome legal')).toHaveValue('OctaClin Consultoria LTDA');
    await expect(perfilFiscal.getByRole('textbox', { name: 'Responsavel', exact: true })).toHaveValue('Carla Octa');
    await expect(perfilFiscal.getByLabel('Email do responsavel')).toHaveValue('carla@octaclin.com.br');
    await expect(perfilFiscal.getByLabel('Cidade')).toHaveValue('Sao Paulo');
    await expect(perfilFiscal.getByLabel('UF')).toHaveValue('SP');
    await expect(perfilFiscal.getByLabel('Email financeiro')).toHaveValue('financeiro@octaclin.com.br');
    await perfilFiscal.getByLabel('Nome fantasia').fill('OctaClin Fiscal');
    await perfilFiscal.getByLabel('Observacoes fiscais').fill('Recibos por consulta paga.');
    await perfilFiscal.getByRole('button', { name: 'Salvar perfil fiscal' }).click();
    await expect(perfilFiscal.getByText('Perfil fiscal salvo.')).toBeVisible();
    await expect(page.getByText('Portal do paciente')).toHaveCount(0);
    await expect(page.getByText('Console clinico')).toHaveCount(0);
    await assertSemOverflowHorizontal(page);

    const screenshot = await page.screenshot({ fullPage: true });
    await testInfo.attach(`${testInfo.project.name}-portal-cliente.png`, { body: screenshot, contentType: 'image/png' });
  });
});
