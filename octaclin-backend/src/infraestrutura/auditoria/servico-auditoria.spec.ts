import { Logger } from '@nestjs/common';
import { OutboxEventoOrm } from '../outbox/outbox-evento.orm';
import { MARCADOR_REDIGIDO } from './redacao-auditoria';
import {
  obterTotalFalhasAuditoria,
  registrarAuditoriaNaTransacao,
  ServicoAuditoria,
  zerarTotalFalhasAuditoriaParaTeste
} from './servico-auditoria';
import { UserActionLogOrm } from './user-action-log.orm';

/** Ver a nota em `redacao-auditoria.spec.ts`: valor sintetico composto para nao reprovar `security:secrets`. */
const SENHA_SINTETICA = ['Tr0vao', 'Vermelho', '2026'].join('#');
const EMAIL_SINTETICO = ['paciente.teste', 'exemplo.invalido'].join('@');

/**
 * Dubles manuais compartilhados pelos casos que precisam inspecionar o
 * argumento que chega a camada de persistencia.
 */
function montarDubles() {
  const repositorio = {
    create: jest.fn((dados: Record<string, unknown>) => ({ persistido: true, ...dados })),
    save: jest.fn(async () => undefined)
  };
  const gerenciador = { getRepository: jest.fn().mockReturnValue(repositorio) };
  const executorTenant = {
    executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
      operacao(gerenciador)
    )
  };

  return { repositorio, gerenciador, executorTenant };
}

function metadadosPersistidos(repositorio: { create: jest.Mock }): Record<string, unknown> {
  return (repositorio.create.mock.calls[0][0] as { metadados: Record<string, unknown> }).metadados;
}

/**
 * Dubles com dois repositorios distintos, roteados por entidade -- os testes
 * de outbox precisam inspecionar `UserActionLogOrm` e `OutboxEventoOrm` em
 * separado, ao contrario de `montarDubles`, que sempre devolve o mesmo.
 */
function montarDublesComOutbox() {
  const repositorioTrilha = {
    create: jest.fn((dados: Record<string, unknown>) => ({ persistido: true, ...dados })),
    save: jest.fn(async () => undefined)
  };
  const repositorioOutbox = {
    create: jest.fn((dados: Record<string, unknown>) => ({ id: 'outbox-1', tentativas: 0, ...dados })),
    save: jest.fn(async () => undefined),
    find: jest.fn(async (): Promise<Record<string, unknown>[]> => []),
    update: jest.fn(async () => ({ affected: 1 }))
  };
  const gerenciador = {
    getRepository: jest.fn((entidade: unknown) =>
      entidade === OutboxEventoOrm ? repositorioOutbox : repositorioTrilha
    )
  };
  const executorTenant = {
    executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
      operacao(gerenciador)
    )
  };

  return { repositorioTrilha, repositorioOutbox, gerenciador, executorTenant };
}

