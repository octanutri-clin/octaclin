import { expect, test } from '@playwright/test';

async function prepararSessaoCliente(page, opcoes = {}) {
  const statusAssinatura = opcoes.statusAssinatura ?? 'trial';
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
          'cliente.usuarios.gerenciar',
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
          nome: 'Clínica Octa Real',
          slug: 'clinica-octa-real',
          status: 'ativo',
          criadoEm: '2026-07-01T10:00:00.000Z',
          atualizadoEm: '2026-07-20T10:00:00.000Z'
        },
        assinatura: {
          plano: 'Profissional',
          planoId: 'profissional',
          status: statusAssinatura,
          origem: 'manual_admin',
          renovacaoEm: '2026-08-22T00:00:00.000Z',
          limites: {
            usuariosAdministrativos: 3,
            pacientes: 100,
            mensagensMes: 1000,
            formulariosAtivos: 20,
            armazenamentoMb: 2048
          },
          uso: {
            usuariosAdministrativos: 3,
            pacientes: 82,
            mensagensMes: 790,
            formulariosAtivos: 12,
            armazenamentoMb: 640
          },
          alertas: [
            {
              recurso: 'usuariosAdministrativos',
              uso: 3,
              limite: 3,
              percentual: 100,
              status: 'excedido'
            }
          ]
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

  await page.route('**/api/cliente/assinatura/interesse', async (route) => {
    const corpo = JSON.parse(route.request().postData() ?? '{}');
    expect(corpo).toEqual({
      acao: 'upgrade',
      planoDesejado: 'clinica',
      observacao: 'Solicitacao feita pelo portal do cliente.'
    });
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        tenantId: 'tenant-1',
        acao: 'upgrade',
        status: 'pendente',
        planoAtualId: 'profissional',
        planoAtual: 'Profissional',
        planoDesejado: 'clinica',
        observacao: 'Solicitacao feita pelo portal do cliente.',
        solicitadoEm: '2026-07-22T10:00:00.000Z'
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

  await page.route('**/api/cliente/usuarios/colaborador-1', async (route) => {
    const corpo = JSON.parse(route.request().postData() ?? '{}');
    expect(corpo).toEqual({ role: 'Professional', nomeProfissional: 'Dra. Agenda' });
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'colaborador-1',
        tenantId: 'tenant-1',
        email: 'agenda@octaclin.local',
        role: 'Professional',
        ativo: true,
        criadoEm: '2026-07-12T10:00:00.000Z',
        atualizadoEm: '2026-08-01T10:00:00.000Z'
      })
    });
  });

  await page.route('**/api/cliente/usuarios/convites/historico', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        itens: [
          {
            id: 'token-3',
            usuarioId: 'profissional-1',
            tenantId: 'tenant-1',
            email: 'prof@octaclin.local',
            role: 'Professional',
            status: 'usado',
            expiraEm: '2026-07-31T10:00:00.000Z',
            criadoEm: '2026-07-24T09:00:00.000Z',
            usadoEm: '2026-07-24T10:00:00.000Z',
            criadoPorUsuarioId: 'cliente-1'
          },
          {
            id: 'token-2',
            usuarioId: 'colaborador-1',
            tenantId: 'tenant-1',
            email: 'agenda@octaclin.local',
            role: 'Collaborator',
            status: 'pendente',
            expiraEm: '2026-07-30T10:00:00.000Z',
            criadoEm: '2026-07-23T10:00:00.000Z',
            reenviadoPorUsuarioId: 'cliente-2'
          },
          {
            id: 'token-1',
            usuarioId: 'colaborador-1',
            tenantId: 'tenant-1',
            email: 'agenda@octaclin.local',
            role: 'Collaborator',
            status: 'revogado',
            expiraEm: '2026-07-29T10:00:00.000Z',
            criadoEm: '2026-07-22T10:00:00.000Z',
            revogadoEm: '2026-07-23T09:00:00.000Z',
            criadoPorUsuarioId: 'cliente-1',
            revogadoPorUsuarioId: 'cliente-2',
            motivoRevogacao: 'reenviado'
          }
        ],
        total: 3
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
        nome: 'Clínica Octa Real',
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
          nomeExibido: 'Clínica Octa Real',
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
  test('divide a conta por tarefas e nao expoe identificadores internos', async ({ page }) => {
    await prepararSessaoCliente(page);
    await page.goto('/cliente');

    const areas = page.getByRole('tablist', { name: 'Áreas da conta' });
    for (const nome of ['Ativação', 'Assinatura', 'Consumo', 'Equipe', 'Preferências', 'Marca', 'Integrações', 'Dados fiscais']) {
      await expect(areas.getByRole('tab', { name: nome })).toBeVisible();
    }

    await expect(areas.getByRole('tab', { name: 'Ativação' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('heading', { name: 'Ativação da clínica' })).toBeVisible();
    await expect(page.getByText('tenant-1')).toHaveCount(0);
    await expect(page.getByText('cliente-1')).toHaveCount(0);
    await expect(page.getByText('conta_cliente')).toHaveCount(0);
    await expect(page.getByText('manual_admin')).toHaveCount(0);

    await areas.getByRole('tab', { name: 'Assinatura' }).click();
    await expect(page.locator('#assinatura').getByText('Renova em 22/08/26')).toBeVisible();

    await areas.getByRole('tab', { name: 'Consumo' }).click();
    await expect(page.locator('#assinatura').getByText('Mensagens no mês')).toBeVisible();

    await areas.getByRole('tab', { name: 'Equipe' }).click();
    await expect(page.locator('#gestao-usuarios').getByRole('heading', { name: 'Gerenciar usuários' })).toBeVisible();
    await page.getByLabel('Permissão de agenda@octaclin.local').selectOption('Professional');
    await page.getByLabel('Nome profissional de agenda@octaclin.local').fill('Dra. Agenda');
    await page.getByRole('button', { name: 'Salvar acesso de agenda@octaclin.local' }).click();
    await expect(page.getByText('Permissões do usuário atualizadas. O novo acesso vale no próximo login.')).toBeVisible();

    await areas.getByRole('tab', { name: 'Marca' }).click();
    await expect(page.getByRole('heading', { name: 'Identidade da clínica' })).toBeVisible();

    await areas.getByRole('tab', { name: 'Dados fiscais' }).click();
    await expect(page.locator('#perfil-fiscal').getByRole('heading', { name: 'Perfil fiscal' })).toBeVisible();
    await assertSemOverflowHorizontal(page);
  });

  test('renderiza base de conta sem expor console ou portal do paciente', async ({ page }, testInfo) => {
    await prepararSessaoCliente(page);
    await page.goto('/cliente', { waitUntil: 'domcontentloaded', timeout: 30000 });

    await expect(page.getByRole('heading', { name: 'Portal do cliente' })).toBeVisible();
    const areas = page.getByRole('tablist', { name: 'Áreas da conta' });
    await expect(areas).toBeVisible();
    const resumoConta = page.locator('#conta');
    await expect(resumoConta.getByText('Resumo da conta')).toBeVisible();
    await expect(resumoConta.getByText('Clínica Octa Real')).toBeVisible();
    await expect(resumoConta.getByText('Profissional')).toBeVisible();
    await expect(page.getByText('4 usuários ativos')).toBeVisible();

    await areas.getByRole('tab', { name: 'Equipe' }).click();
    await expect(page.getByText('2 profissionais')).toBeVisible();
    await expect(page.getByText('1 paciente')).toBeVisible();
    const gestaoUsuarios = page.locator('#gestao-usuarios');
    await expect(gestaoUsuarios.getByRole('heading', { name: 'Gerenciar usuários' })).toBeVisible();
    await expect(gestaoUsuarios.getByRole('button', { name: 'Convidar usuário' })).toBeVisible();
    await expect(gestaoUsuarios.getByText('Link de primeiro acesso enviado por email')).toBeVisible();
    await expect(gestaoUsuarios.getByText('Senha inicial')).toHaveCount(0);
    await expect(gestaoUsuarios.getByText('gestor@octaclin.local')).toBeVisible();
    await expect(gestaoUsuarios.locator('span').filter({ hasText: 'agenda@octaclin.local' })).toBeVisible();
    await expect(gestaoUsuarios.getByLabel('Permissão de agenda@octaclin.local')).toHaveValue('Collaborator');
    const convitesUsuarios = page.locator('#convites-usuarios');
    await expect(convitesUsuarios.getByRole('heading', { name: 'Convites pendentes' })).toBeVisible();
    await expect(convitesUsuarios.getByText('agenda@octaclin.local')).toBeVisible();
    await expect(convitesUsuarios.getByText('Expira em 29/07/26')).toBeVisible();
    await expect(convitesUsuarios.getByRole('button', { name: 'Reenviar convite para agenda@octaclin.local' })).toBeVisible();
    await expect(convitesUsuarios.getByRole('button', { name: 'Revogar convite de agenda@octaclin.local' })).toBeVisible();
    const historicoConvites = page.locator('#historico-convites');
    await expect(historicoConvites.getByRole('heading', { name: 'Histórico de convites' })).toBeVisible();
    await expect(historicoConvites.getByRole('link', { name: 'Exportar CSV' })).toHaveAttribute(
      'href',
      '/api/cliente/usuarios/convites/historico/exportar.csv'
    );
    await expect(historicoConvites.getByText('3 eventos de convite')).toBeVisible();
    await expect(historicoConvites.getByText('prof@octaclin.local')).toBeVisible();
    await expect(historicoConvites.getByText('Usado em 24/07/26')).toBeVisible();
    await expect(historicoConvites.getByText('Convite reenviado', { exact: true })).toBeVisible();
    await expect(historicoConvites.getByText('Convite revogado', { exact: true })).toBeVisible();
    await expect(page.getByText('Acesso profissional separado')).toBeVisible();

    await areas.getByRole('tab', { name: 'Assinatura' }).click();
    const assinatura = page.locator('#assinatura');
    await expect(assinatura.getByText('Profissional')).toBeVisible();
    await expect(assinatura.getByText('Renova em 22/08/26')).toBeVisible();
    await expect(assinatura.getByText('Plano recomendado')).toBeVisible();
    await expect(assinatura.locator('p').filter({ hasText: /^Clínica$/ })).toBeVisible();
    await expect(assinatura.getByRole('button', { name: 'Solicitar upgrade para Clínica' })).toBeVisible();
    await expect(assinatura.getByRole('button', { name: 'Pedir revisão de limite' })).toBeVisible();
    await assinatura.getByRole('button', { name: 'Solicitar upgrade para Clínica' }).click();
    await expect(assinatura.getByText('Solicitação de upgrade enviada.')).toBeVisible();

    await areas.getByRole('tab', { name: 'Consumo' }).click();
    await expect(assinatura.getByText('Usuários administrativos', { exact: true })).toBeVisible();
    await expect(assinatura.getByText('3 / 3')).toBeVisible();
    await expect(assinatura.getByText('Limite atingido')).toBeVisible();
    await expect(assinatura.getByText('Mensagens no mês')).toBeVisible();
    await expect(assinatura.getByText('790 / 1000')).toBeVisible();

    await areas.getByRole('tab', { name: 'Preferências' }).click();
    const configuracoes = page.locator('#configuracoes');
    await expect(configuracoes.getByRole('heading', { name: 'Preferências da conta' })).toBeVisible();
    await expect(configuracoes.getByLabel('Nome da clínica')).toHaveValue('Clínica Octa Real');
    await expect(configuracoes.getByLabel('Timezone')).toHaveValue('America/Sao_Paulo');
    await expect(configuracoes.getByLabel('Idioma')).toHaveValue('pt-BR');
    await configuracoes.getByRole('button', { name: 'Salvar configurações' }).click();
    await expect(configuracoes.getByText('Configurações salvas.')).toBeVisible();

    await areas.getByRole('tab', { name: 'Marca' }).click();
    await expect(configuracoes.getByLabel('Email remetente')).toHaveValue('contato@octaclin.com.br');
    await configuracoes.getByLabel('Nome exibido').fill('Octa Prime');
    await configuracoes.getByRole('button', { name: 'Salvar configurações' }).click();

    await areas.getByRole('tab', { name: 'Integrações' }).click();
    await expect(configuracoes.getByRole('checkbox', { name: 'Email' })).toBeChecked();
    await expect(configuracoes.getByRole('checkbox', { name: 'WhatsApp' })).toBeChecked();
    await configuracoes.getByRole('checkbox', { name: 'WhatsApp' }).uncheck();
    await configuracoes.getByRole('button', { name: 'Salvar configurações' }).click();
    await expect(configuracoes.getByText('Configurações salvas.')).toBeVisible();

    await areas.getByRole('tab', { name: 'Dados fiscais' }).click();
    const perfilFiscal = page.locator('#perfil-fiscal');
    await expect(perfilFiscal.getByRole('heading', { name: 'Perfil fiscal' })).toBeVisible();
    await expect(perfilFiscal.getByLabel('Tipo de pessoa')).toHaveValue('pj');
    await expect(perfilFiscal.getByLabel('Documento fiscal')).toHaveValue('12.345.678/0001-90');
    await expect(perfilFiscal.getByLabel('Nome legal')).toHaveValue('OctaClin Consultoria LTDA');
    await expect(perfilFiscal.getByRole('textbox', { name: 'Responsável', exact: true })).toHaveValue('Carla Octa');
    await expect(perfilFiscal.getByLabel('Email do responsável')).toHaveValue('carla@octaclin.com.br');
    await expect(perfilFiscal.getByLabel('Cidade')).toHaveValue('Sao Paulo');
    await expect(perfilFiscal.getByLabel('UF')).toHaveValue('SP');
    await expect(perfilFiscal.getByLabel('Email financeiro')).toHaveValue('financeiro@octaclin.com.br');
    await perfilFiscal.getByLabel('Nome fantasia').fill('OctaClin Fiscal');
    await perfilFiscal.getByLabel('Observações fiscais').fill('Recibos por consulta paga.');
    await perfilFiscal.getByRole('button', { name: 'Salvar perfil fiscal' }).click();
    await expect(perfilFiscal.getByText('Perfil fiscal salvo.')).toBeVisible();
    await expect(page.getByText('Portal do paciente')).toHaveCount(0);
    await expect(page.getByText('Console clínico')).toHaveCount(0);
    await assertSemOverflowHorizontal(page);

    const screenshot = await page.screenshot({ fullPage: true });
    await testInfo.attach(`${testInfo.project.name}-portal-cliente.png`, { body: screenshot, contentType: 'image/png' });
  });

  test('exibe bloqueio suave quando assinatura esta suspensa', async ({ page }) => {
    await prepararSessaoCliente(page, { statusAssinatura: 'suspensa' });
    await page.goto('/cliente');

    const areas = page.getByRole('tablist', { name: 'Áreas da conta' });
    await areas.getByRole('tab', { name: 'Assinatura' }).click();
    const assinatura = page.locator('#assinatura');
    await expect(assinatura.getByText('Assinatura suspensa.')).toBeVisible();
    await expect(assinatura.getByText('Novas ações estao bloqueadas, mas os dados existentes continuam disponíveis.')).toBeVisible();
    await areas.getByRole('tab', { name: 'Equipe' }).click();
    await expect(page.locator('#gestao-usuarios').getByRole('button', { name: 'Assinatura bloqueada' })).toBeDisabled();
    await assertSemOverflowHorizontal(page);
  });

  test('exibe dados clinicos ao convidar um profissional', async ({ page }) => {
    await prepararSessaoCliente(page);
    await page.goto('/cliente');

    await page.getByRole('tablist', { name: 'Áreas da conta' }).getByRole('tab', { name: 'Equipe' }).click();
    const gestaoUsuarios = page.locator('#gestao-usuarios');
    await gestaoUsuarios.getByLabel('Papel').selectOption('Professional');

    await expect(gestaoUsuarios.getByLabel('Nome do profissional')).toBeVisible();
    await expect(gestaoUsuarios.getByLabel('Nome do profissional')).toHaveAttribute('required', '');
    await expect(gestaoUsuarios.getByLabel('Registro profissional')).toBeVisible();
    await expect(gestaoUsuarios.getByLabel('Especialidade')).toBeVisible();
    await expect(
      gestaoUsuarios.getByText('O convite também cria o perfil clínico e libera a agenda pessoal após o primeiro acesso.')
    ).toBeVisible();
    await assertSemOverflowHorizontal(page);
  });
});
