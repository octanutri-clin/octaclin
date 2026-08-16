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
// Barra invertida unica: o caractere de escape do LIKE no SQL emitido.
const BARRA = '\\';

interface RepositorioMemoria<T extends { id?: string }> {
  registros: T[];
  create: jest.Mock;
  save: jest.Mock;
  findOne: jest.Mock;
  find: jest.Mock;
  findAndCount: jest.Mock;
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

interface OpcoesConsultaMemoria {
  where?: Record<string, unknown>;
  order?: Record<string, 'ASC' | 'DESC'>;
  skip?: number;
  take?: number;
}

interface ConstrutorConsultaMemoria {
  where: jest.Mock;
  andWhere: jest.Mock;
  orderBy: jest.Mock;
  addOrderBy: jest.Mock;
  skip: jest.Mock;
  take: jest.Mock;
  getMany: jest.Mock;
  getManyAndCount: jest.Mock;
}

function paginarMemoria<T>(registros: T[], opcoes: OpcoesConsultaMemoria): { pagina: T[]; total: number } {
  let resultado = registros.filter((registro) => corresponde(registro as Record<string, unknown>, opcoes.where ?? {}));
  for (const [campo, direcao] of Object.entries(opcoes.order ?? {})) {
    resultado = [...resultado].sort((a, b) => {
      const av = (a as Record<string, unknown>)[campo] as number | string | Date | undefined;
      const bv = (b as Record<string, unknown>)[campo] as number | string | Date | undefined;
      const comparacao = av === bv ? 0 : av === undefined ? -1 : bv === undefined ? 1 : av < bv ? -1 : 1;
      return direcao === 'DESC' ? -comparacao : comparacao;
    });
  }
  const total = resultado.length;
  const pular = opcoes.skip ?? 0;
  const pagina = opcoes.take === undefined ? resultado.slice(pular) : resultado.slice(pular, pular + opcoes.take);
  return { pagina, total };
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
    find: jest.fn(async (opcoes: OpcoesConsultaMemoria = {}) => paginarMemoria(repositorio.registros, opcoes).pagina),
    findAndCount: jest.fn(async (opcoes: OpcoesConsultaMemoria = {}) => {
      const { pagina, total } = paginarMemoria(repositorio.registros, opcoes);
      return [pagina, total] as [unknown[], number];
    }),
    delete: jest.fn(async (criterio: Record<string, unknown>) => {
      const preservados = repositorio.registros.filter(
        (registro) => !corresponde(registro as Record<string, unknown>, criterio)
      );
      repositorio.registros.splice(0, repositorio.registros.length, ...preservados);
      return { affected: 1 };
    }),
    createQueryBuilder: jest.fn(() => {
      const paginacao: { pular: number; levar?: number } = { pular: 0 };
      const construtor: ConstrutorConsultaMemoria = {
        where: jest.fn(() => construtor),
        andWhere: jest.fn(() => construtor),
        orderBy: jest.fn(() => construtor),
        addOrderBy: jest.fn(() => construtor),
        skip: jest.fn((valor: number) => {
          paginacao.pular = valor;
          return construtor;
        }),
        take: jest.fn((valor: number) => {
          paginacao.levar = valor;
          return construtor;
        }),
        getMany: jest.fn(async () => repositorio.registros),
        getManyAndCount: jest.fn(async (): Promise<[unknown[], number]> => [
          repositorio.registros.slice(
            paginacao.pular,
            paginacao.levar === undefined ? undefined : paginacao.pular + paginacao.levar
          ),
          repositorio.registros.length
        ])
      };
      return construtor;
    })
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

    const consulta = repositorios.get(PlanoAlimentarOrm)!.findAndCount.mock.calls[0][0];
    expect(consulta.where).not.toHaveProperty('profissionalId');
    expect(consulta.where).toEqual(expect.objectContaining({ tenantId: TENANT_ID, pacienteId: PACIENTE_ID }));
  });

  it('lista somente resumo sem carregar refeicoes, itens ou substituicoes', async () => {
    const resultado = await servico.listar(TENANT_ID, PACIENTE_ID, usuarioProfissional());

    expect(resultado.itens).toEqual([
      expect.objectContaining({
        id: PLANO_ID,
        titulo: 'Plano principal',
        draft: expect.objectContaining({ id: VERSAO_ID, numero: 1, status: 'rascunho' }),
        historicoQuantidade: 0
      })
    ]);
    expect(resultado.itens[0]).not.toHaveProperty('historico');
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

    await expect(servico.listar(TENANT_ID, PACIENTE_ID, leitor)).resolves.toEqual(
      expect.objectContaining({ total: 1, itens: [expect.objectContaining({ id: PLANO_ID })] })
    );
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

    const resultado = await servico.buscarAlimentos(TENANT_ID, usuarioProfissional(), { busca: 'alimento', pagina: 1, limite: 25 });

    expect(resultado.itens).toEqual([
      expect.objectContaining({
        codigoOrigem: 'TACO-NULL',
        disponivelParaCalculo: false,
        nutrientesPor100g: undefined
      })
    ]);
    const queryBuilder = repositorios.get(AlimentoComposicaoOrm)!.createQueryBuilder.mock.results[0].value;
    expect(queryBuilder.where).toHaveBeenCalledWith(`lower(alimento.nome) like lower(:busca) escape '${BARRA}'`, {
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

    await expect(
      servico.buscarAlimentos(TENANT_ID, usuarioProfissional(), { busca: 'alimento', pagina: 1, limite: 25 })
    ).resolves.toEqual(expect.objectContaining({ itens: [], total: 0 }));
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

  it('pagina a listagem de planos e devolve total, pagina e tamanho sem carregar estrutura', async () => {
    repositorios.get(PlanoAlimentarOrm)!.registros.push({
      id: '10000000-0000-4000-8000-000000000020',
      tenantId: TENANT_ID,
      pacienteId: PACIENTE_ID,
      profissionalId: PROFISSIONAL_ID,
      criadoPorUsuarioId: USUARIO_ID,
      tituloCriptografado: criptografia.criptografar('Plano secundario'),
      criadoEm: new Date('2026-08-02T12:00:00Z')
    });

    const resultado = await servico.listar(TENANT_ID, PACIENTE_ID, usuarioProfissional(), {
      pagina: 2,
      limite: 1
    });

    expect(resultado).toEqual(
      expect.objectContaining({ total: 2, pagina: 2, limite: 1, itens: [expect.objectContaining({ id: PLANO_ID })] })
    );
    expect(repositorios.get(PlanoAlimentarRefeicaoOrm)!.find).not.toHaveBeenCalled();
    expect(repositorios.get(PlanoAlimentarItemOrm)!.find).not.toHaveBeenCalled();
  });

  it('pagina a busca de alimentos e informa o total real alem da pagina devolvida', async () => {
    const FONTE_ID = '10000000-0000-4000-8000-000000000021';
    repositorios.get(FonteComposicaoAlimentoOrm)!.registros.push({
      id: FONTE_ID,
      codigo: 'TACO',
      nome: 'Tabela TACO',
      versao: '4',
      baseCodigo: 'principal',
      situacao: 'ativa'
    });
    for (const indice of [1, 2, 3]) {
      repositorios.get(AlimentoComposicaoOrm)!.registros.push({
        id: `10000000-0000-4000-8000-00000000003${indice}`,
        fonteId: FONTE_ID,
        codigoOrigem: `TACO-${indice}`,
        nome: `Arroz tipo ${indice}`,
        baseGramas: '100',
        energiaKcal: '100',
        proteinasG: '2',
        carboidratosG: '10',
        lipidiosG: '1'
      });
    }

    const resultado = await servico.buscarAlimentos(TENANT_ID, usuarioProfissional(), {
      busca: 'arroz',
      pagina: 1,
      limite: 2
    });

    expect(resultado).toEqual(
      expect.objectContaining({ total: 3, pagina: 1, limite: 2 })
    );
    expect(resultado.itens).toHaveLength(2);
    expect(resultado.fontes).toEqual([
      expect.objectContaining({ codigo: 'TACO', versao: '4', baseCodigo: 'principal' })
    ]);
  });

  it('filtra a busca por fonte e versao sem mesclar alimentos de fontes diferentes', async () => {
    const FONTE_TACO = '10000000-0000-4000-8000-000000000041';
    const FONTE_TBCA = '10000000-0000-4000-8000-000000000042';
    repositorios.get(FonteComposicaoAlimentoOrm)!.registros.push(
      { id: FONTE_TACO, codigo: 'TACO', nome: 'Tabela TACO', versao: '4', baseCodigo: 'principal', situacao: 'ativa' },
      { id: FONTE_TBCA, codigo: 'TBCA', nome: 'Tabela TBCA', versao: '7.3', baseCodigo: 'BD-AIN', situacao: 'ativa' }
    );
    repositorios.get(AlimentoComposicaoOrm)!.registros.push(
      {
        id: '10000000-0000-4000-8000-000000000043',
        fonteId: FONTE_TACO,
        codigoOrigem: 'TACO-ARROZ',
        nome: 'Arroz taco',
        baseGramas: '100',
        energiaKcal: '100',
        proteinasG: '2',
        carboidratosG: '10',
        lipidiosG: '1'
      },
      {
        id: '10000000-0000-4000-8000-000000000044',
        fonteId: FONTE_TBCA,
        codigoOrigem: 'TBCA-ARROZ',
        nome: 'Arroz tbca',
        baseGramas: '100',
        energiaKcal: '110',
        proteinasG: '3',
        carboidratosG: '11',
        lipidiosG: '2'
      }
    );

    const resultado = await servico.buscarAlimentos(TENANT_ID, usuarioProfissional(), {
      busca: 'arroz',
      pagina: 1,
      limite: 20,
      fonteCodigo: 'TBCA',
      versao: '7.3'
    });

    expect(resultado.itens).toEqual([
      expect.objectContaining({ codigoOrigem: 'TBCA-ARROZ', fonte: expect.objectContaining({ codigo: 'TBCA', versao: '7.3' }) })
    ]);
  });

  it('escapa curinga do like para o termo do profissional nao virar busca ampla', async () => {
    repositorios.get(FonteComposicaoAlimentoOrm)!.registros.push({
      id: '10000000-0000-4000-8000-000000000051',
      codigo: 'TACO',
      nome: 'Tabela TACO',
      versao: '4',
      baseCodigo: 'principal',
      situacao: 'ativa'
    });

    await servico.buscarAlimentos(TENANT_ID, usuarioProfissional(), {
      busca: '100%_integral',
      pagina: 1,
      limite: 20
    });

    const construtor = repositorios.get(AlimentoComposicaoOrm)!.createQueryBuilder.mock.results[0].value;
    expect(construtor.where).toHaveBeenCalledWith(
      `lower(alimento.nome) like lower(:busca) escape '${BARRA}'`,
      { busca: `%100${BARRA}%${BARRA}_integral%` }
    );
  });

  it('desempata a ordenacao paginada por id para a mesma linha nao cair em duas paginas', async () => {
    // criado_em usa default now(): planos gravados na mesma transacao empatam.
    repositorios.get(PlanoAlimentarOrm)!.registros.push({
      id: '10000000-0000-4000-8000-000000000071',
      tenantId: TENANT_ID,
      pacienteId: PACIENTE_ID,
      profissionalId: PROFISSIONAL_ID,
      criadoPorUsuarioId: USUARIO_ID,
      tituloCriptografado: criptografia.criptografar('Plano empatado'),
      criadoEm: new Date('2026-08-01T12:00:00Z')
    });
    repositorios.get(PlanoAlimentarOrm)!.registros[0].criadoEm = new Date('2026-08-01T12:00:00Z');

    await servico.listar(TENANT_ID, PACIENTE_ID, usuarioProfissional(), { pagina: 1, limite: 1 });

    expect(repositorios.get(PlanoAlimentarOrm)!.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({ order: { criadoEm: 'DESC', id: 'DESC' } })
    );

    repositorios.get(FonteComposicaoAlimentoOrm)!.registros.push({
      id: '10000000-0000-4000-8000-000000000072',
      codigo: 'TACO',
      nome: 'Tabela TACO',
      versao: '4',
      baseCodigo: 'principal',
      situacao: 'ativa'
    });

    await servico.buscarAlimentos(TENANT_ID, usuarioProfissional(), { busca: 'arroz', pagina: 1, limite: 20 });

    const construtor = repositorios.get(AlimentoComposicaoOrm)!.createQueryBuilder.mock.results[0].value;
    expect(construtor.orderBy).toHaveBeenCalledWith('alimento.nome', 'ASC');
    expect(construtor.addOrderBy).toHaveBeenCalledWith('alimento.id', 'ASC');
  });

  it('limita a pagina para offset alto nao virar varredura cara no banco', async () => {
    await servico.listar(TENANT_ID, PACIENTE_ID, usuarioProfissional(), { pagina: 999_999_999, limite: 100 });

    const consulta = repositorios.get(PlanoAlimentarOrm)!.findAndCount.mock.calls[0][0];
    expect(consulta.skip).toBeLessThanOrEqual(100_000);

    repositorios.get(FonteComposicaoAlimentoOrm)!.registros.push({
      id: '10000000-0000-4000-8000-000000000081',
      codigo: 'TACO',
      nome: 'Tabela TACO',
      versao: '4',
      baseCodigo: 'principal',
      situacao: 'ativa'
    });

    await servico.buscarAlimentos(TENANT_ID, usuarioProfissional(), {
      busca: 'arroz',
      pagina: 999_999_999,
      limite: 100
    });

    const construtor = repositorios.get(AlimentoComposicaoOrm)!.createQueryBuilder.mock.results[0].value;
    expect(construtor.skip.mock.calls[0][0]).toBeLessThanOrEqual(100_000);
  });

  it('entrega a versao historica completa somente sob demanda e so dentro do escopo', async () => {
    const VERSAO_HISTORICA = '10000000-0000-4000-8000-000000000061';
    const REFEICAO_ID = '10000000-0000-4000-8000-000000000062';
    repositorios.get(PlanoAlimentarVersaoOrm)!.registros.push({
      id: VERSAO_HISTORICA,
      tenantId: TENANT_ID,
      planoId: PLANO_ID,
      numero: 0,
      criadoPorUsuarioId: USUARIO_ID,
      publicadaEm: new Date('2026-07-01T12:00:00Z')
    });
    repositorios.get(PlanoAlimentarRefeicaoOrm)!.registros.push({
      id: REFEICAO_ID,
      tenantId: TENANT_ID,
      versaoId: VERSAO_HISTORICA,
      nomeCriptografado: criptografia.criptografar('Cafe historico'),
      ordem: 0
    });

    const resultado = await servico.obterVersao(TENANT_ID, PACIENTE_ID, PLANO_ID, 0, usuarioProfissional());

    expect(resultado).toEqual(
      expect.objectContaining({
        numero: 0,
        status: 'publicada',
        refeicoes: [expect.objectContaining({ nome: 'Cafe historico' })]
      })
    );

    await expect(
      servico.obterVersao(TENANT_ID, PACIENTE_ID, PLANO_ID, 99, usuarioProfissional())
    ).rejects.toBeInstanceOf(NotFoundException);
  });

});