describe('ServicoAuditoria', () => {
  // O contador vive no modulo, e nao na instancia (ver a justificativa la). O
  // preco disso e que os casos deste arquivo compartilham estado; o reset
  // explicito deixa esse acoplamento a vista em vez de escondido atras de um
  // `new ServicoAuditoria` que parecia isolar e nao isolava.
  beforeEach(() => {
    zerarTotalFalhasAuditoriaParaTeste();
  });

  it('deve registrar evento no contexto do tenant', async () => {
    const repositorio = {
      create: jest.fn((dados: Record<string, unknown>) => ({ persistido: true, ...dados })),
      save: jest.fn(async () => undefined)
    };
    const gerenciador = {
      getRepository: jest.fn().mockReturnValue(repositorio)
    };
    const executorTenant = {
      executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
        operacao(gerenciador)
      )
    };
    const servico = new ServicoAuditoria(executorTenant as never);

    await servico.registrar({
      tenantId: 'tenant-1',
      usuarioId: 'usuario-1',
      acao: 'pacientes.obter_dados_sensiveis',
      recursoTipo: 'paciente',
      recursoId: 'paciente-1',
      ip: '127.0.0.1',
      userAgent: 'jest',
      requestId: 'req-123',
      metadados: { origem: 'teste' }
    });

    expect(executorTenant.executar).toHaveBeenCalledWith('tenant-1', expect.any(Function));
    expect(gerenciador.getRepository).toHaveBeenCalledWith(UserActionLogOrm);
    expect(repositorio.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        usuarioId: 'usuario-1',
        acao: 'pacientes.obter_dados_sensiveis',
        recursoTipo: 'paciente',
        recursoId: 'paciente-1',
        ip: '127.0.0.1',
        userAgent: 'jest',
        metadados: { origem: 'teste', requestId: 'req-123' }
      })
    );
    expect(repositorio.save).toHaveBeenCalledWith(expect.objectContaining({ persistido: true }));
  });

  it('nao deve propagar falha de auditoria para o fluxo principal', async () => {
    const loggerWarn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const executorTenant = {
      executar: jest.fn(async () => {
        throw new Error('banco indisponivel');
      })
    };
    const servico = new ServicoAuditoria(executorTenant as never);

    await expect(
      servico.registrar({
        tenantId: 'tenant-1',
        acao: 'profissionais.listar_dados_sensiveis'
      })
    ).resolves.toBeUndefined();

    expect(loggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        evento: 'auditoria.falha',
        tenantId: 'tenant-1',
        acao: 'profissionais.listar_dados_sensiveis',
        erroNome: 'Error'
      })
    );
    expect(JSON.stringify(loggerWarn.mock.calls[0][0])).not.toContain('banco indisponivel');
    loggerWarn.mockRestore();
  });

  it('deve redigir metadados sensiveis antes de entregar a camada de persistencia', async () => {
    const { repositorio, executorTenant } = montarDubles();
    const servico = new ServicoAuditoria(executorTenant as never);

    await servico.registrar({
      tenantId: 'tenant-1',
      acao: 'auth.login',
      metadados: {
        senha: SENHA_SINTETICA,
        contato: { email: EMAIL_SINTETICO },
        usuarioAlvoId: 'usuario-9',
        origem: 'teste'
      }
    });

    const metadados = metadadosPersistidos(repositorio);
    expect(metadados).toEqual({
      senha: MARCADOR_REDIGIDO,
      contato: { email: MARCADOR_REDIGIDO },
      usuarioAlvoId: 'usuario-9',
      origem: 'teste'
    });
    // A prova do gate: o valor original nao existe em ponto algum do payload.
    expect(JSON.stringify(metadados)).not.toContain(SENHA_SINTETICA);
    expect(JSON.stringify(metadados)).not.toContain(EMAIL_SINTETICO);
  });

  it('deve preservar o requestId, que e a correlacao util da trilha', async () => {
    const { repositorio, executorTenant } = montarDubles();
    const servico = new ServicoAuditoria(executorTenant as never);

    await servico.registrar({
      tenantId: 'tenant-1',
      acao: 'auth.login',
      requestId: 'req-123',
      metadados: { senha: SENHA_SINTETICA }
    });

    expect(metadadosPersistidos(repositorio)).toEqual({ senha: MARCADOR_REDIGIDO, requestId: 'req-123' });
  });

  it('deve acumular contador de falhas sem propagar erro ao fluxo principal', async () => {
    const loggerWarn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const executorTenant = {
      executar: jest.fn(async () => {
        throw new Error('banco indisponivel');
      })
    };
    const servico = new ServicoAuditoria(executorTenant as never);

    expect(servico.obterTotalFalhas()).toBe(0);

    await servico.registrar({ tenantId: 'tenant-1', acao: 'auth.login' });
    await servico.registrar({ tenantId: 'tenant-1', acao: 'auth.sessao.encerrada' });

    expect(servico.obterTotalFalhas()).toBe(2);
    expect(loggerWarn).toHaveBeenLastCalledWith(expect.objectContaining({ totalFalhas: 2 }));
    loggerWarn.mockRestore();
  });

  it('nao deve contar falha quando a gravacao da trilha funciona', async () => {
    const { executorTenant } = montarDubles();
    const servico = new ServicoAuditoria(executorTenant as never);

    await servico.registrar({ tenantId: 'tenant-1', acao: 'auth.login' });

    expect(servico.obterTotalFalhas()).toBe(0);
  });

  /**
   * `ServicoAuditoria` esta em `providers` de 15 modulos, e o Nest cria uma
   * instancia por modulo que o declara. Com o contador em campo de instancia,
   * cada uma contava as suas falhas e o alarme da fase 3 leria cerca de um
   * quinze avos do total -- uma queda geral de gravacao apareceria abaixo de
   * qualquer limiar util.
   *
   * O teste antigo passava porque usava uma instancia so, que e exatamente o
   * cenario que nao existe em producao. Este usa duas.
   */
  it('deve compartilhar o contador de falhas entre instancias, como o processo faz', async () => {
    const loggerWarn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const executorTenant = {
      executar: jest.fn(async () => {
        throw new Error('banco indisponivel');
      })
    };
    const primeira = new ServicoAuditoria(executorTenant as never);
    const segunda = new ServicoAuditoria(executorTenant as never);

    await primeira.registrar({ tenantId: 'tenant-1', acao: 'auth.login' });
    await segunda.registrar({ tenantId: 'tenant-2', acao: 'pacientes.listar' });

    expect(primeira.obterTotalFalhas()).toBe(2);
    expect(segunda.obterTotalFalhas()).toBe(2);
    expect(obterTotalFalhasAuditoria()).toBe(2);
    loggerWarn.mockRestore();
  });
});

