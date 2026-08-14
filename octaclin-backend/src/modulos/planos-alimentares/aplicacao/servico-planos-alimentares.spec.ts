import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { UserActionLogOrm } from '../../../infraestrutura/auditoria/user-action-log.orm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { AvaliacaoAntropometricaOrm } from '../../pacientes/infraestrutura/avaliacao-antropometrica.orm';
import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';
import { ProfissionalOrm } from '../../profissionais/infraestrutura/profissional.orm';
import { AlimentoComposicaoOrm } from '../infraestrutura/alimento-composicao.orm';
import { FonteComposicaoAlimentoOrm } from '../infraestrutura/fonte-composicao-alimento.orm';
import { PlanoAlimentarItemOrm } from '../infraestrutura/plano-alimentar-item.orm';
import { PlanoAlimentarRefeicaoOrm } from '../infraestrutura/plano-alimentar-refeicao.orm';
import { PlanoAlimentarSubstituicaoOrm } from '../infraestrutura/plano-alimentar-substituicao.orm';
import { PlanoAlimentarVersaoOrm } from '../infraestrutura/plano-alimentar-versao.orm';
import { PlanoAlimentarOrm } from '../infraestrutura/plano-alimentar.orm';
import { AtualizarRascunhoPlanoAlimentarDto } from './dtos';
import { ServicoPlanosAlimentares } from './servico-planos-alimentares';

const TENANT_ID = '10000000-0000-4000-8000-000000000001';
const USUARIO_ID = '10000000-0000-4000-8000-000000000002';
const PROFISSIONAL_ID = '10000000-0000-4000-8000-000000000003';
const PACIENTE_ID = '10000000-0000-4000-8000-000000000004';
const PLANO_ID = '10000000-0000-4000-8000-000000000005';
const VERSAO_ID = '10000000-0000-4000-8000-000000000006';
const AVALIACAO_ID = '10000000-0000-4000-8000-000000000007';

interface RepositorioMemoria<T extends { id?: string }> {
  registros: T[];
  create: jest.Mock;
  save: jest.Mock;
  findOne: jest.Mock;
  find: jest.Mock;
  delete: jest.Mock;
  createQueryBuilder: jest.Mock;
}

function valorDoOperador(valor: unknown): { tipo?: string; valor?: unknown } {
  const operador = valor as { _type?: string; _value?: unknown } | undefined;
  return { tipo: operador?._type, valor: operador?._value };
}

function corresponde(registro: Record<string, unknown>, criterio: Record<string, unknown>): boolean {
  return Object.entries(criterio).every(([campo, esperado]) => {
    const atual = registro[campo];
    const operador = valorDoOperador(esperado);
    if (operador.tipo === 'isNull') return atual === undefined || atual === null;
    if (operador.tipo === 'in') return (operador.valor as unknown[]).includes(atual);
    return atual === esperado;
  });
}

function criarRepositorio<T extends { id?: string }>(iniciais: T[] = []): RepositorioMemoria<T> {
  const repositorio: RepositorioMemoria<T> = {
    registros: [...iniciais],
    create: jest.fn((dados: T) => ({ ...dados })),
    save: jest.fn(async (entrada: T | T[]) => {
      const salvarUm = (dados: T): T => {
        if (!dados.id) dados.id = `mem-${repositorio.registros.length + 1}`;
        const indice = repositorio.registros.findIndex((registro) => registro.id === dados.id);
        if (indice >= 0) repositorio.registros[indice] = dados;
        else repositorio.registros.push(dados);
        return dados;
      };
      return Array.isArray(entrada) ? entrada.map(salvarUm) : salvarUm(entrada);
    }),
    findOne: jest.fn(async (opcoes: { where?: Record<string, unknown> }) =>
      repositorio.registros.find((registro) => corresponde(registro as Record<string, unknown>, opcoes.where ?? {})) ?? null
    ),
    find: jest.fn(async (opcoes: { where?: Record<string, unknown>; order?: Record<string, 'ASC' | 'DESC'>; take?: number } = {}) => {
      let resultado = repositorio.registros.filter((registro) =>
        corresponde(registro as Record<string, unknown>, opcoes.where ?? {})
      );
      for (const [campo, direcao] of Object.entries(opcoes.order ?? {})) {
        resultado = [...resultado].sort((a, b) => {
          const av = (a as Record<string, unknown>)[campo] as number | string | Date | undefined;
          const bv = (b as Record<string, unknown>)[campo] as number | string | Date | undefined;
          const comparacao = av === bv ? 0 : av === undefined ? -1 : bv === undefined ? 1 : av < bv ? -1 : 1;
          return direcao === 'DESC' ? -comparacao : comparacao;
        });
      }
      return opcoes.take ? resultado.slice(0, opcoes.take) : resultado;
    }),
    delete: jest.fn(async (criterio: Record<string, unknown>) => {
      const preservados = repositorio.registros.filter(
        (registro) => !corresponde(registro as Record<string, unknown>, criterio)
      );
      repositorio.registros.splice(0, repositorio.registros.length, ...preservados);
      return { affected: 1 };
    }),
    createQueryBuilder: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn(async () => repositorio.registros)
    }))
  };
  return repositorio;
}

