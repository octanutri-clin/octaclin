import { ControladorOperacoes } from './controlador-operacoes';
import { CHAVE_PERMISSOES } from '../../auth/apresentacao/decorators';
import { ServicoAuditoria } from '../../../infraestrutura/auditoria/servico-auditoria';

describe('ControladorOperacoes', () => {
  it('deve expor alertas operacionais do tenant autenticado', async () => {
    const servicoOperacoes = {
      listarAlertasOperacionais: jest.fn(async () => ({ status: 'atencao', itens: [] }))
    };
    const controlador = new ControladorOperacoes(servicoOperacoes as never, {} as never, {} as never, {} as never, {} as never, {} as never);

    await expect(
      controlador.listarAlertasOperacionais({
        tenantId: 'tenant-1',
        usuarioId: 'admin-1',
        papel: 'SuperAdmin',
        emailHash: 'hash',
        permissoes: []
      })
    ).resolves.toEqual({ status: 'atencao', itens: [] });
    expect(servicoOperacoes.listarAlertasOperacionais).toHaveBeenCalledWith('tenant-1');
  });

  it('deve exigir leitura para o painel e escrita para reprocessamentos', () => {
    expect(Reflect.getMetadata(CHAVE_PERMISSOES, ControladorOperacoes)).toEqual(['operacoes.auditoria.ler']);
    expect(Reflect.getMetadata(CHAVE_PERMISSOES, ControladorOperacoes.prototype.reprocessarOutbox)).toEqual([
      'operacoes.outbox.reprocessar'
    ]);
    expect(Reflect.getMetadata(CHAVE_PERMISSOES, ControladorOperacoes.prototype.reprocessarFalhaComunicacao)).toEqual([
      'operacoes.outbox.reprocessar'
    ]);
    expect(Reflect.getMetadata(CHAVE_PERMISSOES, ControladorOperacoes.prototype.provisionarTenant)).toEqual([
      'operacoes.tenants.gerenciar'
    ]);
    expect(Reflect.getMetadata(CHAVE_PERMISSOES, ControladorOperacoes.prototype.atualizarFeatureFlags)).toEqual([
      'operacoes.tenants.gerenciar'
    ]);
  });

  it('deve expor rollout e alterar flags somente pelo tenant alvo informado', async () => {
    const rollout = { obter: jest.fn(async () => ({ status: 'ok' })) };
    const flags = {
      listar: jest.fn(async () => ({ configuracaoValida: true, flags: [] })),
      atualizar: jest.fn(async () => ({ configuracaoValida: true, flags: [] }))
    };
    const auditoria = { registrar: jest.fn(async () => undefined) };
    const controlador = new ControladorOperacoes({} as never, {} as never, auditoria as never, rollout as never, flags as never, {} as never);
    const usuario = {
      tenantId: '00000000-0000-4000-8000-000000000001',
      usuarioId: 'admin-1',
      papel: 'SuperAdmin' as const,
      emailHash: 'hash',
      permissoes: []
    };

    await expect(controlador.obterRollout(usuario)).resolves.toEqual({ status: 'ok' });
    expect(rollout.obter).toHaveBeenCalledWith(usuario.tenantId);

    await controlador.atualizarFeatureFlags(usuario, { ip: '127.0.0.1', headers: {} } as never, {
      tenantId: '00000000-0000-4000-8000-000000000002',
      iaClinica: true,
      mobileSync: false
    });
    expect(flags.atualizar).toHaveBeenCalledWith('00000000-0000-4000-8000-000000000002', {
      'ia.clinica': true,
      'mobile.sync': false
    });
    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: usuario.tenantId,
        recursoId: '00000000-0000-4000-8000-000000000002',
        acao: 'operacoes.feature_flags.atualizar'
      })
    );
  });

  it('deve reavaliar o menor privilegio dos providers a cada chamada, e nao devolver cache do boot', async () => {
    const menorPrivilegio = {
      avaliar: jest.fn(async () => ({ veredicto: 'conforme' })),
      obterUltimoRelatorio: jest.fn(() => ({ veredicto: 'violado' }))
    };
    const controlador = new ControladorOperacoes(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      menorPrivilegio as never
    );

    await expect(controlador.obterMenorPrivilegioProviders()).resolves.toEqual({ veredicto: 'conforme' });
    expect(menorPrivilegio.avaliar).toHaveBeenCalledTimes(1);
    expect(menorPrivilegio.obterUltimoRelatorio).not.toHaveBeenCalled();
  });

  describe('trilha das mutacoes e exportacoes', () => {
    const usuario = {
      tenantId: '00000000-0000-4000-8000-000000000001',
      usuarioId: 'admin-1',
      papel: 'SuperAdmin' as const,
      emailHash: 'hash',
      permissoes: []
    };
    const requisicao = { ip: '198.51.100.7', headers: { 'user-agent': 'console-sintetico' } } as never;

    const montar = (servicoOperacoes: Record<string, unknown>) => {
      const auditoria = { registrar: jest.fn(async (_entrada: Record<string, unknown>) => undefined) };
      const controlador = new ControladorOperacoes(
        servicoOperacoes as never,
        {} as never,
        auditoria as never,
        {} as never,
        {} as never,
        {} as never
      );
      return { controlador, auditoria };
    };

    /** Primeiro (e unico) argumento da primeira chamada de `registrar`. */
    const entradaAuditoria = (auditoria: { registrar: jest.Mock }): Record<string, unknown> =>
      auditoria.registrar.mock.calls[0][0];

    it('registra o reprocessamento de outbox, hoje sem rastro nenhum', async () => {
      const { controlador, auditoria } = montar({
        reprocessarOutbox: jest.fn(async () => ({ id: 'evento-1', tipo: 'mensagem.enviar', status: 'pendente', tentativas: 3 }))
      });

      await controlador.reprocessarOutbox(usuario, requisicao, 'evento-1');

      expect(entradaAuditoria(auditoria)).toMatchObject({
        tenantId: usuario.tenantId,
        usuarioId: usuario.usuarioId,
        acao: 'operacoes.outbox.reprocessar',
        recursoTipo: 'outbox_evento',
        recursoId: 'evento-1',
        ip: '198.51.100.7',
        userAgent: 'console-sintetico',
        metadados: { tipo: 'mensagem.enviar', status: 'pendente', tentativas: 3 }
      });
    });

    it('registra o reprocessamento de falha de comunicacao sem levar a mensagem de erro do provedor', async () => {
      const { controlador, auditoria } = montar({
        reprocessarFalhaComunicacao: jest.fn(async () => ({
          id: 'outbox:evento-1',
          origem: 'outbox',
          canal: 'whatsapp',
          tipo: 'mensagem.enviar',
          referenciaId: 'evento-1',
          pacienteId: '11111111-1111-4111-8111-111111111111',
          erro: 'Meta API: invalid recipient 5511999999999',
          tentativas: 2,
          criadoEm: new Date('2026-01-01T00:00:00.000Z'),
          reprocessavel: true
        }))
      });

      await controlador.reprocessarFalhaComunicacao(usuario, requisicao, 'outbox:evento-1');

      const entrada = entradaAuditoria(auditoria);
      expect(entrada).toMatchObject({
        acao: 'operacoes.comunicacoes_falha.reprocessar',
        recursoTipo: 'falha_comunicacao',
        recursoId: 'outbox:evento-1',
        metadados: { origem: 'outbox', canal: 'whatsapp', referenciaId: 'evento-1' }
      });
      expect(JSON.stringify(entrada)).not.toContain('5511999999999');
      expect(JSON.stringify(entrada)).not.toContain('Meta API');
    });

    it('registra a aplicacao manual de plano sem copiar a observacao do operador', async () => {
      const { controlador, auditoria } = montar({
        aplicarPlanoAssinatura: jest.fn(async () => ({
          tenantId: usuario.tenantId,
          planoId: 'clinica',
          plano: 'Clinica',
          status: 'ativa',
          origem: 'operacao_manual',
          atualizadoPorUsuarioId: usuario.usuarioId,
          atualizadoEm: '2026-01-01T00:00:00.000Z'
        }))
      });

      await controlador.aplicarPlanoAssinatura(usuario, requisicao, {
        planoId: 'clinica',
        observacao: 'Negociado por telefone com a dra. Sintetica.'
      });

      const entrada = entradaAuditoria(auditoria);
      expect(entrada).toMatchObject({
        acao: 'operacoes.assinatura.aplicar_plano',
        metadados: { planoId: 'clinica', status: 'ativa', origem: 'operacao_manual', houveTextoLivre: true }
      });
      expect(JSON.stringify(entrada)).not.toContain('Negociado por telefone');
    });

    it('registra a programacao de retencao de dados', async () => {
      const { controlador, auditoria } = montar({
        programarRetencaoDados: jest.fn(async () => ({
          protocolo: 'RET-2026-0001',
          status: 'programada',
          programadoEm: new Date('2026-01-01T00:00:00.000Z'),
          totalItensVencidos: 42,
          resumo: { totalVencidos: 42 }
        }))
      });

      await controlador.programarRetencaoDados(usuario, requisicao);

      expect(entradaAuditoria(auditoria)).toMatchObject({
        acao: 'operacoes.lgpd_retencao.programar',
        recursoTipo: 'retencao_dados',
        recursoId: 'RET-2026-0001',
        metadados: { protocolo: 'RET-2026-0001', status: 'programada', totalItensVencidos: 42 }
      });
    });

    it('registra a mudanca de status da solicitacao LGPD sem levar a tratativa escrita', async () => {
      const { controlador, auditoria } = montar({
        atualizarSolicitacaoLgpd: jest.fn(async () => ({
          protocolo: 'LGPD-2026-0007',
          pacienteId: '11111111-1111-4111-8111-111111111111',
          usuarioPacienteId: '22222222-2222-4222-8222-222222222222',
          tipo: 'exclusao',
          status: 'concluida',
          abertoEm: new Date('2026-01-01T00:00:00.000Z'),
          atualizadoEm: new Date('2026-01-02T00:00:00.000Z')
        }))
      });

      await controlador.atualizarSolicitacaoLgpd(usuario, requisicao, 'LGPD-2026-0007', {
        status: 'concluida',
        detalhes: 'Prontuario da paciente Sintetica excluido conforme pedido.'
      });

      const entrada = entradaAuditoria(auditoria);
      expect(entrada).toMatchObject({
        acao: 'operacoes.lgpd_solicitacao.atualizar_status',
        recursoTipo: 'solicitacao_lgpd',
        recursoId: 'LGPD-2026-0007',
        metadados: { status: 'concluida', tipo: 'exclusao', detalhesInformados: true }
      });
      expect(JSON.stringify(entrada)).not.toContain('Prontuario da paciente');
    });

    it('registra a preparacao de resposta LGPD sem copiar o texto enviado ao titular', async () => {
      const { controlador, auditoria } = montar({
        prepararRespostaSolicitacaoLgpd: jest.fn(async () => ({
          protocolo: 'LGPD-2026-0007',
          pacienteId: '11111111-1111-4111-8111-111111111111',
          status: 'concluida',
          assuntoEmail: 'Resposta a sua solicitacao LGPD',
          corpoEmail: 'Prezada Sintetica, seus dados clinicos foram excluidos.',
          textoWhatsapp: 'Ola Sintetica, sua solicitacao foi concluida.',
          canaisSugeridos: ['email', 'whatsapp'],
          geradoEm: new Date('2026-01-02T00:00:00.000Z')
        }))
      });

      await controlador.prepararRespostaSolicitacaoLgpd(usuario, requisicao, 'LGPD-2026-0007');

      const entrada = entradaAuditoria(auditoria);
      expect(entrada).toMatchObject({
        acao: 'operacoes.lgpd_solicitacao.preparar_resposta',
        metadados: { protocolo: 'LGPD-2026-0007', status: 'concluida', canaisSugeridos: ['email', 'whatsapp'] }
      });
      const serializada = JSON.stringify(entrada);
      expect(serializada).not.toContain('Prezada Sintetica');
      expect(serializada).not.toContain('Ola Sintetica');
      expect(serializada).not.toContain('Resposta a sua solicitacao');
    });

    it('registra volume e filtros da exportacao da propria trilha, e nunca as linhas exportadas', async () => {
      const csv = [
        'criadoEm,acao,recursoTipo,recursoId,usuarioId,ip,metadados',
        '2026-01-01T00:00:00.000Z,pacientes.abrir,paciente,pac-1,prof-1,203.0.113.9,marcador-sintetico-do-conteudo',
        '2026-01-01T01:00:00.000Z,pacientes.abrir,paciente,pac-2,prof-1,203.0.113.9,marcador-sintetico-do-conteudo'
      ].join('\n') + '\n';
      const { controlador, auditoria } = montar({ exportarAuditoriaCsv: jest.fn(async () => csv) });

      await expect(
        controlador.exportarAuditoriaCsv(
          usuario,
          requisicao,
          undefined,
          undefined,
          undefined,
          'prof-1',
          '2026-01-01',
          '2026-01-31',
          '500'
        )
      ).resolves.toBe(csv);

      const entrada = entradaAuditoria(auditoria);
      expect(entrada).toMatchObject({
        acao: 'operacoes.auditoria.exportar_csv',
        recursoTipo: 'user_action_log',
        metadados: {
          totalLinhas: 2,
          usuarioAlvoId: 'prof-1',
          periodoInicio: '2026-01-01',
          periodoFim: '2026-01-31',
          limiteSolicitado: 500,
          semFiltro: false
        }
      });
      expect(JSON.stringify(entrada)).not.toContain('marcador-sintetico-do-conteudo');
    });

    it('marca como varredura a exportacao da trilha sem periodo nem alvo', async () => {
      const { controlador, auditoria } = montar({
        exportarAuditoriaCsv: jest.fn(async () => 'criadoEm,acao\n2026-01-01T00:00:00.000Z,pacientes.abrir\n')
      });

      await controlador.exportarAuditoriaCsv(usuario, requisicao);

      expect(entradaAuditoria(auditoria).metadados).toMatchObject({ semFiltro: true, totalLinhas: 1 });
    });

    it('registra a exportacao de falhas de outbox e do dossie LGPD sem o conteudo do arquivo', async () => {
      const csvOutbox = 'criadoEm,tipo,status,tentativas,erro,mensagemId\n2026-01-01T00:00:00.000Z,x,falhou,3,marcador-outbox,msg-1\n';
      const csvLgpd = 'protocolo,pacienteId,tipo,status,criadoEm,responsavelId,detalhes\nLGPD-1,pac-1,exclusao,concluida,2026-01-01T00:00:00.000Z,admin-1,marcador-lgpd\n';
      const { controlador, auditoria } = montar({
        exportarFalhasOutboxCsv: jest.fn(async () => csvOutbox),
        exportarSolicitacaoLgpdCsv: jest.fn(async () => csvLgpd)
      });

      await controlador.exportarFalhasOutboxCsv(usuario, requisicao, 'mensagem.enviar', '2026-01-01', '2026-01-31', '100');
      await controlador.exportarSolicitacaoLgpdCsv(usuario, requisicao, 'LGPD-1');

      expect(auditoria.registrar.mock.calls[0][0]).toMatchObject({
        acao: 'operacoes.outbox_falhas.exportar_csv',
        metadados: { totalLinhas: 1, filtroTipo: 'mensagem.enviar', periodoInicio: '2026-01-01', limiteSolicitado: 100 }
      });
      expect(auditoria.registrar.mock.calls[1][0]).toMatchObject({
        acao: 'operacoes.lgpd_solicitacao.exportar_csv',
        recursoTipo: 'solicitacao_lgpd',
        metadados: { totalLinhas: 1, protocolo: 'LGPD-1' }
      });
      const serializada = JSON.stringify(auditoria.registrar.mock.calls);
      expect(serializada).not.toContain('marcador-outbox');
      expect(serializada).not.toContain('marcador-lgpd');
    });

    it('nao deixa a trilha indisponivel derrubar a rota de operacao', async () => {
      // Aqui entra o `ServicoAuditoria` de verdade, com o executor de banco
      // falhando: o duble `jest.fn()` dos outros testes provaria apenas que o
      // controlador chama o servico, e nao que a rota sobrevive a trilha fora
      // do ar -- que e a propriedade que este gate precisa garantir. Registrar
      // o acesso nao pode impedir a operacao.
      const executorTenant = {
        executar: jest.fn(async () => {
          throw new Error('trilha indisponivel');
        })
      };
      const auditoria = new ServicoAuditoria(executorTenant as never);
      const csv = 'criadoEm,acao\n2026-01-01T00:00:00.000Z,pacientes.abrir\n';
      const servicoOperacoes = {
        exportarAuditoriaCsv: jest.fn(async () => csv),
        reprocessarOutbox: jest.fn(async () => ({ id: 'evento-1', tipo: 'x', status: 'pendente', tentativas: 1 }))
      };
      const controlador = new ControladorOperacoes(
        servicoOperacoes as never,
        {} as never,
        auditoria,
        {} as never,
        {} as never,
        {} as never
      );

      await expect(controlador.exportarAuditoriaCsv(usuario, requisicao)).resolves.toBe(csv);
      await expect(controlador.reprocessarOutbox(usuario, requisicao, 'evento-1')).resolves.toMatchObject({
        id: 'evento-1'
      });
      expect(auditoria.obterTotalFalhas()).toBe(2);
    });
  });
});