/**
 * Segundo caminho de escrita da trilha, para quem ja esta dentro de uma
 * transacao. Ele existe porque quatro escritas em `planos-alimentares` rodam
 * sob `pessimistic_write` e nao podem abrir uma segunda transacao; o que estes
 * casos provam e que ele nao virou uma porta dos fundos sem filtro.
 */
describe('registrarAuditoriaNaTransacao', () => {
  it('deve aplicar a mesma redacao do servico antes de persistir', async () => {
    const { repositorio, gerenciador } = montarDubles();

    await registrarAuditoriaNaTransacao(gerenciador as never, {
      tenantId: 'tenant-1',
      usuarioId: 'usuario-1',
      acao: 'planos_alimentares.publicar',
      recursoTipo: 'plano_alimentar',
      recursoId: 'plano-1',
      metadados: { hashConteudo: 'a'.repeat(64), versaoId: 'versao-1', senha: SENHA_SINTETICA }
    });

    expect(gerenciador.getRepository).toHaveBeenCalledWith(UserActionLogOrm);
    expect(metadadosPersistidos(repositorio)).toEqual({
      hashConteudo: MARCADOR_REDIGIDO,
      versaoId: 'versao-1',
      senha: MARCADOR_REDIGIDO
    });
    expect(JSON.stringify(repositorio.create.mock.calls[0][0])).not.toContain(SENHA_SINTETICA);
  });

  it('deve propagar a falha, porque a trilha faz parte da transacao de negocio', async () => {
    const repositorio = {
      create: jest.fn((dados: Record<string, unknown>) => dados),
      save: jest.fn(async () => {
        throw new Error('banco indisponivel');
      })
    };
    const gerenciador = { getRepository: jest.fn().mockReturnValue(repositorio) };

    // Diferenca deliberada em relacao a `registrar`, que engole: aqui, engolir
    // produziria uma publicacao comitada sem trilha.
    await expect(
      registrarAuditoriaNaTransacao(gerenciador as never, { tenantId: 'tenant-1', acao: 'planos_alimentares.publicar' })
    ).rejects.toThrow('banco indisponivel');
  });
});

/**
 * Piloto da Fase 260: retentativa via outbox para os pontos de leitura de PHI
 * (prontuario, documentos clinicos, evolucoes), restrita a quem passa
 * `garantirRetentativa: true`. Os 97 demais call sites de `registrar` nao
 * mudam de comportamento -- os testes acima ja provam isso, sem o campo.
 */