function usuarioProfissional(): UsuarioAutenticado {
  return {
    usuarioId: USUARIO_ID,
    tenantId: TENANT_ID,
    papel: 'Professional',
    emailHash: 'hash',
    permissoes: ['planos_alimentares.ler', 'planos_alimentares.gerenciar']
  };
}

function dadosRascunho(alimentoComposicaoId?: string): AtualizarRascunhoPlanoAlimentarDto {
  return {
    avaliacaoAntropometricaId: AVALIACAO_ID,
    formula: 'mifflin_st_jeor_1990',
    fatorAtividade: 1.4,
    ajusteEnergeticoKcal: 0,
    distribuicaoMacros: {
      carboidratosBasisPoints: 5000,
      proteinasBasisPoints: 2000,
      gordurasBasisPoints: 3000
    },
    possuiCondicaoEspecial: false,
    aplicabilidadeFormulaConfirmada: true,
    justificativaDivergenciaClinica: 'A composicao sera ajustada na proxima evolucao clinica.',
    objetivos: 'Atingir a meta definida com seguranca.',
    refeicoes: [
      {
        nome: 'Cafe da manha',
        itens: [
          alimentoComposicaoId
            ? {
                alimentoComposicaoId,
                quantidade: 1,
                unidade: 'porcao',
                porcaoGramas: 100,
                substituicoes: []
              }
            : {
                descricao: 'Alimento manual',
                quantidade: 1,
                unidade: 'porcao',
                porcaoGramas: 100,
                nutrientesPor100g: {
                  energiaKcal: 120,
                  proteinasG: 10,
                  carboidratosG: 20,
                  gordurasG: 4
                },
                substituicoes: []
              }
        ]
      }
    ]
  };
}