describe('registrar com garantirRetentativa', () => {
  beforeEach(() => {
    zerarTotalFalhasAuditoriaParaTeste();
  });

  it('nao tenta o outbox quando garantirRetentativa nao foi pedido', async () => {
    const loggerWarn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const executorTenant = {
      executar: jest.fn(async () => {
        throw new Error('banco indisponivel');
      })
    };
    const servico = new ServicoAuditoria(executorTenant as never);

    await servico.registrar({ tenantId: 'tenant-1', acao: 'pacientes.prontuario.ler' });

    expect(executorTenant.executar).toHaveBeenCalledTimes(1);
    expect(servico.obterTotalFalhas()).toBe(1);
    expect(servico.obterTotalEnfileiradosOutbox()).toBe(0);
    loggerWarn.mockRestore();
  });

  it('enfileira no outbox quando a escrita direta falha e nao conta como falha definitiva', async () => {
    const loggerWarn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const { repositorioOutbox, executorTenant } = montarDublesComOutbox();
    let chamadas = 0;
    executorTenant.executar.mockImplementation((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) => {
      chamadas += 1;
      if (chamadas === 1) throw new Error('banco indisponivel');
      return operacao({ getRepository: jest.fn(() => repositorioOutbox) });
    });
    const servico = new ServicoAuditoria(executorTenant as never);

    await servico.registrar({
      tenantId: 'tenant-1',
      usuarioId: 'usuario-1',
      acao: 'pacientes.prontuario.ler',
      recursoTipo: 'paciente',
      recursoId: 'paciente-1',
      requestId: 'req-123',
      garantirRetentativa: true,
      metadados: { senha: SENHA_SINTETICA, eventos: 5 }
    });

    expect(executorTenant.executar).toHaveBeenCalledTimes(2);
    expect(repositorioOutbox.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        tipo: 'auditoria.pendente',
        payload: expect.objectContaining({
          tenantId: 'tenant-1',
          usuarioId: 'usuario-1',
          acao: 'pacientes.prontuario.ler',
          recursoTipo: 'paciente',
          recursoId: 'paciente-1',
          metadados: { senha: MARCADOR_REDIGIDO, eventos: 5, requestId: 'req-123' }
        })
      })
    );
    expect(JSON.stringify(repositorioOutbox.create.mock.calls[0][0])).not.toContain(SENHA_SINTETICA);
    expect(servico.obterTotalFalhas()).toBe(0);
    expect(servico.obterTotalEnfileiradosOutbox()).toBe(1);
    expect(loggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({ evento: 'auditoria.enfileirada_outbox', totalEnfileirados: 1 })
    );
    loggerWarn.mockRestore();
  });

  it('conta como falha definitiva quando a escrita direta e o outbox falham', async () => {
    const loggerWarn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const executorTenant = {
      executar: jest.fn(async () => {
        throw new Error('banco indisponivel');
      })
    };
    const servico = new ServicoAuditoria(executorTenant as never);

    await servico.registrar({
      tenantId: 'tenant-1',
      acao: 'pacientes.prontuario.ler',
      garantirRetentativa: true
    });

    expect(executorTenant.executar).toHaveBeenCalledTimes(2);
    expect(servico.obterTotalFalhas()).toBe(1);
    expect(servico.obterTotalEnfileiradosOutbox()).toBe(0);
    expect(loggerWarn).toHaveBeenLastCalledWith(expect.objectContaining({ evento: 'auditoria.falha' }));
    loggerWarn.mockRestore();
  });
});

describe('processarOutboxPendente', () => {
  beforeEach(() => {
    zerarTotalFalhasAuditoriaParaTeste();
  });

  it('grava a linha da trilha e marca o evento como processado', async () => {
    const { repositorioTrilha, repositorioOutbox, executorTenant } = montarDublesComOutbox();
    const evento = {
      id: 'outbox-1',
      tenantId: 'tenant-1',
      tipo: 'auditoria.pendente',
      status: 'pendente',
      tentativas: 0,
      payload: {
        tenantId: 'tenant-1',
        usuarioId: 'usuario-1',
        acao: 'pacientes.prontuario.ler',
        recursoTipo: 'paciente',
        recursoId: 'paciente-1',
        metadados: { eventos: 5, requestId: 'req-123' }
      }
    };
    repositorioOutbox.find.mockResolvedValueOnce([evento]);
    const servico = new ServicoAuditoria(executorTenant as never);

    await servico.processarOutboxPendente('tenant-1');

    expect(repositorioOutbox.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'outbox-1', tenantId: 'tenant-1', status: 'pendente' }),
      { status: 'processando', tentativas: 1 }
    );
    expect(repositorioTrilha.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        usuarioId: 'usuario-1',
        acao: 'pacientes.prontuario.ler',
        recursoTipo: 'paciente',
        recursoId: 'paciente-1',
        metadados: { eventos: 5, requestId: 'req-123' }
      })
    );
    expect(repositorioOutbox.update).toHaveBeenLastCalledWith(
      { id: 'outbox-1' },
      expect.objectContaining({ status: 'processado' })
    );
    expect(servico.obterTotalFalhas()).toBe(0);
  });

  it('nao processa de novo um evento ja reivindicado por outra rodada', async () => {
    const { repositorioTrilha, repositorioOutbox, executorTenant } = montarDublesComOutbox();
    repositorioOutbox.update.mockResolvedValueOnce({ affected: 0 });
    repositorioOutbox.find.mockResolvedValueOnce([
      { id: 'outbox-1', tenantId: 'tenant-1', tentativas: 0, payload: { acao: 'pacientes.prontuario.ler' } }
    ]);
    const servico = new ServicoAuditoria(executorTenant as never);

    await servico.processarOutboxPendente('tenant-1');

    expect(repositorioTrilha.create).not.toHaveBeenCalled();
  });

  it('mantem pendente e incrementa tentativas quando a gravacao falha antes do limite', async () => {
    const { repositorioOutbox, executorTenant } = montarDublesComOutbox();
    repositorioOutbox.find.mockResolvedValueOnce([
      { id: 'outbox-1', tenantId: 'tenant-1', tentativas: 1, payload: { acao: 'pacientes.prontuario.ler' } }
    ]);
    const repositorioTrilhaFalho = {
      create: jest.fn((dados: Record<string, unknown>) => dados),
      save: jest.fn(async () => {
        throw new Error('banco indisponivel');
      })
    };
    executorTenant.executar.mockImplementation((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
      operacao({ getRepository: jest.fn((entidade: unknown) => (entidade === OutboxEventoOrm ? repositorioOutbox : repositorioTrilhaFalho)) })
    );
    const servico = new ServicoAuditoria(executorTenant as never);

    await servico.processarOutboxPendente('tenant-1');

    expect(repositorioOutbox.update).toHaveBeenLastCalledWith(
      { id: 'outbox-1' },
      expect.objectContaining({ status: 'pendente', erro: 'Error' })
    );
    expect(servico.obterTotalFalhas()).toBe(0);
  });

  it('marca falhou definitivamente e conta como falha ao esgotar as tentativas', async () => {
    const loggerWarn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const { repositorioOutbox, executorTenant } = montarDublesComOutbox();
    repositorioOutbox.find.mockResolvedValueOnce([
      { id: 'outbox-1', tenantId: 'tenant-1', tentativas: 4, payload: { acao: 'pacientes.prontuario.ler' } }
    ]);
    const repositorioTrilhaFalho = {
      create: jest.fn((dados: Record<string, unknown>) => dados),
      save: jest.fn(async () => {
        throw new Error('banco indisponivel');
      })
    };
    executorTenant.executar.mockImplementation((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
      operacao({ getRepository: jest.fn((entidade: unknown) => (entidade === OutboxEventoOrm ? repositorioOutbox : repositorioTrilhaFalho)) })
    );
    const servico = new ServicoAuditoria(executorTenant as never);

    await servico.processarOutboxPendente('tenant-1');

    expect(repositorioOutbox.update).toHaveBeenLastCalledWith(
      { id: 'outbox-1' },
      expect.objectContaining({ status: 'falhou' })
    );
    expect(servico.obterTotalFalhas()).toBe(1);
    expect(loggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({ evento: 'auditoria.outbox.falhou_definitivamente', tentativas: 5 })
    );
    loggerWarn.mockRestore();
  });
});