describe('ServicoPlanosAlimentares', () => {
  let criptografia: CriptografiaDadosSensiveis;
  let repositorios: Map<Function, RepositorioMemoria<any>>;
  let gerenciador: EntityManager;
  let executor: { executar: jest.Mock };
  let servico: ServicoPlanosAlimentares;

  beforeEach(() => {
    criptografia = new CriptografiaDadosSensiveis();
    repositorios = new Map<Function, RepositorioMemoria<any>>();
    const registrar = <T extends { id?: string }>(entidade: Function, registros: T[] = []) => {
      const repositorio = criarRepositorio(registros);
      repositorios.set(entidade, repositorio);
      return repositorio;
    };
    registrar(ProfissionalOrm, [
      { id: PROFISSIONAL_ID, tenantId: TENANT_ID, usuarioId: USUARIO_ID, arquivadoEm: undefined }
    ]);
    registrar(PacienteOrm, [
      {
        id: PACIENTE_ID,
        tenantId: TENANT_ID,
        profissionalResponsavelId: PROFISSIONAL_ID,
        arquivadoEm: undefined
      }
    ]);
    registrar(PlanoAlimentarOrm, [
      {
        id: PLANO_ID,
        tenantId: TENANT_ID,
        pacienteId: PACIENTE_ID,
        profissionalId: PROFISSIONAL_ID,
        criadoPorUsuarioId: USUARIO_ID,
        tituloCriptografado: criptografia.criptografar('Plano principal')
      }
    ]);
    registrar(PlanoAlimentarVersaoOrm, [
      {
        id: VERSAO_ID,
        tenantId: TENANT_ID,
        planoId: PLANO_ID,
        numero: 1,
        criadoPorUsuarioId: USUARIO_ID,
        revisadaEm: new Date('2026-08-01T12:00:00Z'),
        revisadaPorUsuarioId: USUARIO_ID
      }
    ]);
    registrar(AvaliacaoAntropometricaOrm, [
      {
        id: AVALIACAO_ID,
        tenantId: TENANT_ID,
        pacienteId: PACIENTE_ID,
        avaliadaEm: '2026-08-01',
        sexo: 'masculino',
        idadeAnos: 35,
        medidasCriptografadas: criptografia.criptografar(JSON.stringify({ pesoKg: 80, alturaCm: 180 })),
        excluidaEm: undefined
      }
    ]);
    registrar(PlanoAlimentarRefeicaoOrm);
    registrar(PlanoAlimentarItemOrm);
    registrar(PlanoAlimentarSubstituicaoOrm);
    registrar(AlimentoComposicaoOrm);
    registrar(FonteComposicaoAlimentoOrm);
    registrar(UserActionLogOrm);
    gerenciador = {
      getRepository: jest.fn((entidade: Function) => repositorios.get(entidade))
    } as unknown as EntityManager;
    executor = {
      executar: jest.fn(async (_tenantId: string, operacao: (manager: EntityManager) => Promise<unknown>) =>
        operacao(gerenciador)
      )
    };
    servico = new ServicoPlanosAlimentares(executor as unknown as ExecutorTenant, criptografia);
  });

  it('nao enumera paciente de outro profissional e filtra o responsavel na consulta', async () => {
    repositorios.get(PacienteOrm)!.registros[0].profissionalResponsavelId = '10000000-0000-4000-8000-000000000099';

    await expect(servico.listar(TENANT_ID, PACIENTE_ID, usuarioProfissional())).rejects.toBeInstanceOf(NotFoundException);

    expect(repositorios.get(PacienteOrm)!.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ profissionalResponsavelId: PROFISSIONAL_ID })
      })
    );
  });

  it('permite ao responsavel atual listar o historico sem confundir autoria com autorizacao', async () => {
    repositorios.get(PlanoAlimentarOrm)!.registros[0].profissionalId =
      '10000000-0000-4000-8000-000000000099';

    await servico.listar(TENANT_ID, PACIENTE_ID, usuarioProfissional());

    const consulta = repositorios.get(PlanoAlimentarOrm)!.find.mock.calls[0][0];
    expect(consulta.where).not.toHaveProperty('profissionalId');
    expect(consulta.where).toEqual(expect.objectContaining({ tenantId: TENANT_ID, pacienteId: PACIENTE_ID }));
  });

  it('lista somente resumo sem carregar refeicoes, itens ou substituicoes', async () => {
    const resultado = await servico.listar(TENANT_ID, PACIENTE_ID, usuarioProfissional());

    expect(resultado).toEqual([
      expect.objectContaining({
        id: PLANO_ID,
        titulo: 'Plano principal',
        draft: expect.objectContaining({ id: VERSAO_ID, numero: 1, status: 'rascunho' }),
        historicoQuantidade: 0
      })
    ]);
    expect(resultado[0]).not.toHaveProperty('historico');
    expect(repositorios.get(PlanoAlimentarVersaoOrm)!.find).toHaveBeenCalledTimes(1);
    expect(repositorios.get(PlanoAlimentarRefeicaoOrm)!.find).not.toHaveBeenCalled();
    expect(repositorios.get(PlanoAlimentarItemOrm)!.find).not.toHaveBeenCalled();
    expect(repositorios.get(PlanoAlimentarSubstituicaoOrm)!.find).not.toHaveBeenCalled();
  });

  it('obtem o detalhe completo somente para plano no escopo do paciente', async () => {
    repositorios.get(PlanoAlimentarVersaoOrm)!.registros.push({
      id: '10000000-0000-4000-8000-000000000008',
      tenantId: TENANT_ID,
      planoId: PLANO_ID,
      numero: 0,
      criadoPorUsuarioId: USUARIO_ID,
      publicadaEm: new Date('2026-07-01T12:00:00Z')
    });
    const resultado = await servico.obter(TENANT_ID, PACIENTE_ID, PLANO_ID, usuarioProfissional());

    expect(resultado).toEqual(expect.objectContaining({
      id: PLANO_ID,
      draft: expect.objectContaining({ id: VERSAO_ID, refeicoes: [] }),
      historico: [expect.objectContaining({ numero: 0, status: 'publicada' })]
    }));
    expect(repositorios.get(PlanoAlimentarRefeicaoOrm)!.find).toHaveBeenCalledTimes(1);

    await expect(
      servico.obter(TENANT_ID, PACIENTE_ID, '10000000-0000-4000-8000-000000000099', usuarioProfissional())
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('aplica permissao tambem no servico e bloqueia mutacao direta para leitor', async () => {
    const leitor: UsuarioAutenticado = { ...usuarioProfissional(), permissoes: ['planos_alimentares.ler'] };

    await expect(servico.listar(TENANT_ID, PACIENTE_ID, leitor)).resolves.toHaveLength(1);
    await expect(
      servico.criar(TENANT_ID, PACIENTE_ID, leitor, { titulo: 'Plano indevido' })
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(executor.executar).toHaveBeenCalledTimes(1);
  });

  it('trava o paciente antes de alterar o rascunho para serializar reatribuicoes', async () => {
    await servico.atualizarRascunho(
      TENANT_ID,
      PACIENTE_ID,
      PLANO_ID,
      usuarioProfissional(),
      dadosRascunho()
    );

    expect(repositorios.get(PacienteOrm)!.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ lock: { mode: 'pessimistic_write' } })
    );
  });

  it('bloqueia edicao quando faltam dados antropometricos obrigatorios', async () => {
    repositorios.get(AvaliacaoAntropometricaOrm)!.registros[0].medidasCriptografadas = criptografia.criptografar(
      JSON.stringify({ alturaCm: 180 })
    );

    await expect(
      servico.atualizarRascunho(TENANT_ID, PACIENTE_ID, PLANO_ID, usuarioProfissional(), dadosRascunho())
    ).rejects.toThrow('peso, altura, sexo e idade');
  });

  it('edicao substitui filhos, recalcula no servidor e invalida revisao', async () => {
    const resposta = await servico.atualizarRascunho(
      TENANT_ID,
      PACIENTE_ID,
      PLANO_ID,
      usuarioProfissional(),
      dadosRascunho()
    );
    const versao = repositorios.get(PlanoAlimentarVersaoOrm)!.registros[0] as PlanoAlimentarVersaoOrm;

    expect(versao.revisadaEm).toBeUndefined();
    expect(versao.revisadaPorUsuarioId).toBeUndefined();
    expect(repositorios.get(PlanoAlimentarRefeicaoOrm)!.registros).toHaveLength(1);
    expect(repositorios.get(PlanoAlimentarItemOrm)!.registros).toHaveLength(1);
    expect(resposta.totais).toEqual({
      energiaKcal: 120,
      proteinasG: 10,
      carboidratosG: 20,
      gordurasG: 4
    });
    expect(resposta.calculo).toEqual(
      expect.objectContaining({
        alertasDivergenciaClinica: expect.arrayContaining([
          expect.stringContaining('Energia')
        ]),
        justificativaDivergenciaClinica: expect.any(String)
      })
    );
  });

  it('exige motivo de override antes de revisar metas e refeicoes muito divergentes', async () => {
    const dados = dadosRascunho();
    dados.justificativaDivergenciaClinica = undefined;
    await servico.atualizarRascunho(TENANT_ID, PACIENTE_ID, PLANO_ID, usuarioProfissional(), dados);

    await expect(
      servico.revisar(TENANT_ID, PACIENTE_ID, PLANO_ID, usuarioProfissional())
    ).rejects.toThrow('justificativa clinica');
  });

  it('bloqueia calculo automatico quando ha condicao especial', async () => {
    const dados = dadosRascunho();
    dados.possuiCondicaoEspecial = true;

    await expect(
      servico.atualizarRascunho(TENANT_ID, PACIENTE_ID, PLANO_ID, usuarioProfissional(), dados)
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(executor.executar).not.toHaveBeenCalled();
  });

  it('bloqueia publicacao sem revisao', async () => {
    const versao = repositorios.get(PlanoAlimentarVersaoOrm)!.registros[0] as PlanoAlimentarVersaoOrm;
    versao.revisadaEm = undefined;
    versao.revisadaPorUsuarioId = undefined;

    await expect(servico.publicar(TENANT_ID, PACIENTE_ID, PLANO_ID, usuarioProfissional())).rejects.toBeInstanceOf(
      ConflictException
    );
  });

  it('responsavel atual pode publicar plano de autor anterior sem alterar a autoria', async () => {
    const autorAnterior = '10000000-0000-4000-8000-000000000099';
    repositorios.get(PlanoAlimentarOrm)!.registros[0].profissionalId =
      autorAnterior;

    await servico.atualizarRascunho(
      TENANT_ID,
      PACIENTE_ID,
      PLANO_ID,
      usuarioProfissional(),
      dadosRascunho()
    );
    await servico.revisar(TENANT_ID, PACIENTE_ID, PLANO_ID, usuarioProfissional());
    await servico.publicar(TENANT_ID, PACIENTE_ID, PLANO_ID, usuarioProfissional());

    expect(repositorios.get(PlanoAlimentarOrm)!.registros[0].profissionalId).toBe(autorAnterior);
    expect(repositorios.get(UserActionLogOrm)!.save).toHaveBeenCalled();
  });

  it('publica sob a mesma transacao, atualiza ponteiro, gera hash e grava auditoria', async () => {
    await servico.atualizarRascunho(
      TENANT_ID,
      PACIENTE_ID,
      PLANO_ID,
      usuarioProfissional(),
      dadosRascunho()
    );
    await servico.revisar(TENANT_ID, PACIENTE_ID, PLANO_ID, usuarioProfissional());
    await servico.publicar(TENANT_ID, PACIENTE_ID, PLANO_ID, usuarioProfissional());

    const versao = repositorios.get(PlanoAlimentarVersaoOrm)!.registros[0] as PlanoAlimentarVersaoOrm;
    const plano = repositorios.get(PlanoAlimentarOrm)!.registros[0] as PlanoAlimentarOrm;
    const auditorias = repositorios.get(UserActionLogOrm)!.registros as UserActionLogOrm[];
    expect(versao.publicadaEm).toBeInstanceOf(Date);
    expect(versao.hashConteudo).toMatch(/^[0-9a-f]{64}$/);
    expect(plano.versaoPublicadaAtualId).toBe(VERSAO_ID);
    expect(auditorias).toEqual([
      expect.objectContaining({
        tenantId: TENANT_ID,
        usuarioId: USUARIO_ID,
        acao: 'planos_alimentares.publicar',
        recursoId: PLANO_ID
      })
    ]);
    expect(executor.executar).toHaveBeenCalledTimes(3);
  });

  it('usa snapshot do catalogo e preserva fibra e sodio ausentes', async () => {
    const ALIMENTO_ID = '10000000-0000-4000-8000-000000000008';
    const FONTE_ID = '10000000-0000-4000-8000-000000000009';
    repositorios.get(AlimentoComposicaoOrm)!.registros.push({
      id: ALIMENTO_ID,
      fonteId: FONTE_ID,
      codigoOrigem: 'TACO-1',
      nome: 'Arroz cozido',
      baseGramas: '100',
      energiaKcal: '128',
      proteinasG: '2.5',
      carboidratosG: '28.1',
      lipidiosG: '0.2',
      fibrasG: undefined,
      sodioMg: undefined
    });
    repositorios.get(FonteComposicaoAlimentoOrm)!.registros.push({
      id: FONTE_ID,
      codigo: 'TACO',
      nome: 'Tabela TACO',
      versao: '4',
      baseCodigo: 'cmvcol_taco3',
      situacao: 'ativa',
      hashConteudo: 'a'.repeat(64)
    });

    const resposta = await servico.atualizarRascunho(
      TENANT_ID,
      PACIENTE_ID,
      PLANO_ID,
      usuarioProfissional(),
      dadosRascunho(ALIMENTO_ID)
    );
    const snapshot = resposta.refeicoes[0].itens[0].composicaoSnapshot;

    expect(snapshot).toEqual(
      expect.objectContaining({
        origem: 'catalogo',
        codigoOrigem: 'TACO-1',
        fonte: expect.objectContaining({ codigo: 'TACO', versao: '4' }),
        nutrientesPor100g: {
          energiaKcal: 128,
          proteinasG: 2.5,
          carboidratosG: 28.1,
          gordurasG: 0.2
        }
      })
    );
    expect(snapshot.nutrientesPorcao).not.toHaveProperty('fibrasG');
    expect(snapshot.nutrientesPorcao).not.toHaveProperty('sodioMg');
    expect(resposta.totais).not.toHaveProperty('fibrasG');
    expect(resposta.totais).not.toHaveProperty('sodioMg');
  });

  it('rejeita alimento do catalogo sem macro essencial', async () => {
    const ALIMENTO_ID = '10000000-0000-4000-8000-000000000010';
    repositorios.get(AlimentoComposicaoOrm)!.registros.push({
      id: ALIMENTO_ID,
      fonteId: '10000000-0000-4000-8000-000000000011',
      codigoOrigem: 'TACO-INCOMPLETO',
      nome: 'Alimento incompleto',
      baseGramas: '100',
      energiaKcal: '100',
      proteinasG: undefined,
      carboidratosG: '10',
      lipidiosG: '1'
    });

    await expect(
      servico.atualizarRascunho(
        TENANT_ID,
        PACIENTE_ID,
        PLANO_ID,
        usuarioProfissional(),
        dadosRascunho(ALIMENTO_ID)
      )
    ).rejects.toThrow('indisponivel para calculo');
  });

  it('marca alimento incompleto como indisponivel na busca sem depender de unaccent', async () => {
    const FONTE_ID = '10000000-0000-4000-8000-000000000013';
    repositorios.get(AlimentoComposicaoOrm)!.registros.push({
      id: '10000000-0000-4000-8000-000000000012',
      fonteId: FONTE_ID,
      codigoOrigem: 'TACO-NULL',
      nome: 'Alimento sem energia',
      baseGramas: '100',
      energiaKcal: undefined,
      proteinasG: '2',
      carboidratosG: '10',
      lipidiosG: '1',
      fibrasG: undefined,
      sodioMg: undefined
    });
    repositorios.get(FonteComposicaoAlimentoOrm)!.registros.push({
      id: FONTE_ID,
      codigo: 'TACO',
      nome: 'Tabela TACO',
      versao: '4',
      baseCodigo: 'cmvcol_taco3',
      situacao: 'ativa'
    });

    const resultado = await servico.buscarAlimentos(TENANT_ID, 'alimento', usuarioProfissional());

    expect(resultado).toEqual([
      expect.objectContaining({
        codigoOrigem: 'TACO-NULL',
        disponivelParaCalculo: false,
        nutrientesPor100g: undefined
      })
    ]);
    const queryBuilder = repositorios.get(AlimentoComposicaoOrm)!.createQueryBuilder.mock.results[0].value;
    expect(queryBuilder.where).toHaveBeenCalledWith('lower(alimento.nome) like lower(:busca)', {
      busca: '%alimento%'
    });
    expect(queryBuilder.andWhere).toHaveBeenCalledWith('alimento.fonte_id in (:...fonteIds)', {
      fonteIds: [FONTE_ID]
    });
  });

  it('nao pesquisa nem seleciona alimento de fonte suspensa', async () => {
    const ALIMENTO_ID = '10000000-0000-4000-8000-000000000014';
    const FONTE_ID = '10000000-0000-4000-8000-000000000015';
    repositorios.get(AlimentoComposicaoOrm)!.registros.push({
      id: ALIMENTO_ID,
      fonteId: FONTE_ID,
      codigoOrigem: 'FONTE-SUSPENSA',
      nome: 'Alimento suspenso',
      baseGramas: '100',
      energiaKcal: '100',
      proteinasG: '2',
      carboidratosG: '10',
      lipidiosG: '1'
    });
    repositorios.get(FonteComposicaoAlimentoOrm)!.registros.push({
      id: FONTE_ID,
      codigo: 'FONTE',
      nome: 'Fonte suspensa',
      versao: '1',
      baseCodigo: 'principal',
      situacao: 'suspensa'
    });

    await expect(servico.buscarAlimentos(TENANT_ID, 'alimento', usuarioProfissional())).resolves.toEqual([]);
    await expect(
      servico.atualizarRascunho(
        TENANT_ID,
        PACIENTE_ID,
        PLANO_ID,
        usuarioProfissional(),
        dadosRascunho(ALIMENTO_ID)
      )
    ).rejects.toThrow('nao esta ativa');
  });
});
