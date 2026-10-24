import { ServicoEquivalenciasPlano } from './servico-equivalencias-plano';
import { FontesGruposSubstituicoes } from './fontes-grupos-substituicoes';
import { ServicoGruposSubstituicoes } from './servico-grupos-substituicoes';
import { ServiceUnavailableException } from '@nestjs/common';
import { ServicoAlimentosPersonalizados } from './servico-alimentos-personalizados';
import { normalizarComposicaoPersonalizada } from '../dominio/alimentos-personalizados';
import { ServicoMedidasCaseiras } from './servico-medidas-caseiras';
import { randomUUID } from 'crypto';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { UserActionLogOrm } from '../../../infraestrutura/auditoria/user-action-log.orm';
import { OutboxEventoOrm } from '../../../infraestrutura/outbox/outbox-evento.orm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { AvaliacaoAntropometricaOrm } from '../../pacientes/infraestrutura/avaliacao-antropometrica.orm';
import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';
import { MensagemNotificacaoOrm } from '../../comunicacoes/infraestrutura/mensagem-notificacao.orm';
import { LogDiarioRapidoOrm } from '../../mobile/infraestrutura/log-diario-rapido.orm';
import { ProfissionalOrm } from '../../profissionais/infraestrutura/profissional.orm';
import { EnvioQuestionarioOrm } from '../../questionarios/infraestrutura/envio-questionario.orm';
import { AlimentoComposicaoOrm } from '../infraestrutura/alimento-composicao.orm';
import { FonteComposicaoAlimentoOrm } from '../infraestrutura/fonte-composicao-alimento.orm';
import { PlanoAlimentarItemOrm } from '../infraestrutura/plano-alimentar-item.orm';
import { PlanoAlimentarEscolhaPacienteOrm } from '../infraestrutura/plano-alimentar-escolha-paciente.orm';
import { PlanoAlimentarRefeicaoOrm } from '../infraestrutura/plano-alimentar-refeicao.orm';
import { PlanoAlimentarSubstituicaoOrm } from '../infraestrutura/plano-alimentar-substituicao.orm';
import { PlanoAlimentarVersaoOrm } from '../infraestrutura/plano-alimentar-versao.orm';
import { PlanoAlimentarOrm } from '../infraestrutura/plano-alimentar.orm';
import { MetodoMacrosManual } from '../dominio/calculo-nutricional';
import { AtualizarRascunhoPlanoAlimentarDto } from './dtos';
import { ServicoPlanosAlimentares } from './servico-planos-alimentares';
import { SalvarEdicaoPlanoDto } from './dtos-edicao-plano';

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
  count: jest.Mock;
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
    if (operador.tipo === 'moreThanOrEqual') {
      return atual instanceof Date && operador.valor instanceof Date && atual >= operador.valor;
    }
    if (operador.tipo === 'moreThan') {
      return atual instanceof Date && operador.valor instanceof Date && atual > operador.valor;
    }
    if (operador.tipo === 'lessThan') {
      return atual instanceof Date && operador.valor instanceof Date && atual < operador.valor;
    }
    if (operador.tipo === 'and') {
      return (operador.valor as unknown[]).every((parte) =>
        corresponde({ valor: atual }, { valor: parte })
      );
    }
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
        if (!dados.id) dados.id = randomUUID();
        const indice = repositorio.registros.findIndex((registro) => registro.id === dados.id);
        if (indice >= 0) repositorio.registros[indice] = dados;
        else repositorio.registros.push(dados);
        return dados;
      };
      return Array.isArray(entrada) ? entrada.map(salvarUm) : salvarUm(entrada);
    }),
    findOne: jest.fn(async (opcoes: OpcoesConsultaMemoria = {}) =>
      paginarMemoria(repositorio.registros, { ...opcoes, take: 1 }).pagina[0] ?? null
    ),
  find: jest.fn(async (opcoes: OpcoesConsultaMemoria = {}) => {
    const criterios = Array.isArray(opcoes.where) ? opcoes.where : [opcoes.where ?? {}];
    const correspondentes = repositorio.registros.filter((registro) => criterios.some((criterio) =>
      corresponde(registro as Record<string, unknown>, criterio as Record<string, unknown>)
    ));
    return paginarMemoria(correspondentes, { ...opcoes, where: {} }).pagina;
  }),
    findAndCount: jest.fn(async (opcoes: OpcoesConsultaMemoria = {}) => {
      const { pagina, total } = paginarMemoria(repositorio.registros, opcoes);
      return [pagina, total] as [unknown[], number];
    }),
    count: jest.fn(async (opcoes: OpcoesConsultaMemoria = {}) =>
      paginarMemoria(repositorio.registros, opcoes).total
    ),
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
    origemMeta: 'formula',
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

  it('congela micros manuais por porção sem reescrever os seis nutrientes ou o histórico', async () => {
    const entrada = dadosRascunho();
    Object.assign(entrada.refeicoes[0].itens[0], { porcaoGramas: 50, micronutrientesPor100g: { ferroMg: 2, calcioMg: 0 } });
    const resposta = await servico.atualizarRascunho(TENANT_ID, PACIENTE_ID, PLANO_ID, usuarioProfissional(), entrada);
    const snapshot = resposta.refeicoes[0].itens[0].composicaoSnapshot;
    expect(snapshot).toHaveProperty('micronutrientes.nutrientes.ferroMg.porcao', 1);
    expect(snapshot).toHaveProperty('micronutrientes.nutrientes.calcioMg.porcao', 0);
    expect(snapshot.nutrientesPorcao.energiaKcal).toBe(60);
    Object.assign(entrada.refeicoes[0].itens[0], { micronutrientesPor100g: { ferroMg: -1 } });
    await expect(servico.atualizarRascunho(TENANT_ID, PACIENTE_ID, PLANO_ID, usuarioProfissional(), entrada)).rejects.toThrow();
  });

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
    registrar(PlanoAlimentarEscolhaPacienteOrm);
    registrar(LogDiarioRapidoOrm);
    registrar(EnvioQuestionarioOrm);
    registrar(AlimentoComposicaoOrm);
    registrar(FonteComposicaoAlimentoOrm);
    registrar(UserActionLogOrm);
    registrar(MensagemNotificacaoOrm);
    registrar(OutboxEventoOrm);
    let identidadeContextual = '';
    const identidadesFisicas = new Map<string,string>();
    const refeicoesMemoria = repositorios.get(PlanoAlimentarRefeicaoOrm)!;
    const salvarRefeicao = refeicoesMemoria.save.getMockImplementation()!;
    refeicoesMemoria.save.mockImplementation(async entrada => {
      const refeicao = await salvarRefeicao(entrada);
      identidadesFisicas.set(refeicao.id, identidadeContextual || refeicao.id);
      return refeicao;
    });
    gerenciador = {
      getRepository: jest.fn((entidade: Function) => repositorios.get(entidade)),
      query: jest.fn(async (_sql: string, parametros: unknown[] = []) => {
        if (_sql.includes("current_setting('app.refeicao_identidade_id'")) return [{identidade: identidadeContextual}];
        if (_sql.includes("set_config('app.refeicao_identidade_id'")) { identidadeContextual = String(parametros[0]); return []; }
        if (_sql.includes('from plano_alimentar_refeicao_vinculos')) {
          const clonando = _sql.includes('select identidade_id');
          return refeicoesMemoria.registros.filter(r => r.tenantId === parametros[0] && r.versaoId === parametros[clonando ? 1 : 2] && (!clonando || r.id === parametros[2]))
            .sort((a,b) => a.ordem-b.ordem).map(r => ({refeicao_id:r.id,identidade_id:identidadesFisicas.get(r.id) ?? r.id,ativa:true}));
        }
        const [, planoIds] = parametros;
        if (!Array.isArray(planoIds)) return [];
        return planoIds.flatMap((planoId) => {
          const quantidade = repositorios.get(PlanoAlimentarVersaoOrm)!.registros.filter((versao) =>
            versao.tenantId === TENANT_ID && versao.planoId === planoId && (versao.publicadaEm || versao.descartadaEm)
          ).length;
          return quantidade ? [{ planoId, quantidade: String(quantidade) }] : [];
        });
      })
    } as unknown as EntityManager;
    executor = {
      executar: jest.fn(async (_tenantId: string, operacao: (manager: EntityManager) => Promise<unknown>) =>
        operacao(gerenciador)
      )
    };
    servico = new ServicoPlanosAlimentares(executor as unknown as ExecutorTenant, criptografia);
  });

  describe('PA06c cálculo combinado', () => {
    async function publicarParaCalculo() {
      const v = await servico.atualizarRascunho(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),dadosRascunho());
      const versao = repositorios.get(PlanoAlimentarVersaoOrm)!.registros[0];
      versao.publicadaEm = new Date('2026-10-16T12:00:00Z');
      Object.assign(repositorios.get(PlanoAlimentarOrm)!.registros[0], { versaoPublicadaAtualId:VERSAO_ID, ativoParaPaciente:true, ativacaoRevisao:0, ativacaoDefinida:true });
      return { selecoes:[{planoId:PLANO_ID,versaoIdEsperada:VERSAO_ID,ativacaoRevisaoEsperada:0,identidadesRefeicoes:[v.ativacaoRefeicoes[0].identidadeId]}] };
    }
    it('projeta somente seleção mínima e calcula sem gravar nem enriquecer legado', async () => {
      const entrada = await publicarParaCalculo();
      const selecao = await servico.obterSelecaoCalculo(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional());
      expect(Object.keys(selecao).sort()).toEqual(['planoId','ativoParaPaciente','ativacaoRevisao','versao','refeicoes'].sort());
      expect(Object.keys(selecao.refeicoes[0]).sort()).toEqual(['identidadeId','nome','ordem','ativa'].sort());
      const saves = repositorios.get(PlanoAlimentarVersaoOrm)!.save.mock.calls.length;
      const r = await servico.calcularCombinado(TENANT_ID,PACIENTE_ID,usuarioProfissional(),entrada);
      expect(r.nutrientes.energiaKcal.total).toBe(120);
      expect(r.nutrientes.ferroMg.estado).toBe('indisponivel');
      expect(repositorios.get(PlanoAlimentarVersaoOrm)!.save.mock.calls).toHaveLength(saves);
      expect(JSON.stringify(r)).not.toMatch(/Criptograf|objetivos|Alimento manual/);
    });
    it('exclui OFF e revalida precondições mesmo desligado', async () => {
      const entrada = await publicarParaCalculo();
      repositorios.get(PlanoAlimentarOrm)!.registros[0].ativoParaPaciente = false;
      const r = await servico.calcularCombinado(TENANT_ID,PACIENTE_ID,usuarioProfissional(),entrada);
      expect(r.estado).toBe('sem_itens_incluidos');
      repositorios.get(PlanoAlimentarOrm)!.registros[0].ativacaoRevisao = 1;
      await expect(servico.calcularCombinado(TENANT_ID,PACIENTE_ID,usuarioProfissional(),entrada)).rejects.toBeInstanceOf(ConflictException);
    });
    it('falha fechado quando faltar vínculo/estado de refeição, inclusive OFF', async () => {
      const entrada = await publicarParaCalculo();
      repositorios.get(PlanoAlimentarOrm)!.registros[0].ativoParaPaciente = false;
      (gerenciador.query as jest.Mock).mockResolvedValueOnce([]);
      await expect(servico.calcularCombinado(TENANT_ID,PACIENTE_ID,usuarioProfissional(),entrada)).rejects.toBeInstanceOf(ConflictException);
    });
    it('nega seleção inteira com plano alheio, outro tenant/carteira e identidade inválida', async () => {
      const entrada = await publicarParaCalculo();
      await expect(servico.calcularCombinado('outro-tenant',PACIENTE_ID,usuarioProfissional(),entrada)).rejects.toBeInstanceOf(NotFoundException);
      const outro = {...usuarioProfissional(), usuarioId:'10000000-0000-4000-8000-000000000099'};
      await expect(servico.calcularCombinado(TENANT_ID,PACIENTE_ID,outro,entrada)).rejects.toThrow();
      const invalida = {selecoes:[{...entrada.selecoes[0],identidadesRefeicoes:[VERSAO_ID]}]};
      await expect(servico.calcularCombinado(TENANT_ID,PACIENTE_ID,usuarioProfissional(),invalida)).rejects.toBeInstanceOf(ConflictException);
      entrada.selecoes.push({...entrada.selecoes[0],planoId:'10000000-0000-4000-8000-000000000099'});
      await expect(servico.calcularCombinado(TENANT_ID,PACIENTE_ID,usuarioProfissional(),entrada)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('PA06b ativação operacional', () => {
    beforeEach(() => {
      Object.assign(repositorios.get(PlanoAlimentarOrm)!.registros[0], {
        ativoParaPaciente: false, ativacaoDefinida: true, ativacaoRevisao: 0,
        versaoPublicadaAtualId: VERSAO_ID
      });
      repositorios.get(PlanoAlimentarVersaoOrm)!.registros[0].publicadaEm = new Date('2026-10-15T12:00:00Z');
      jest.mocked(gerenciador.query).mockResolvedValue([]);
    });
    it('liga sob lock, incrementa somente a revisão operacional e registra evento mínimo', async () => {
      const resposta = await servico.alterarAtivacao(TENANT_ID, PACIENTE_ID, PLANO_ID, usuarioProfissional(), { ativo: true, ativacaoRevisaoEsperada: 0 });
      expect(resposta).toEqual({ planoId: PLANO_ID, ativoParaPaciente: true, ativacaoRevisao: 1 });
      expect(repositorios.get(PlanoAlimentarOrm)!.findOne).toHaveBeenCalledWith(expect.objectContaining({ lock: { mode: 'pessimistic_write' } }));
      expect(repositorios.get(PlanoAlimentarVersaoOrm)!.save).not.toHaveBeenCalled();
      expect(gerenciador.query).toHaveBeenCalledWith(expect.stringContaining('insert into plano_alimentar_ativacao_eventos'), [TENANT_ID, PLANO_ID, 1, USUARIO_ID, null, true]);
      await expect(servico.alterarAtivacao(TENANT_ID, PACIENTE_ID, PLANO_ID, usuarioProfissional(), { ativo: true, ativacaoRevisaoEsperada: 0 })).rejects.toBeInstanceOf(ConflictException);
    });
    it('no-op não cria revisão; OFF anterior à primeira publicação é uma decisão explícita', async () => {
      expect(await servico.alterarAtivacao(TENANT_ID, PACIENTE_ID, PLANO_ID, usuarioProfissional(), { ativo: false, ativacaoRevisaoEsperada: 0 })).toMatchObject({ ativacaoRevisao: 0 });
      expect(gerenciador.query).not.toHaveBeenCalled();
      Object.assign(repositorios.get(PlanoAlimentarOrm)!.registros[0], { ativacaoDefinida: false, versaoPublicadaAtualId: null });
      expect(await servico.alterarAtivacao(TENANT_ID, PACIENTE_ID, PLANO_ID, usuarioProfissional(), { ativo: false, ativacaoRevisaoEsperada: 0 })).toMatchObject({ ativoParaPaciente: false, ativacaoRevisao: 1 });
    });
    it('não liga rascunho nem aceita revisão/booleano inválidos, papel ou carteira divergentes', async () => {
      const dados = { ativo: true, ativacaoRevisaoEsperada: 0 };
      repositorios.get(PlanoAlimentarOrm)!.registros[0].versaoPublicadaAtualId = null;
      await expect(servico.alterarAtivacao(TENANT_ID, PACIENTE_ID, PLANO_ID, usuarioProfissional(), dados)).rejects.toBeInstanceOf(ConflictException);
      for (const entrada of [{ ativo: 'false', ativacaoRevisaoEsperada: 0 }, { ativo: true, ativacaoRevisaoEsperada: -1 }, { ativo: true, ativacaoRevisaoEsperada: 2147483647 }]) {
        await expect(servico.alterarAtivacao(TENANT_ID, PACIENTE_ID, PLANO_ID, usuarioProfissional(), entrada as never)).rejects.toBeInstanceOf(BadRequestException);
      }
      const semPermissao = { ...usuarioProfissional(), permissoes: [] };
      await expect(servico.alterarAtivacao(TENANT_ID, PACIENTE_ID, PLANO_ID, semPermissao, dados)).rejects.toBeInstanceOf(ForbiddenException);
      repositorios.get(PacienteOrm)!.registros[0].profissionalResponsavelId = 'outro';
      await expect(servico.alterarAtivacao(TENANT_ID, PACIENTE_ID, PLANO_ID, usuarioProfissional(), dados)).rejects.toBeInstanceOf(NotFoundException);
      expect(gerenciador.query).not.toHaveBeenCalled();
    });
    it('recusa identidade de refeição histórica ou fora do plano antes de gravar evento', async () => {
      await expect(servico.alterarAtivacao(TENANT_ID, PACIENTE_ID, PLANO_ID, usuarioProfissional(), { ativo: false, ativacaoRevisaoEsperada: 0 }, VERSAO_ID)).rejects.toBeInstanceOf(NotFoundException);
      expect(repositorios.get(PlanoAlimentarOrm)!.save).not.toHaveBeenCalled();
    });
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

  it('lista a trilha de trocas do plano em ordem decrescente, com o contexto descriptografado', async () => {
    const refeicaoId = '10000000-0000-4000-8000-000000000011';
    const itemId = '10000000-0000-4000-8000-000000000012';
    const substituicaoId = '10000000-0000-4000-8000-000000000013';
    repositorios.get(PlanoAlimentarRefeicaoOrm)!.registros.push({
      id: refeicaoId,
      tenantId: TENANT_ID,
      versaoId: VERSAO_ID,
      ordem: 1,
      nomeCriptografado: criptografia.criptografar('Almoco')
    });
    repositorios.get(PlanoAlimentarItemOrm)!.registros.push({
      id: itemId,
      tenantId: TENANT_ID,
      refeicaoId,
      ordem: 1,
      descricaoCriptografada: criptografia.criptografar('Arroz integral')
    });
    repositorios.get(PlanoAlimentarSubstituicaoOrm)!.registros.push({
      id: substituicaoId,
      tenantId: TENANT_ID,
      itemId,
      ordem: 1,
      descricaoCriptografada: criptografia.criptografar('Batata-doce')
    });
    repositorios.get(PlanoAlimentarEscolhaPacienteOrm)!.registros.push(
      {
        id: '10000000-0000-4000-8000-000000000014',
        tenantId: TENANT_ID,
        versaoId: VERSAO_ID,
        itemId,
        substituicaoId,
        escolhidoPorUsuarioId: '10000000-0000-4000-8000-000000000015',
        criadoEm: new Date('2026-08-20T13:00:00Z')
      },
      {
        id: '10000000-0000-4000-8000-000000000016',
        tenantId: TENANT_ID,
        versaoId: VERSAO_ID,
        itemId,
        escolhidoPorUsuarioId: '10000000-0000-4000-8000-000000000015',
        criadoEm: new Date('2026-08-20T14:00:00Z')
      }
    );

    await expect(
      servico.listarEscolhasPaciente(TENANT_ID, PACIENTE_ID, PLANO_ID, usuarioProfissional(), { pagina: 1, limite: 25 })
    ).resolves.toEqual({
      itens: [
        expect.objectContaining({
          id: '10000000-0000-4000-8000-000000000016',
          versaoNumero: 1,
          refeicaoNome: 'Almoco',
          itemDescricao: 'Arroz integral',
          retornouAoPrincipal: true
        }),
        expect.objectContaining({
          id: '10000000-0000-4000-8000-000000000014',
          versaoNumero: 1,
          refeicaoNome: 'Almoco',
          itemDescricao: 'Arroz integral',
          substituicaoDescricao: 'Batata-doce',
          retornouAoPrincipal: false
        })
      ],
      total: 2,
      pagina: 1,
      limite: 25
    });
  });

  it('nao enumera a trilha de trocas para profissional fora do escopo do paciente', async () => {
    repositorios.get(PacienteOrm)!.registros[0].profissionalResponsavelId = '10000000-0000-4000-8000-000000000099';

    await expect(
      servico.listarEscolhasPaciente(TENANT_ID, PACIENTE_ID, PLANO_ID, usuarioProfissional(), { pagina: 1, limite: 25 })
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repositorios.get(PlanoAlimentarEscolhaPacienteOrm)!.findAndCount).not.toHaveBeenCalled();
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
    const publicadaId = '10000000-0000-4000-8000-000000000008';
    const historicaId = '10000000-0000-4000-8000-000000000009';
    repositorios.get(PlanoAlimentarOrm)!.registros[0].versaoPublicadaAtualId = publicadaId;
    repositorios.get(PlanoAlimentarVersaoOrm)!.registros.push(
      {
        id: publicadaId,
        tenantId: TENANT_ID,
        planoId: PLANO_ID,
        numero: 2,
        criadoPorUsuarioId: USUARIO_ID,
        publicadaEm: new Date('2026-08-02T12:00:00Z'),
        totaisSnapshotCriptografado: criptografia.criptografar(JSON.stringify({
          energiaKcal: 1800, proteinasG: 90, carboidratosG: 200, gordurasG: 60, observacao: 'privada'
        }))
      },
      {
        id: historicaId,
        tenantId: TENANT_ID,
        planoId: PLANO_ID,
        numero: 1,
        criadoPorUsuarioId: USUARIO_ID,
        publicadaEm: new Date('2026-07-02T12:00:00Z'),
        totaisSnapshotCriptografado: criptografia.criptografar(JSON.stringify({
          energiaKcal: 900, proteinasG: 40, carboidratosG: 100, gordurasG: 30
        }))
      }
    );
    const rascunho = repositorios.get(PlanoAlimentarVersaoOrm)!.registros[0];
    rascunho.totaisSnapshotCriptografado = criptografia.criptografar(JSON.stringify({
      energiaKcal: 0, proteinasG: 20, carboidratosG: 30, gordurasG: 5
    }));
    const resultado = await servico.listar(TENANT_ID, PACIENTE_ID, usuarioProfissional());

    expect(resultado.itens).toEqual([
      expect.objectContaining({
        id: PLANO_ID,
        titulo: 'Plano principal',
        current: expect.objectContaining({
          id: publicadaId,
          resumoNutricional: { estado: 'completo', energiaKcal: 1800, proteinasG: 90, carboidratosG: 200, gordurasG: 60 }
        }),
        draft: expect.objectContaining({
          id: VERSAO_ID,
          numero: 1,
          status: 'rascunho',
          resumoNutricional: { estado: 'completo', energiaKcal: 0, proteinasG: 20, carboidratosG: 30, gordurasG: 5 }
        }),
        historicoQuantidade: 2
      })
    ]);
    expect(JSON.stringify(resultado)).not.toContain('observacao');
    expect(JSON.stringify(resultado)).not.toContain('totaisSnapshotCriptografado');
    expect(resultado.itens[0]).not.toHaveProperty('historico');
    const consultaPlanos = repositorios.get(PlanoAlimentarOrm)!.findAndCount.mock.calls[0][0];
    expect(consultaPlanos.select).toEqual({
      id: true,
      pacienteId: true,
      profissionalId: true,
      tituloCriptografado: true,
      versaoPublicadaAtualId: true,
      ativoParaPaciente: true,
      ativacaoRevisao: true,
      criadoEm: true,
      atualizadoEm: true
    });
    expect(consultaPlanos.select).not.toHaveProperty('criadoPorUsuarioId');
    const consultasVersoes = repositorios.get(PlanoAlimentarVersaoOrm)!.find.mock.calls.map(([opcoes]) => opcoes);
    expect(consultasVersoes).toHaveLength(2);
    expect(consultasVersoes[0].select).not.toHaveProperty('totaisSnapshotCriptografado');
    expect(consultasVersoes[1].select).toEqual({ id: true, totaisSnapshotCriptografado: true });
    expect(valorDoOperador(consultasVersoes[1].where.id).valor).toEqual(expect.arrayContaining([VERSAO_ID, publicadaId]));
    expect(valorDoOperador(consultasVersoes[1].where.id).valor).not.toContain(historicaId);
    expect(repositorios.get(PacienteOrm)!.findOne.mock.calls[0][0].lock).toEqual({ mode: 'pessimistic_read' });
    expect(repositorios.get(PlanoAlimentarRefeicaoOrm)!.find).not.toHaveBeenCalled();
    expect(repositorios.get(PlanoAlimentarItemOrm)!.find).not.toHaveBeenCalled();
    expect(repositorios.get(PlanoAlimentarSubstituicaoOrm)!.find).not.toHaveBeenCalled();
  });

  it('mantem a busca de versoes limitada a atual e rascunho, contando o historico por agregacao', async () => {
    const versoes = repositorios.get(PlanoAlimentarVersaoOrm)!;
    const publicadaId = '10000000-0000-4000-8000-000000000008';
    repositorios.get(PlanoAlimentarOrm)!.registros[0].versaoPublicadaAtualId = publicadaId;
    versoes.registros[0].publicadaEm = undefined;
    versoes.registros.push({
      id: publicadaId, tenantId: TENANT_ID, planoId: PLANO_ID, numero: 2,
      criadoPorUsuarioId: USUARIO_ID, publicadaEm: new Date('2026-08-02T12:00:00Z')
    });
    for (let numero = 3; numero < 80; numero += 1) {
      versoes.registros.push({
        id: `historica-${numero}`, tenantId: TENANT_ID, planoId: PLANO_ID, numero,
        criadoPorUsuarioId: USUARIO_ID, publicadaEm: new Date(`2026-08-${String((numero % 27) + 1).padStart(2, '0')}T12:00:00Z`)
      });
    }
    (gerenciador.query as jest.Mock).mockResolvedValue([{ planoId: PLANO_ID, quantidade: 78 }]);

    const resultado = await servico.listar(TENANT_ID, PACIENTE_ID, usuarioProfissional());

    expect(resultado.itens[0].historicoQuantidade).toBe(78);
    const consultaMetadados = versoes.find.mock.calls[0][0];
    expect(consultaMetadados.select).not.toHaveProperty('calculoSnapshotCriptografado');
    expect(consultaMetadados.select).not.toHaveProperty('totaisSnapshotCriptografado');
    expect(consultaMetadados.where).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: expect.objectContaining({ _value: [publicadaId] }) }),
      expect.objectContaining({ planoId: expect.objectContaining({ _value: [PLANO_ID] }), publicadaEm: expect.anything(), descartadaEm: expect.anything() })
    ]));
    expect((gerenciador.query as jest.Mock).mock.calls[0][1]).toEqual([TENANT_ID, [PLANO_ID]]);
    expect((gerenciador.query as jest.Mock).mock.calls[0][0]).toContain('COUNT(*)');
    expect(resultado.itens[0].current?.id).toBe(publicadaId);
    expect(resultado.itens[0].draft?.id).toBe(VERSAO_ID);
  });

  it('mantem a listagem autorizada e oculta falha de decriptacao do snapshot', async () => {
    repositorios.get(PlanoAlimentarVersaoOrm)!.registros[0].totaisSnapshotCriptografado = Buffer.from('ciphertext-invalido');

    const resultado = await servico.listar(TENANT_ID, PACIENTE_ID, usuarioProfissional());

    expect(resultado.itens[0].draft?.resumoNutricional).toEqual({ estado: 'indisponivel' });
    expect(JSON.stringify(resultado)).not.toContain('Conteudo cifrado invalido');
    expect(JSON.stringify(resultado)).not.toContain('ciphertext-invalido');
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

    // `null`, nao `undefined`: o TypeORM ignora propriedade `undefined` no save,
    // entao so `null` invalida de fato a revisao no banco depois de uma edicao.
    expect(versao.revisadaEm).toBeNull();
    expect(versao.revisadaPorUsuarioId).toBeNull();
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

  describe('caminho manual para condicao especial (PB-14)', () => {
    function dadosManuais(
      metodo: MetodoMacrosManual,
      alimentoComposicaoId?: string
    ): AtualizarRascunhoPlanoAlimentarDto {
      const dados = dadosRascunho(alimentoComposicaoId);
      dados.origemMeta = 'manual';
      dados.possuiCondicaoEspecial = true;
      dados.justificativaCondicaoEspecial = 'Doenca renal cronica em tratamento conservador.';
      dados.metodoMacrosManual = metodo;
      dados.aplicabilidadeFormulaConfirmada = false;
      if (metodo === 'percentual') {
        dados.metaEnergeticaManualKcal = 1800;
      } else {
        dados.macrosGramasPorKg = {
          carboidratosGPorKg: 3,
          proteinasGPorKg: 0.6,
          gordurasGPorKg: 1
        };
      }
      return dados;
    }

    it('aceita meta manual em percentual sem aplicar formula', async () => {
      const resposta = await servico.atualizarRascunho(
        TENANT_ID,
        PACIENTE_ID,
        PLANO_ID,
        usuarioProfissional(),
        dadosManuais('percentual')
      );
      const versao = repositorios.get(PlanoAlimentarVersaoOrm)!.registros[0] as PlanoAlimentarVersaoOrm;

      // `null` limpa a coluna de verdade: um rascunho que comecou pela formula
      // e virou manual nao pode manter o codigo da formula antiga no banco.
      expect(versao.formulaCodigo).toBeNull();
      expect(versao.formulaVersao).toBeNull();
      // Nenhuma estimativa preditiva foi produzida no caminho manual.
      expect((resposta.calculo as { estimativa?: unknown }).estimativa).toBeUndefined();
      expect(resposta.calculo).toEqual(
        expect.objectContaining({
          origemMeta: 'manual',
          metodoMacrosManual: 'percentual',
          possuiCondicaoEspecial: true,
          metaEnergeticaKcal: 1800,
          // 50/20/30 de 1800 kcal, pelo mesmo motor do caminho automatico.
          metasMacronutrientes: { carboidratosG: 225, proteinasG: 90, gordurasG: 60 }
        })
      );
    });

    it('aceita meta manual em g/kg e deriva a energia dos macros prescritos', async () => {
      const resposta = await servico.atualizarRascunho(
        TENANT_ID,
        PACIENTE_ID,
        PLANO_ID,
        usuarioProfissional(),
        dadosManuais('gramas_por_kg')
      );

      // Peso da avaliacao vinculada: 80 kg.
      expect(resposta.calculo).toEqual(
        expect.objectContaining({
          origemMeta: 'manual',
          metodoMacrosManual: 'gramas_por_kg',
          metasMacronutrientes: { carboidratosG: 240, proteinasG: 48, gordurasG: 80 },
          metaEnergeticaKcal: 240 * 4 + 48 * 4 + 80 * 9
        })
      );
    });

    it('recusa meta manual sem condicao especial para nao virar atalho da formula', async () => {
      const dados = dadosManuais('percentual');
      dados.possuiCondicaoEspecial = false;

      await expect(
        servico.atualizarRascunho(TENANT_ID, PACIENTE_ID, PLANO_ID, usuarioProfissional(), dados)
      ).rejects.toThrow('condicao especial');
      expect(executor.executar).not.toHaveBeenCalled();
    });

    it('exige justificativa da condicao especial no caminho manual', async () => {
      const dados = dadosManuais('percentual');
      dados.justificativaCondicaoEspecial = '   ';

      await expect(
        servico.atualizarRascunho(TENANT_ID, PACIENTE_ID, PLANO_ID, usuarioProfissional(), dados)
      ).rejects.toThrow('justificativa');
      expect(executor.executar).not.toHaveBeenCalled();
    });

    it('permite revisar e publicar um plano feito pelo caminho manual', async () => {
      const dados = dadosManuais('percentual');
      dados.justificativaDivergenciaClinica = 'Meta pactuada com a equipe de nefrologia.';
      await servico.atualizarRascunho(TENANT_ID, PACIENTE_ID, PLANO_ID, usuarioProfissional(), dados);

      await expect(
        servico.revisar(TENANT_ID, PACIENTE_ID, PLANO_ID, usuarioProfissional())
      ).resolves.toBeDefined();
      await expect(
        servico.publicar(TENANT_ID, PACIENTE_ID, PLANO_ID, usuarioProfissional())
      ).resolves.toBeDefined();
    });
  });

  it.each([false,true])('primeira publicação ativa somente plano sem decisão OFF prévia (%s)', async desligado => {
    await servico.atualizarRascunho(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),dadosRascunho());
    if (desligado) await servico.alterarAtivacao(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),{ativo:false,ativacaoRevisaoEsperada:0});
    await servico.revisar(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional());
    const publicado=await servico.publicar(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional());
    expect(publicado.ativoParaPaciente).toBe(!desligado);
    expect(publicado.ativacaoRevisao).toBe(1);
    expect(publicado.resumoNutricionalVigente).toMatchObject({estado:'completo',energiaKcal:desligado ? 0 : 120});
  });

  it('primeira publicação invalida baseline operacional anterior e impressão respeita OFF', async () => {
    await servico.atualizarRascunho(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),dadosRascunho());
    await servico.revisar(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional());
    const publicado=await servico.publicar(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional());
    await expect(servico.alterarAtivacao(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),{ativo:false,ativacaoRevisaoEsperada:0})).rejects.toBeInstanceOf(ConflictException);
    await servico.alterarAtivacao(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),{ativo:false,ativacaoRevisaoEsperada:publicado.ativacaoRevisao});
    await expect(servico.obterApresentacaoPaciente(TENANT_ID,PACIENTE_ID,PLANO_ID,1,usuarioProfissional())).rejects.toBeInstanceOf(ConflictException);
    expect((await servico.obterVersao(TENANT_ID,PACIENTE_ID,PLANO_ID,1,usuarioProfissional())).refeicoes).toHaveLength(1);
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
    // A escrita da trilha reusa a transacao ja aberta -- por isso o contador
    // fica em 3 e nao em 4. Abrir a quarta pediria uma segunda conexao do pool
    // enquanto a primeira segura `pessimistic_write` sobre plano e versao, e
    // faria a linha de auditoria comitar independentemente do negocio.
    expect(executor.executar).toHaveBeenCalledTimes(3);
    // O digest do conteudo clinico nao entra na trilha: `versaoId` ao lado ja
    // identifica o artefato, entao o hash so acrescentaria um oraculo de
    // confirmacao sobre a dieta. Fica o booleano de presenca.
    expect(auditorias[0].metadados).toEqual({
      pacienteId: PACIENTE_ID,
      versaoId: VERSAO_ID,
      numeroVersao: expect.any(Number),
      possuiHashConteudo: true
    });
    expect(JSON.stringify(auditorias[0].metadados)).not.toContain(versao.hashConteudo);
    expect(repositorios.get(MensagemNotificacaoOrm)!.save).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: TENANT_ID,
      pacienteId: PACIENTE_ID,
      status: 'enviado',
      payload: { evento: 'plano_publicado_portal' },
      chaveIdempotencia: `plano-publicado:${PACIENTE_ID}:${VERSAO_ID}:portal`
    }));
    expect(repositorios.get(OutboxEventoOrm)!.save).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: TENANT_ID,
      tipo: 'plano_alimentar.publicado',
      payload: { pacienteId: PACIENTE_ID, planoId: PLANO_ID, versaoId: VERSAO_ID }
    }));
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

  it('congela micros USDA normalizados da base e recusa override manual do catálogo', async () => {
    const alimentoId = '10000000-0000-4000-8000-000000000010';
    const fonteId = '10000000-0000-4000-8000-000000000011';
    repositorios.get(AlimentoComposicaoOrm)!.registros.push({id:alimentoId,fonteId,codigoOrigem:'sintetico',nome:'USDA sintético',baseGramas:'10',energiaKcal:'10',proteinasG:'1',carboidratosG:'1',lipidiosG:'1',micronutrientes:{metadadosOrigem:{nutrientsOriginal:[{nutrient:{id:1089,unitName:'MG'},amount:2}]}}});
    repositorios.get(FonteComposicaoAlimentoOrm)!.registros.push({id:fonteId,codigo:'usda_fdc_foundation',nome:'Fonte sintética',versao:'teste',situacao:'ativa',esquemaVersao:'octaclin-composicao-v1',hashConteudo:'a'.repeat(64)});
    const entrada = dadosRascunho(alimentoId); entrada.refeicoes[0].itens[0].porcaoGramas=50;
    const resposta = await servico.atualizarRascunho(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),entrada);
    expect(resposta.refeicoes[0].itens[0].composicaoSnapshot).toHaveProperty('micronutrientes.nutrientes.ferroMg.porcao',10);
    Object.assign(entrada.refeicoes[0].itens[0],{micronutrientesPor100g:{ferroMg:99}});
    await expect(servico.atualizarRascunho(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),entrada)).rejects.toThrow('alteração manual');
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

  it('expõe a identificação IBGE, código externo e metadados de origem no resultado de busca', async () => {
    const FONTE_IBGE = '10000000-0000-4000-8000-000000000045';
    repositorios.get(FonteComposicaoAlimentoOrm)!.registros.push({
      id: FONTE_IBGE,
      codigo: 'ibge_pof_2008_2009',
      nome: 'IBGE — POF 2008–2009: Tabelas de Composição Nutricional',
      versao: 'pof-2008-2009-2011-v1',
      baseCodigo: 'pof-2008-2009-composicao',
      situacao: 'ativa'
    });
    repositorios.get(AlimentoComposicaoOrm)!.registros.push({
      id: '10000000-0000-4000-8000-000000000046',
      fonteId: FONTE_IBGE,
      codigoOrigem: '6300701:2',
      nome: 'MILHO (EM GRAO)',
      preparacao: 'COZIDO(A)',
      baseGramas: '100',
      energiaKcal: '160.141',
      proteinasG: '3.32',
      carboidratosG: '25.11',
      lipidiosG: '7.178',
      micronutrientes: {
        metadadosOrigem: {
          codigoAlimento: '6300701',
          codigoPreparacao: '2',
          referenciaCodigo: '1',
          referenciaDescricao: 'Fonte de referência sintetizada'
        }
      }
    });

    const resultado = await servico.buscarAlimentos(TENANT_ID, usuarioProfissional(), {
      busca: 'milho', pagina: 1, limite: 20, fonteCodigo: 'ibge_pof_2008_2009'
    });

    expect(resultado.fontes).toContainEqual(expect.objectContaining({
      codigo: 'ibge_pof_2008_2009',
      versao: 'pof-2008-2009-2011-v1',
      baseCodigo: 'pof-2008-2009-composicao'
    }));
    expect(resultado.itens).toEqual([expect.objectContaining({
      codigoOrigem: '6300701:2',
      preparacao: 'COZIDO(A)',
      metadadosOrigem: expect.objectContaining({ codigoAlimento: '6300701', codigoPreparacao: '2' }),
      fonte: expect.objectContaining({ codigo: 'ibge_pof_2008_2009', nome: expect.stringContaining('IBGE'), versao: 'pof-2008-2009-2011-v1' })
    })]);
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

  it('projeta fatos da janela publicada sem inferir adesao nem atribuir envio sem data', async () => {
    const publicadaEm = new Date('2026-08-01T12:00:00Z');
    const proximaPublicacao = new Date('2026-09-01T12:00:00Z');
    const proximaVersaoId = '10000000-0000-4000-8000-000000000063';
    const itemId = '10000000-0000-4000-8000-000000000064';
    const refeicaoId = '10000000-0000-4000-8000-000000000065';
    const substituicaoId = '10000000-0000-4000-8000-000000000066';
    const itemOutraVersaoId = '10000000-0000-4000-8000-000000000075';
    const refeicaoOutraVersaoId = '10000000-0000-4000-8000-000000000076';
    const substituicaoOutraVersaoId = '10000000-0000-4000-8000-000000000077';
    Object.assign(repositorios.get(PlanoAlimentarVersaoOrm)!.registros[0], { publicadaEm });
    repositorios.get(PlanoAlimentarVersaoOrm)!.registros.push({
      id: proximaVersaoId,
      tenantId: TENANT_ID,
      planoId: PLANO_ID,
      numero: 2,
      criadoPorUsuarioId: USUARIO_ID,
      publicadaEm: proximaPublicacao
    });
    repositorios.get(PlanoAlimentarRefeicaoOrm)!.registros.push({
      id: refeicaoId,
      tenantId: TENANT_ID,
      versaoId: VERSAO_ID,
      ordem: 0,
      nomeCriptografado: criptografia.criptografar('Cafe da manha')
    }, {
      id: refeicaoOutraVersaoId,
      tenantId: TENANT_ID,
      versaoId: proximaVersaoId,
      ordem: 0,
      nomeCriptografado: criptografia.criptografar('Conteudo de outra versao')
    });
    repositorios.get(PlanoAlimentarItemOrm)!.registros.push({
      id: itemId,
      tenantId: TENANT_ID,
      refeicaoId,
      ordem: 0,
      descricaoCriptografada: criptografia.criptografar('Pao integral')
    }, {
      id: itemOutraVersaoId,
      tenantId: TENANT_ID,
      refeicaoId: refeicaoOutraVersaoId,
      ordem: 0,
      descricaoCriptografada: criptografia.criptografar('Item de outra versao')
    });
    repositorios.get(PlanoAlimentarSubstituicaoOrm)!.registros.push({
      id: substituicaoId,
      tenantId: TENANT_ID,
      itemId,
      ordem: 0,
      descricaoCriptografada: criptografia.criptografar('Tapioca')
    }, {
      id: substituicaoOutraVersaoId,
      tenantId: TENANT_ID,
      itemId: itemOutraVersaoId,
      ordem: 0,
      descricaoCriptografada: criptografia.criptografar('Substituicao de outra versao')
    });
    repositorios.get(PlanoAlimentarEscolhaPacienteOrm)!.registros.push({
      id: '10000000-0000-4000-8000-000000000067',
      tenantId: TENANT_ID,
      versaoId: VERSAO_ID,
      itemId,
      substituicaoId,
      escolhidoPorUsuarioId: USUARIO_ID,
      criadoEm: new Date('2026-08-20T12:00:00Z')
    }, {
      id: '10000000-0000-4000-8000-000000000078',
      tenantId: TENANT_ID,
      versaoId: VERSAO_ID,
      itemId: itemOutraVersaoId,
      substituicaoId: substituicaoOutraVersaoId,
      escolhidoPorUsuarioId: USUARIO_ID,
      criadoEm: new Date('2026-08-21T12:00:00Z')
    });
    repositorios.get(LogDiarioRapidoOrm)!.registros.push(
      {
        id: '10000000-0000-4000-8000-000000000068', tenantId: TENANT_ID,
        pacienteId: PACIENTE_ID, tipo: 'humor', registradoEm: publicadaEm,
        valorCriptografado: criptografia.criptografar(JSON.stringify({ adesaoPlano: 80 }))
      },
      {
        id: '10000000-0000-4000-8000-000000000069', tenantId: TENANT_ID,
        pacienteId: PACIENTE_ID, tipo: 'humor', registradoEm: new Date('2026-08-15T12:00:00Z'),
        valorCriptografado: criptografia.criptografar(JSON.stringify({ humor: 'bem' }))
      },
      {
        id: '10000000-0000-4000-8000-000000000074', tenantId: TENANT_ID,
        pacienteId: PACIENTE_ID, tipo: 'humor', registradoEm: new Date('2026-08-16T12:00:00Z'),
        valorCriptografado: Buffer.from('cifra-invalida')
      },
      {
        id: '10000000-0000-4000-8000-000000000070', tenantId: TENANT_ID,
        pacienteId: PACIENTE_ID, tipo: 'humor', registradoEm: proximaPublicacao,
        valorCriptografado: criptografia.criptografar(JSON.stringify({ adesaoPlano: 20 }))
      }
    );
    repositorios.get(EnvioQuestionarioOrm)!.registros.push(
      {
        id: '10000000-0000-4000-8000-000000000071', tenantId: TENANT_ID,
        pacienteId: PACIENTE_ID, questionarioId: '10000000-0000-4000-8000-000000000081',
        status: 'enviado', enviadoEm: new Date('2026-08-10T12:00:00Z'),
        snapshotEstrutura: { versaoQuestionario: 1, titulo: 'Check-in semanal', perguntas: [] }
      },
      {
        id: '10000000-0000-4000-8000-000000000072', tenantId: TENANT_ID,
        pacienteId: PACIENTE_ID, questionarioId: '10000000-0000-4000-8000-000000000082',
        status: 'pendente'
      },
      {
        id: '10000000-0000-4000-8000-000000000073', tenantId: TENANT_ID,
        pacienteId: PACIENTE_ID, questionarioId: '10000000-0000-4000-8000-000000000083',
        status: 'respondido', enviadoEm: new Date('2026-08-12T12:00:00Z'),
        respondidoEm: new Date('2026-08-13T12:00:00Z')
      }
    );

    const resultado = await servico.obterAcompanhamentoVersao(
      TENANT_ID, PACIENTE_ID, PLANO_ID, 1, usuarioProfissional(),
      { paginaCheckins: 1, paginaQuestionarios: 1, paginaEscolhas: 1, limite: 25 }
    );

    expect(resultado.periodo).toEqual({ inicioEm: publicadaEm, fimExclusivoEm: proximaPublicacao });
    expect(resultado.checkins.itens).toEqual([
      expect.objectContaining({ id: '10000000-0000-4000-8000-000000000074', dadoIndisponivel: true }),
      expect.objectContaining({ id: '10000000-0000-4000-8000-000000000069', adesaoPlano: undefined }),
      expect.objectContaining({ id: '10000000-0000-4000-8000-000000000068', adesaoPlano: 80 })
    ]);
    expect(resultado.checkins.itens).not.toContainEqual(expect.objectContaining({ adesaoPlano: 20 }));
    expect(resultado.questionariosSemResposta).toEqual(expect.objectContaining({
      total: 1,
      semReferenciaTemporal: 1,
      itens: [expect.objectContaining({ status: 'enviado', titulo: 'Check-in semanal' })]
    }));
    expect(resultado.escolhas.itens).toEqual([
      expect.objectContaining({
        id: '10000000-0000-4000-8000-000000000078',
        refeicaoNome: 'Refeicao indisponivel',
        itemDescricao: 'Item indisponivel'
      }),
      expect.objectContaining({ versaoId: VERSAO_ID, substituicaoDescricao: 'Tapioca' })
    ]);
    expect(resultado.escolhas.itens[0]).not.toHaveProperty('substituicaoDescricao');
    expect(JSON.stringify(resultado.escolhas.itens)).not.toContain('outra versao');
  });

  it('nao consulta fatos quando a versao nao foi publicada ou o paciente saiu da carteira', async () => {
    await expect(
      servico.obterAcompanhamentoVersao(TENANT_ID, PACIENTE_ID, PLANO_ID, 1, usuarioProfissional())
    ).rejects.toBeInstanceOf(BadRequestException);

    Object.assign(repositorios.get(PlanoAlimentarVersaoOrm)!.registros[0], {
      publicadaEm: new Date('2026-08-01T12:00:00Z')
    });
    repositorios.get(PacienteOrm)!.registros[0].profissionalResponsavelId =
      '10000000-0000-4000-8000-000000000099';

    await expect(
      servico.obterAcompanhamentoVersao(TENANT_ID, PACIENTE_ID, PLANO_ID, 1, usuarioProfissional())
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repositorios.get(LogDiarioRapidoOrm)!.findAndCount).not.toHaveBeenCalled();
    expect(repositorios.get(EnvioQuestionarioOrm)!.findAndCount).not.toHaveBeenCalled();
  });

  it('nega papel, permissao e plano de outro tenant antes de consultar fatos clinicos', async () => {
    const semPermissao: UsuarioAutenticado = { ...usuarioProfissional(), permissoes: [] };
    const gestor: UsuarioAutenticado = {
      ...usuarioProfissional(),
      papel: 'Client',
      permissoes: ['planos_alimentares.ler']
    };

    await expect(
      servico.obterAcompanhamentoVersao(TENANT_ID, PACIENTE_ID, PLANO_ID, 1, semPermissao)
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      servico.obterAcompanhamentoVersao(TENANT_ID, PACIENTE_ID, PLANO_ID, 1, gestor)
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(executor.executar).not.toHaveBeenCalled();

    Object.assign(repositorios.get(PlanoAlimentarVersaoOrm)!.registros[0], {
      publicadaEm: new Date('2026-08-01T12:00:00Z')
    });
    repositorios.get(PlanoAlimentarOrm)!.registros[0].tenantId =
      '10000000-0000-4000-8000-000000000099';

    await expect(
      servico.obterAcompanhamentoVersao(TENANT_ID, PACIENTE_ID, PLANO_ID, 1, usuarioProfissional())
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repositorios.get(LogDiarioRapidoOrm)!.findAndCount).not.toHaveBeenCalled();
    expect(repositorios.get(EnvioQuestionarioOrm)!.findAndCount).not.toHaveBeenCalled();
  });


  describe('substituicoes liberadas ao paciente', () => {
    function rascunhoComAlternativa(extra: Record<string, unknown> = {}) {
      const dados = dadosRascunho();
      dados.refeicoes[0].itens[0] = {
        ...dados.refeicoes[0].itens[0],
        substituicoes: [
          {
            descricao: 'Pao integral',
            quantidade: 1,
            unidade: 'fatia',
            porcaoGramas: 30,
            nutrientesPor100g: { energiaKcal: 250, proteinasG: 9, carboidratosG: 45, gordurasG: 3 },
            liberadaParaPaciente: true,
            preferida: true
          },
          {
            descricao: 'Tapioca',
            quantidade: 1,
            unidade: 'unidade',
            porcaoGramas: 40,
            nutrientesPor100g: { energiaKcal: 240, proteinasG: 0, carboidratosG: 60, gordurasG: 0 },
            liberadaParaPaciente: false,
            preferida: false
          }
        ],
        ...extra
      } as never;
      return dados;
    }

    it('persiste liberacao, preferencia e limite de exibicao', async () => {
      await servico.atualizarRascunho(
        TENANT_ID,
        PACIENTE_ID,
        PLANO_ID,
        usuarioProfissional(),
        rascunhoComAlternativa({ substituicoesVisiveisInicialmente: 1 })
      );

      const substituicoes = repositorios.get(PlanoAlimentarSubstituicaoOrm)!
        .registros as PlanoAlimentarSubstituicaoOrm[];
      expect(substituicoes).toHaveLength(2);
      expect(substituicoes[0]).toEqual(
        expect.objectContaining({ liberadaParaPaciente: true, preferida: true })
      );
      expect(substituicoes[1]).toEqual(
        expect.objectContaining({ liberadaParaPaciente: false, preferida: false })
      );
      const itens = repositorios.get(PlanoAlimentarItemOrm)!.registros as PlanoAlimentarItemOrm[];
      expect(itens[0].substituicoesVisiveisInicialmente).toBe(1);
    });

    it('assume nao liberada quando o profissional nao decide', async () => {
      const dados = rascunhoComAlternativa();
      delete (dados.refeicoes[0].itens[0].substituicoes[0] as unknown as Record<string, unknown>).liberadaParaPaciente;
      delete (dados.refeicoes[0].itens[0].substituicoes[0] as unknown as Record<string, unknown>).preferida;

      await servico.atualizarRascunho(TENANT_ID, PACIENTE_ID, PLANO_ID, usuarioProfissional(), dados);

      // Exposicao ao paciente e decisao explicita: a ausencia nunca vira um sim.
      expect(repositorios.get(PlanoAlimentarSubstituicaoOrm)!.registros[0]).toEqual(
        expect.objectContaining({ liberadaParaPaciente: false, preferida: false })
      );
    });

    it('devolve as decisoes na leitura da versao', async () => {
      const resposta = await servico.atualizarRascunho(
        TENANT_ID,
        PACIENTE_ID,
        PLANO_ID,
        usuarioProfissional(),
        rascunhoComAlternativa({ substituicoesVisiveisInicialmente: 2 })
      );

      const item = resposta.refeicoes[0].itens[0];
      expect(item.substituicoesVisiveisInicialmente).toBe(2);
      expect(item.substituicoes[0]).toEqual(
        expect.objectContaining({ liberadaParaPaciente: true, preferida: true })
      );
    });

    it('preserva as decisoes ao abrir uma nova versao', async () => {
      await servico.atualizarRascunho(
        TENANT_ID,
        PACIENTE_ID,
        PLANO_ID,
        usuarioProfissional(),
        rascunhoComAlternativa({ substituicoesVisiveisInicialmente: 1 })
      );
      await servico.revisar(TENANT_ID, PACIENTE_ID, PLANO_ID, usuarioProfissional());
      await servico.publicar(TENANT_ID, PACIENTE_ID, PLANO_ID, usuarioProfissional());
      await servico.criarNovaVersao(TENANT_ID, PACIENTE_ID, PLANO_ID, usuarioProfissional());

      const substituicoes = repositorios.get(PlanoAlimentarSubstituicaoOrm)!
        .registros as PlanoAlimentarSubstituicaoOrm[];
      // Clonar perdendo a liberacao devolveria ao paciente um plano novo sem as
      // trocas que ele ja usava, sem ninguem ter decidido isso.
      expect(substituicoes.filter((substituicao) => substituicao.liberadaParaPaciente)).toHaveLength(2);
      const itens = repositorios.get(PlanoAlimentarItemOrm)!.registros as PlanoAlimentarItemOrm[];
      expect(itens.every((item) => item.substituicoesVisiveisInicialmente === 1)).toBe(true);
    });
  });
  describe('PA06 — revisão geral de edição', () => {
    const documentoParcial = () => ({
      schemaVersao: 1,
      objetivos: '',
      avaliacaoAntropometricaId: '',
      refeicoes: [{ chaveCliente: 'refeicao-sintetica', nome: 'Almoço', itens: [{
        chaveCliente: 'item-sintetico', descricao: 'Alimento sintético', quantidade: 1,
        unidade: 'porção', porcaoGramas: 80,
        nutrientesPor100g: { energiaKcal: 100, carboidratosG: 10, proteinasG: 5, gordurasG: 2 },
        substituicoes: []
      }] }]
    });
    async function salvarEdicao(documento: unknown, revisao = 0) {
      return servico.salvarEdicaoRascunho(TENANT_ID, PACIENTE_ID, PLANO_ID, usuarioProfissional(), {
        rascunhoIdEsperado: VERSAO_ID, rascunhoRevisaoEsperada: revisao, documento
      } as SalvarEdicaoPlanoDto);
    }
    const documentoCompleto = () => ({ ...documentoParcial(),
      avaliacaoAntropometricaId: AVALIACAO_ID,
      formula: 'mifflin_st_jeor_1990', fatorAtividade: 1.4, ajusteEnergeticoKcal: 0,
      carboidratosBasisPoints: 5000, proteinasBasisPoints: 2000, gordurasBasisPoints: 3000,
      possuiCondicaoEspecial: false, aplicabilidadeFormulaConfirmada: true,
      objetivos: 'Objetivo sintético de acompanhamento',
      justificativaDivergenciaClinica: 'Planejamento sintético revisado individualmente.'
    });
    async function prepararEquivalencia(catalogo=false,principalCatalogo=false) {
      repositorios.get(PlanoAlimentarVersaoOrm)!.registros[0].rascunhoRevisao=0;
      const d:any=documentoCompleto();
      const a:any={chaveCliente:'equivalente',descricao:'Alternativa FOOD05',quantidade:1,unidade:'porção',nutrientesPor100g:{energiaKcal:160,proteinasG:8,carboidratosG:16,gordurasG:4},liberadaParaPaciente:false,preferida:false};
      if(catalogo||principalCatalogo){
        const fid='10000000-0000-4000-8000-000000000086',aid='10000000-0000-4000-8000-000000000087';
        repositorios.get(FonteComposicaoAlimentoOrm)!.registros.push({id:fid,codigo:'usda_fdc_foundation',nome:'Fonte sintética',versao:'1',situacao:'ativa',direitoUsoStatus:'aprovado',esquemaVersao:'octaclin-composicao-v1',hashConteudo:'a'.repeat(64)});
        repositorios.get(AlimentoComposicaoOrm)!.registros.push({id:aid,fonteId:fid,codigoOrigem:'SINTETICO',nome:'Alternativa catalogada',preparacao:'Cozido',baseGramas:'100',energiaKcal:'160',proteinasG:'8',carboidratosG:'16',lipidiosG:'4',micronutrientes:{metadadosOrigem:{nutrientsOriginal:[{nutrient:{id:1089,unitName:'MG'},amount:2}]}}});if(catalogo)a.alimentoComposicaoId=aid;
        if(principalCatalogo){const principal=d.refeicoes[0].itens[0];principal.alimentoComposicaoId=aid;delete principal.nutrientesPor100g;}
      }
      d.refeicoes[0].itens[0].substituicoes=[a];
      const fontes=new FontesGruposSubstituicoes(criptografia);
      const previaServico=new ServicoEquivalenciasPlano(executor as any,criptografia,fontes,new ServicoGruposSubstituicoes(executor as any,criptografia,fontes));
      const previa=await previaServico.prever(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),{versaoId:VERSAO_ID,rascunhoRevisaoEsperada:0,documentoEdicao:d,itemChave:d.refeicoes[0].itens[0].chaveCliente,nutriente:'energiaKcal',alternativas:[a],politica:{passoPorcaoGramas:'1'}});
      const linha=previa.alternativas[0];if(linha.resultado.estado!=='calculavel')throw new Error('Prévia sintética deveria calcular');
      const aplicacaoId=randomUUID();a.porcaoGramas=linha.resultado.porcaoEfetivaGramas;a.equivalencia={acao:'calcular',aplicacaoId,nutriente:'energiaKcal',politica:{passoPorcaoGramas:'1'},porcaoEfetiva:a.porcaoGramas,fingerprintEsperado:linha.fingerprint};
      return {d,aplicacaoId};
    }
    it('FOOD05 save consome comando, congela cálculo e devolve referência sem liberar ao paciente',async()=>{
      const {d,aplicacaoId}=await prepararEquivalencia();const salvo:any=await salvarEdicao(d);
      expect(salvo.documentoEdicao.refeicoes[0].itens[0].substituicoes[0].equivalencia).toEqual({aplicacaoId});
      expect(salvo.equivalenciasAplicadas.equivalente).toMatchObject({aplicacaoId,estado:'calculada_revisada',nutriente:'energiaKcal',porcaoEfetivaGramas:'50'});
      expect(repositorios.get(PlanoAlimentarSubstituicaoOrm)!.registros[0].motorCalculoVersao).toBe('nutricao-decimal-v1');
      const cipher=repositorios.get(PlanoAlimentarVersaoOrm)!.registros[0].edicaoSnapshotCriptografado;expect(JSON.parse(criptografia.descriptografar(cipher)).schemaSnapshotEdicao).toBe(3);
      expect(salvo.refeicoes[0].itens[0].substituicoes[0]).toMatchObject({porcaoGramas:50,liberadaParaPaciente:false,preferida:false,composicaoSnapshot:{nutrientesPorcao:{energiaKcal:80}}});
      expect(JSON.stringify(salvo.equivalenciasAplicadas)).not.toMatch(/comandoHash|snapshotAlternativa|dependenciasHash|ator/);
    });
    it('FOOD05 nova versão mantém chaves editoriais, referências e proteção contra PATCH legado',async()=>{
      const {d,aplicacaoId}=await prepararEquivalencia(true);await salvarEdicao(d);
      const esperado={rascunhoIdEsperado:VERSAO_ID,rascunhoRevisaoEsperada:1};
      await servico.revisar(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),esperado);
      await servico.publicar(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),{...esperado,rascunhoRevisaoEsperada:2});
      const nova:any=await servico.criarNovaVersao(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional());
      expect(nova.documentoEdicao?.refeicoes[0].itens[0].substituicoes[0].equivalencia).toEqual({aplicacaoId});
      expect(nova.rascunhoRevisao).toBe(0);expect(nova.edicaoEstado).toBe('materializada');
      expect(nova.equivalenciasAplicadas.equivalente.estado).toBe('calculada_revisada');
      await expect(servico.atualizarRascunho(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),Object.assign(dadosRascunho(),{rascunhoIdEsperado:nova.id,rascunhoRevisaoEsperada:0}))).rejects.toBeInstanceOf(ConflictException);
      const alterado=nova.documentoEdicao;alterado.refeicoes[0].nome='Título novo';
      const salvo:any=await servico.salvarEdicaoRascunho(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),{rascunhoIdEsperado:nova.id,rascunhoRevisaoEsperada:0,documento:alterado});
      expect(salvo.equivalenciasAplicadas.equivalente).toMatchObject({aplicacaoId,estado:'calculada_revisada'});
    });
    it.each(['liberadaParaPaciente','preferida'])('FOOD05 não aceita nova alternativa já com %s no comando de aplicação',async campo=>{const {d}=await prepararEquivalencia();d.refeicoes[0].itens[0].substituicoes[0][campo]=true;await expect(salvarEdicao(d)).rejects.toBeInstanceOf(BadRequestException);});
    it('FOOD05 converter alternativa manual já existente preserva decisões legítimas anteriores',async()=>{
      const {d}=await prepararEquivalencia();const a=d.refeicoes[0].itens[0].substituicoes[0];delete a.equivalencia;a.liberadaParaPaciente=true;a.preferida=true;
      const manual:any=await salvarEdicao(d);const doc=manual.documentoEdicao,alternativa=doc.refeicoes[0].itens[0].substituicoes[0];
      const fontes=new FontesGruposSubstituicoes(criptografia);const s=new ServicoEquivalenciasPlano(executor as any,criptografia,fontes,new ServicoGruposSubstituicoes(executor as any,criptografia,fontes));
      const p=await s.prever(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),{versaoId:VERSAO_ID,rascunhoRevisaoEsperada:1,documentoEdicao:doc,itemChave:doc.refeicoes[0].itens[0].chaveCliente,nutriente:'energiaKcal',alternativas:[alternativa],politica:{passoPorcaoGramas:'1'}});
      alternativa.equivalencia={acao:'calcular',aplicacaoId:randomUUID(),nutriente:'energiaKcal',politica:{passoPorcaoGramas:'1'},porcaoEfetiva:'50',fingerprintEsperado:p.alternativas[0].fingerprint};
      const salvo:any=await salvarEdicao(doc,1);expect(salvo.refeicoes[0].itens[0].substituicoes[0]).toMatchObject({liberadaParaPaciente:true,preferida:true});
    });
    it('FOOD05 autosave marca revisão pendente sem mudar porção e bloqueia nova publicação',async()=>{
      const {d}=await prepararEquivalencia();const primeiro:any=await salvarEdicao(d);const proximo=primeiro.documentoEdicao;proximo.refeicoes[0].itens[0].porcaoGramas=160;
      const segundo:any=await salvarEdicao(proximo,1);expect(segundo.equivalenciasAplicadas.equivalente.estado).toBe('revisao_pendente');expect(segundo.documentoEdicao.refeicoes[0].itens[0].substituicoes[0].porcaoGramas).toBe('50');
      await expect(servico.revisar(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),{rascunhoIdEsperado:VERSAO_ID,rascunhoRevisaoEsperada:2})).rejects.toThrow(/equivalência.*pendente/i);
    });
    it('FOOD05 não aceita fingerprint manipulado ou PATCH legado que apague proveniência',async()=>{
      const {d}=await prepararEquivalencia();const errado=JSON.parse(JSON.stringify(d));errado.refeicoes[0].itens[0].substituicoes[0].equivalencia.fingerprintEsperado='b'.repeat(64);await expect(salvarEdicao(errado)).rejects.toBeInstanceOf(ConflictException);
      await salvarEdicao(d);await expect(servico.atualizarRascunho(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),Object.assign(dadosRascunho(),{rascunhoIdEsperado:VERSAO_ID,rascunhoRevisaoEsperada:1}))).rejects.toBeInstanceOf(ConflictException);
    });
    it.each(['alterada','inativa'])('FOOD05 preserva fonte de catálogo %s e micros nos autosaves seguintes',async(cenario)=>{
      const {d}=await prepararEquivalencia(true);const primeiro:any=await salvarEdicao(d);
      const a=repositorios.get(AlimentoComposicaoOrm)!.registros.find((r:any)=>r.id==='10000000-0000-4000-8000-000000000087')!;
      if(cenario==='alterada')a.energiaKcal='999';else repositorios.get(FonteComposicaoAlimentoOrm)!.registros.find((r:any)=>r.id===a.fonteId)!.situacao='inativa';
      const segundo:any=await salvarEdicao(primeiro.documentoEdicao,1);
      expect(segundo.equivalenciasAplicadas.equivalente.estado).toBe('calculada_revisada');
      const alt=segundo.refeicoes[0].itens[0].substituicoes[0];expect(alt.composicaoSnapshot.nutrientesPorcao.energiaKcal).toBe(80);expect(alt.composicaoSnapshot.micronutrientes.nutrientes.ferroMg.porcao).toBe(1);
    });
    it('FOOD05 reabre prévia de equivalência com fonte aplicada inativa sem buscar composição nova',async()=>{
      const {d}=await prepararEquivalencia(true);const primeiro:any=await salvarEdicao(d);
      repositorios.get(FonteComposicaoAlimentoOrm)!.registros.find((r:any)=>r.id==='10000000-0000-4000-8000-000000000086')!.situacao='inativa';
      const fontes=new FontesGruposSubstituicoes(criptografia);const s=new ServicoEquivalenciasPlano(executor as any,criptografia,fontes,new ServicoGruposSubstituicoes(executor as any,criptografia,fontes));
      const previa=await s.prever(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),{versaoId:VERSAO_ID,rascunhoRevisaoEsperada:1,documentoEdicao:primeiro.documentoEdicao,itemChave:d.refeicoes[0].itens[0].chaveCliente,nutriente:'energiaKcal',alternativas:primeiro.documentoEdicao.refeicoes[0].itens[0].substituicoes,politica:{passoPorcaoGramas:'1'}});
      expect(previa.alternativas[0].resultado).toMatchObject({estado:'calculavel',porcaoEfetivaGramas:'50'});
    });
    it('FOOD05 preserva também catálogo principal aplicado quando a fonte é desativada',async()=>{
      const {d}=await prepararEquivalencia(false,true);const primeiro:any=await salvarEdicao(d);
      repositorios.get(FonteComposicaoAlimentoOrm)!.registros.find((r:any)=>r.id==='10000000-0000-4000-8000-000000000086')!.situacao='inativa';
      const segundo:any=await salvarEdicao(primeiro.documentoEdicao,1);
      expect(segundo.equivalenciasAplicadas.equivalente.estado).toBe('calculada_revisada');
      expect(segundo.refeicoes[0].itens[0].composicaoSnapshot.nutrientesPorcao.energiaKcal).toBe(128);
    });
    it('FOOD05 troca explícita conserva fatos novos e cálculo original pendente após fonte inativa',async()=>{
      const {d}=await prepararEquivalencia(true);const primeiro:any=await salvarEdicao(d);
      const origem=repositorios.get(AlimentoComposicaoOrm)!.registros.find((r:any)=>r.id==='10000000-0000-4000-8000-000000000087')!;
      const novoId=randomUUID();repositorios.get(AlimentoComposicaoOrm)!.registros.push({...origem,id:novoId,nome:'Outra alternativa',energiaKcal:'200'});
      primeiro.documentoEdicao.refeicoes[0].itens[0].substituicoes[0].alimentoComposicaoId=novoId;
      const segundo:any=await salvarEdicao(primeiro.documentoEdicao,1);expect(segundo.equivalenciasAplicadas.equivalente.estado).toBe('revisao_pendente');
      expect(segundo.refeicoes[0].itens[0].substituicoes[0].composicaoSnapshot.nutrientesPorcao.energiaKcal).toBe(100);
      repositorios.get(FonteComposicaoAlimentoOrm)!.registros.find((r:any)=>r.id===origem.fonteId)!.situacao='inativa';
      const terceiro:any=await salvarEdicao(segundo.documentoEdicao,2);
      expect(terceiro.equivalenciasAplicadas.equivalente).toMatchObject({estado:'revisao_pendente',resultado:{obtido:'80'}});
      expect(terceiro.refeicoes[0].itens[0].substituicoes[0].composicaoSnapshot.nutrientesPorcao.energiaKcal).toBe(100);
    });
    it('FOOD05 preserva edição legada autorizada do SuperAdmin sem permitir comandos novos em nome alheio',async()=>{
      const {d}=await prepararEquivalencia();const primeiro:any=await salvarEdicao(d);const admin={...usuarioProfissional(),papel:'SuperAdmin' as const};
      primeiro.documentoEdicao.refeicoes[0].nome='Título administrativo';const salvo:any=await servico.salvarEdicaoRascunho(TENANT_ID,PACIENTE_ID,PLANO_ID,admin,{rascunhoIdEsperado:VERSAO_ID,rascunhoRevisaoEsperada:1,documento:primeiro.documentoEdicao});expect(salvo.equivalenciasAplicadas.equivalente.estado).toBe('calculada_revisada');
      const a=salvo.documentoEdicao.refeicoes[0].itens[0].substituicoes[0];a.equivalencia={...d.refeicoes[0].itens[0].substituicoes[0].equivalencia,aplicacaoId:randomUUID(),acao:'recalcular',anteriorAplicacaoId:a.equivalencia.aplicacaoId};await expect(servico.salvarEdicaoRascunho(TENANT_ID,PACIENTE_ID,PLANO_ID,admin,{rascunhoIdEsperado:VERSAO_ID,rascunhoRevisaoEsperada:2,documento:salvo.documentoEdicao})).rejects.toBeInstanceOf(ForbiddenException);
    });
    const customId = '10000000-0000-4000-8000-000000000098';
    const customComp = () => normalizarComposicaoPersonalizada({ nome: 'Arroz custom', base: { tipo: 'porcao', pesoGramas: 30 }, nutrientes: { energiaKcal: 90, proteinasG: 3, carboidratosG: 12, gordurasG: 3 }, micronutrientes: { ferroMg: 0.6 } });
    it.each(['alterada', 'inativa', 'rascunho-pendente'])('FOOD04 preserva catalogo aplicado com fonte %s', async (cenario) => {
      const alimentoId='10000000-0000-4000-8000-000000000081',fonteId='10000000-0000-4000-8000-000000000082';
      const fonte={id:fonteId,codigo:'usda_fdc_foundation',nome:'Fonte original',versao:'1',situacao:'ativa',esquemaVersao:'octaclin-composicao-v1',hashConteudo:'a'.repeat(64)};
      const alimento={id:alimentoId,fonteId,codigoOrigem:'SINT',nome:'Catalogo original',baseGramas:'100',energiaKcal:'100',proteinasG:'5',carboidratosG:'10',lipidiosG:'2',micronutrientes:{metadadosOrigem:{nutrientsOriginal:[{nutrient:{id:1089,unitName:'MG'},amount:2}]}}};
      repositorios.get(AlimentoComposicaoOrm)!.registros.push(alimento);repositorios.get(FonteComposicaoAlimentoOrm)!.registros.push(fonte);
      const ref={grupoId:customId,entradaId:fonteId,aplicacaoId:'10000000-0000-4000-8000-000000000083',revisao:1};
      const grupo=jest.spyOn(ServicoGruposSubstituicoes.prototype,'resolverAplicacao').mockResolvedValue({id:ref.entradaId,origem:'catalogo',alimentoId,quantidade:1,unidade:'porção',porcaoGramas:100,composicao:{descricao:'Catalogo original',nutrientesPor100g:{energiaKcal:100,proteinasG:5,carboidratosG:10,gordurasG:2}}});
      try {
        const d:any=documentoCompleto();d.refeicoes[0].itens[0].substituicoes=[{chaveCliente:'alternativa-catalogo',origemGrupo:ref,alimentoComposicaoId:alimentoId,quantidade:1,unidade:'porção',porcaoGramas:100}];
        if(cenario==='rascunho-pendente')d.avaliacaoAntropometricaId='';
        const primeira=await salvarEdicao(d);
        expect(primeira.edicaoEstado).toBe(cenario==='rascunho-pendente'?'pendente':'materializada');
        alimento.nome='Catalogo alterado';alimento.energiaKcal='999';fonte.versao='2';
        if(cenario!=='alterada')fonte.situacao='inativa';
        grupo.mockRejectedValue(new ConflictException('Biblioteca desativada'));
        const proximo:any={...primeira.documentoEdicao,avaliacaoAntropometricaId:AVALIACAO_ID,objetivos:'Alteracao nao relacionada'};
        proximo.refeicoes[0].itens[0].substituicoes[0].porcaoGramas=50;
        const segunda=await salvarEdicao(proximo,1);
        expect(segunda.edicaoEstado).toBe('materializada');
        const snapshot=segunda.refeicoes[0].itens[0].substituicoes[0].composicaoSnapshot;
        expect(snapshot).toMatchObject({descricao:'Catalogo original',fonte:{versao:'1'},nutrientesPor100g:{energiaKcal:100},nutrientesPorcao:{energiaKcal:50},micronutrientes:{nutrientes:{ferroMg:{por100g:2,porcao:1}}}});
        expect(grupo).toHaveBeenCalledTimes(1);
        expect(JSON.stringify(segunda.documentoEdicao)).not.toContain('catalogosGrupos');
        if (cenario === 'inativa') {
          const novaAplicacao:any=JSON.parse(JSON.stringify(segunda.documentoEdicao));
          novaAplicacao.refeicoes[0].itens[0].substituicoes[0].origemGrupo.aplicacaoId='10000000-0000-4000-8000-000000000084';
          await expect(salvarEdicao(novaAplicacao,2)).rejects.toBeInstanceOf(ConflictException);
          expect(grupo).toHaveBeenCalledTimes(2);
          await servico.revisar(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),{rascunhoIdEsperado:VERSAO_ID,rascunhoRevisaoEsperada:2});
          await servico.publicar(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),{rascunhoIdEsperado:VERSAO_ID,rascunhoRevisaoEsperada:3});
          const nova=await servico.criarNovaVersao(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional());
          const documento:any=JSON.parse(JSON.stringify(segunda.documentoEdicao));
          documento.refeicoes[0].chaveCliente=nova.refeicoes[0].id;
          documento.refeicoes[0].itens[0].chaveCliente=nova.refeicoes[0].itens[0].id;
          documento.refeicoes[0].itens[0].substituicoes[0].chaveCliente=nova.refeicoes[0].itens[0].substituicoes[0].id;
          delete documento.refeicoes[0].itens[0].substituicoes[0].origemGrupo;
          const reaberta=await servico.salvarEdicaoRascunho(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),{rascunhoIdEsperado:nova.id,rascunhoRevisaoEsperada:0,documento});
          expect(reaberta.edicaoEstado).toBe('materializada');
          expect(reaberta.refeicoes[0].itens[0].substituicoes[0].composicaoSnapshot).toMatchObject({descricao:'Catalogo original',fonte:{versao:'1'},nutrientesPorcao:{energiaKcal:50}});
          expect(grupo).toHaveBeenCalledTimes(2);
        }
        if (cenario === 'alterada') {
          const versao=repositorios.get(PlanoAlimentarVersaoOrm)!.registros[0] as PlanoAlimentarVersaoOrm;
          const envelope=JSON.parse(criptografia.descriptografar(versao.edicaoSnapshotCriptografado!));
          envelope.catalogosGrupos['alternativa-catalogo'].snapshot.alimentoComposicaoId=customId;
          versao.edicaoSnapshotCriptografado=criptografia.criptografar(JSON.stringify(envelope));
          await expect(salvarEdicao(segunda.documentoEdicao,2)).rejects.toBeInstanceOf(ConflictException);
        }
      } finally {grupo.mockRestore();}
    });
    it('FOOD04 aplica no mesmo save, preserva snapshot e não reconsulta biblioteca depois', async () => {
      const ref={grupoId:'10000000-0000-4000-8000-000000000051',entradaId:'10000000-0000-4000-8000-000000000052',aplicacaoId:'10000000-0000-4000-8000-000000000053',revisao:1};
      const d=documentoCompleto();
      (d.refeicoes[0].itens[0] as any).substituicoes=[{chaveCliente:'alt-grupo',origemGrupo:ref,descricao:'Adulterada',quantidade:1,unidade:'porção',porcaoGramas:45,preferida:true,liberadaParaPaciente:true,nutrientesPor100g:{energiaKcal:999,proteinasG:1,carboidratosG:1,gordurasG:1}}];
      const grupo=jest.spyOn(ServicoGruposSubstituicoes.prototype,'resolverAplicacao').mockResolvedValue({id:ref.entradaId,origem:'custom',alimentoId:customId,revisao:1,quantidade:1,unidade:'porção',porcaoGramas:30,composicao:{descricao:customComp().nome,nutrientesPor100g:customComp().nutrientesPor100g,micronutrientesPor100g:customComp().micronutrientesPor100g,composicaoCustom:customComp()}});
      const custom=jest.spyOn(ServicoAlimentosPersonalizados.prototype,'resolverAplicacao').mockResolvedValue({id:customId,revisao:1,composicao:customComp()});
      try {
        const r=await salvarEdicao(d),alt=r.refeicoes[0].itens[0].substituicoes[0];
        expect(r.edicaoEstado).toBe('materializada');
        expect(alt).toMatchObject({descricao:'Arroz custom',preferida:false,liberadaParaPaciente:false});
        expect(alt.composicaoSnapshot.nutrientesPorcao.energiaKcal).toBe(135);
        expect(alt.composicaoSnapshot).not.toHaveProperty('origemGrupo');
        const row=repositorios.get(PlanoAlimentarSubstituicaoOrm)!.registros[0] as any;
        expect(JSON.parse(criptografia.descriptografar(row.composicaoSnapshotCriptografada)).origemGrupo).toMatchObject({...ref,porcaoAplicadaGramas:45});
        expect(grupo.mock.calls[0][0]).toBe(gerenciador);
        grupo.mockRejectedValue(new ConflictException('Grupo arquivado'));custom.mockRejectedValue(new ConflictException('Fonte desativada'));
        const depois=await salvarEdicao(r.documentoEdicao,1);
        expect(depois.edicaoEstado).toBe('materializada');expect(grupo).toHaveBeenCalledTimes(1);expect(custom).toHaveBeenCalledTimes(1);
        await servico.revisar(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),{rascunhoIdEsperado:VERSAO_ID,rascunhoRevisaoEsperada:2});
        await servico.publicar(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),{rascunhoIdEsperado:VERSAO_ID,rascunhoRevisaoEsperada:3});
        const nova=await servico.criarNovaVersao(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional());
        const documento:any=JSON.parse(JSON.stringify(depois.documentoEdicao));
        documento.refeicoes[0].chaveCliente=nova.refeicoes[0].id;
        documento.refeicoes[0].itens[0].chaveCliente=nova.refeicoes[0].itens[0].id;
        const aNova=documento.refeicoes[0].itens[0].substituicoes[0];
        aNova.chaveCliente=nova.refeicoes[0].itens[0].substituicoes[0].id;
        delete aNova.origemGrupo;delete aNova.alimentoPersonalizado;
        const reaberta=await servico.salvarEdicaoRascunho(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),{rascunhoIdEsperado:nova.id,rascunhoRevisaoEsperada:0,documento});
        expect(reaberta.edicaoEstado).toBe('materializada');
        expect(reaberta.refeicoes[0].itens[0].substituicoes[0].composicaoSnapshot.origem).toBe('custom');
        const novaRefeicao=(repositorios.get(PlanoAlimentarRefeicaoOrm)!.registros as any[]).find(v=>v.versaoId===nova.id);
        const novoItem=(repositorios.get(PlanoAlimentarItemOrm)!.registros as any[]).find(v=>v.refeicaoId===novaRefeicao.id);
        const novaAlt=(repositorios.get(PlanoAlimentarSubstituicaoOrm)!.registros as any[]).find(v=>v.itemId===novoItem.id);
        expect(JSON.parse(criptografia.descriptografar(novaAlt.composicaoSnapshotCriptografada)).origemGrupo).toMatchObject({grupoId:ref.grupoId,revisao:1});
        expect(grupo).toHaveBeenCalledTimes(1);

      } finally {grupo.mockRestore();custom.mockRestore();}
    });
    it('FOOD04 impede PATCH legado de apagar proveniência já salva', async () => {
      const documento = documentoParcial();
      (documento.refeicoes[0].itens[0] as any).substituicoes = [{
        chaveCliente: 'alternativa-salva', quantidade: 1, unidade: 'g', porcaoGramas: 30,
        origemGrupo: { grupoId: customId, entradaId: customId, aplicacaoId: customId, revisao: 1 }
      }];
      const versao = repositorios.get(PlanoAlimentarVersaoOrm)!.registros[0] as PlanoAlimentarVersaoOrm;
      versao.edicaoSnapshotCriptografado = criptografia.criptografar(JSON.stringify(documento));
      const anterior = Buffer.from(versao.edicaoSnapshotCriptografado);
      await expect(servico.atualizarRascunho(TENANT_ID, PACIENTE_ID, PLANO_ID,
        usuarioProfissional(), dadosRascunho())).rejects.toBeInstanceOf(ConflictException);
      expect(versao.edicaoSnapshotCriptografado).toEqual(anterior);
    });
    it('FOOD04 impede PATCH legado também sem documento editorial, após materialização', async () => {
      await servico.atualizarRascunho(TENANT_ID, PACIENTE_ID, PLANO_ID, usuarioProfissional(), dadosRascunho());
      const item = repositorios.get(PlanoAlimentarItemOrm)!.registros[0] as PlanoAlimentarItemOrm;
      repositorios.get(PlanoAlimentarSubstituicaoOrm)!.registros.push({
        id: customId, tenantId: TENANT_ID, itemId: item.id,
        composicaoSnapshotCriptografada: criptografia.criptografar(JSON.stringify({
          origem: 'catalogo', origemGrupo: { schemaVersao: 1, grupoId: customId, revisao: 1 }
        }))
      } as PlanoAlimentarSubstituicaoOrm);
      await expect(servico.atualizarRascunho(TENANT_ID, PACIENTE_ID, PLANO_ID,
        usuarioProfissional(), dadosRascunho())).rejects.toBeInstanceOf(ConflictException);
      expect(repositorios.get(PlanoAlimentarSubstituicaoOrm)!.registros).toHaveLength(1);
    });
    it('FOOD04 recusa nova aplicação inválida antes de avançar revisão ou persistir filhos',async()=>{
      const d=documentoCompleto();
      (d.refeicoes[0].itens[0] as any).substituicoes=[{chaveCliente:'alt-grupo',origemGrupo:{grupoId:'10000000-0000-4000-8000-000000000051',entradaId:'10000000-0000-4000-8000-000000000052',aplicacaoId:'10000000-0000-4000-8000-000000000053',revisao:1},quantidade:1,unidade:'g',porcaoGramas:30}];
      const grupo=jest.spyOn(ServicoGruposSubstituicoes.prototype,'resolverAplicacao').mockRejectedValue(new ConflictException('Grupo arquivado'));
      try {await expect(salvarEdicao(d)).rejects.toBeInstanceOf(ConflictException);expect((repositorios.get(PlanoAlimentarVersaoOrm)!.registros[0] as any).rascunhoRevisao??0).toBe(0);}
      finally{grupo.mockRestore();}
    });
    it('FOOD02 preserva aplicação cifrada depois de editar/desativar a biblioteca', async () => {
      const d = documentoParcial();
      Object.assign(d.refeicoes[0].itens[0], { alimentoPersonalizado: { id: customId, revisao: 1, aplicacaoId: customId } });
      const spy = jest.spyOn(ServicoAlimentosPersonalizados.prototype, 'resolverAplicacao').mockResolvedValue({ id: customId, revisao: 1, composicao: customComp() });
      try {
        const r = await salvarEdicao(d);
        expect(r.documentoEdicao?.refeicoes[0].itens[0].nutrientesPor100g?.energiaKcal).toBe(300);
        expect(r).toHaveProperty('alimentosPersonalizadosAplicados.item-sintetico.nome', 'Arroz custom');
        spy.mockRejectedValue(new ForbiddenException('Sem acesso atual à biblioteca'));
        const outro = await salvarEdicao(r.documentoEdicao, 1);
        expect(outro.documentoEdicao?.refeicoes[0].itens[0].descricao).toBe('Arroz custom');
        expect(spy).toHaveBeenCalledTimes(1);
        expect(Buffer.isBuffer((repositorios.get(PlanoAlimentarVersaoOrm)!.registros[0] as any).alimentosPersonalizadosSnapshotCriptografado)).toBe(true);
      } finally { spy.mockRestore(); }
    });
    it('FOOD02 materializa origem custom e nutrientes pela base correta, sem IDs privados no snapshot factual', async () => {
      const d = documentoCompleto();
      Object.assign(d.refeicoes[0].itens[0], { alimentoPersonalizado: { id: customId, revisao: 1, aplicacaoId: customId } });
      const spy = jest.spyOn(ServicoAlimentosPersonalizados.prototype, 'resolverAplicacao').mockResolvedValue({ id: customId, revisao: 1, composicao: customComp() });
      try {
        const r = await salvarEdicao(d);
        expect(r.edicaoEstado).toBe('materializada');
        const item = r.refeicoes[0].itens[0];
        expect(item.composicaoSnapshot.origem).toBe('custom');
        expect(item.composicaoSnapshot.nutrientesPorcao.energiaKcal).toBe(240);
        expect(item.composicaoSnapshot.micronutrientes?.nutrientes.ferroMg.porcao).toBe(1.6);
        expect(JSON.stringify(item.composicaoSnapshot)).not.toContain(customId);
        expect(item.alimentoComposicaoId).toBeUndefined();
      } finally { spy.mockRestore(); }
    });
    it('FOOD02 aplica composição autoritativa também nas substituições', async () => {
      const d = documentoCompleto();
      (d.refeicoes[0].itens[0] as any).substituicoes = [{ chaveCliente: 'alt-custom', quantidade: 1, unidade: 'porção', porcaoGramas: 45, liberadaParaPaciente: true, preferida: false, alimentoPersonalizado: { id: customId, revisao: 1, aplicacaoId: customId } }];
      const spy = jest.spyOn(ServicoAlimentosPersonalizados.prototype, 'resolverAplicacao').mockResolvedValue({ id: customId, revisao: 1, composicao: customComp() });
      try {
        const r = await salvarEdicao(d), a = r.refeicoes[0].itens[0].substituicoes[0];
        expect(r.edicaoEstado).toBe('materializada');
        expect(a.composicaoSnapshot.origem).toBe('custom');
        expect(a.composicaoSnapshot.nutrientesPorcao.energiaKcal).toBe(135);
        expect(a.composicaoSnapshot.micronutrientes?.nutrientes.ferroMg.porcao).toBe(0.9);
        expect(r).toHaveProperty('alimentosPersonalizadosAplicados.alt-custom.nome', 'Arroz custom');
      } finally { spy.mockRestore(); }
    });
    it('FOOD02 composição parcial fica pendente sem completar macros com zero', async () => {
      const d = documentoCompleto();
      Object.assign(d.refeicoes[0].itens[0], { alimentoPersonalizado: { id: customId, revisao: 1, aplicacaoId: customId } });
      const parcial = normalizarComposicaoPersonalizada({ nome: 'Parcial', base: { tipo: 'por100g' }, nutrientes: { energiaKcal: 100 } });
      const spy = jest.spyOn(ServicoAlimentosPersonalizados.prototype, 'resolverAplicacao').mockResolvedValue({ id: customId, revisao: 1, composicao: parcial });
      try {
        const r = await salvarEdicao(d);
        expect(r.edicaoEstado).toBe('pendente');
        expect(r.documentoEdicao?.refeicoes[0].itens[0].nutrientesPor100g).toEqual({ energiaKcal: 100 });
        expect(r.refeicoes).toEqual([]);
        await expect(servico.revisar(TENANT_ID, PACIENTE_ID, PLANO_ID, usuarioProfissional(), { rascunhoIdEsperado: VERSAO_ID, rascunhoRevisaoEsperada: 1 })).rejects.toBeInstanceOf(ConflictException);
      } finally { spy.mockRestore(); }
    });
    it('FOOD02 rejeita mapa corrupto em vez de perder proveniência', async () => {
      (repositorios.get(PlanoAlimentarVersaoOrm)!.registros[0] as any).alimentosPersonalizadosSnapshotCriptografado = Buffer.from('corrompido');
      await expect(servico.obterRascunho(TENANT_ID, PACIENTE_ID, PLANO_ID, usuarioProfissional())).rejects.toBeInstanceOf(ServiceUnavailableException);
      await expect(salvarEdicao(documentoParcial())).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
    it('FOOD02 escritor clínico antigo não descarta contexto custom', async () => {
      (repositorios.get(PlanoAlimentarVersaoOrm)!.registros[0] as any).alimentosPersonalizadosSnapshotCriptografado = Buffer.from('contexto-existente');
      await expect(servico.atualizarRascunho(TENANT_ID, PACIENTE_ID, PLANO_ID, usuarioProfissional(), dadosRascunho())).rejects.toBeInstanceOf(ConflictException);
      expect(repositorios.get(PlanoAlimentarVersaoOrm)!.save).not.toHaveBeenCalled();
    });
    it('FOOD01 resolve no servidor, cifra contexto e preserva após perda de acesso à biblioteca', async () => {
      const alimentoId='10000000-0000-4000-8000-000000000020';
      const fonteId='10000000-0000-4000-8000-000000000021';
      repositorios.get(AlimentoComposicaoOrm)!.registros.push({id:alimentoId,fonteId});
      repositorios.get(FonteComposicaoAlimentoOrm)!.registros.push({id:fonteId,situacao:'ativa'});
      const documento=documentoParcial();
      Object.assign(documento.refeicoes[0].itens[0],{alimentoComposicaoId:alimentoId,quantidade:2.5,porcaoGramas:999,medidaCaseira:{id:alimentoId,revisao:1,aplicacaoId:fonteId}});
      const resolver=jest.spyOn(ServicoMedidasCaseiras.prototype,'resolverAplicacao').mockResolvedValue({quantidade:2.5,unidade:'colher',porcaoGramas:62.5,referencia:{id:alimentoId,revisao:1,nome:'colher',quantidadeReferencia:1,pesoReferenciaGramas:25}});
      try {
        const salvo=await salvarEdicao(documento);
        expect(salvo.documentoEdicao?.refeicoes[0].itens[0]).toMatchObject({unidade:'colher',porcaoGramas:62.5});
        expect(salvo).toHaveProperty('medidasCaseirasAplicadas',{'item-sintetico':{nome:'colher',quantidadeReferencia:1,pesoReferenciaGramas:25}});
        expect(Buffer.isBuffer((repositorios.get(PlanoAlimentarVersaoOrm)!.registros[0] as any).medidasCaseirasSnapshotCriptografado)).toBe(true);
        expect(JSON.parse(criptografia.descriptografar((repositorios.get(PlanoAlimentarVersaoOrm)!.registros[0] as any).medidasCaseirasSnapshotCriptografado))).toMatchObject({schemaVersao:1,contextos:{'item-sintetico':expect.any(Object)}});
        resolver.mockRejectedValue(new ForbiddenException('Revogado'));
        const novo=salvo.documentoEdicao!;
        novo.observacoes='Outro campo';
        expect((await salvarEdicao(novo,1)).documentoEdicao?.refeicoes[0].itens[0].porcaoGramas).toBe(62.5);
        expect(resolver).toHaveBeenCalledTimes(1);
      } finally {resolver.mockRestore();}
    });
    it('FOOD01 falha fechada com snapshot corrompido ou schema desconhecido', async () => {
      const rascunho=repositorios.get(PlanoAlimentarVersaoOrm)!.registros[0] as any;
      for (const valor of [Buffer.from('cipher-invalido'),criptografia.criptografar(JSON.stringify({schemaVersao:2,contextos:{}}))]) {
        rascunho.medidasCaseirasSnapshotCriptografado=valor;
        await expect(salvarEdicao(documentoParcial())).rejects.toThrow('Referência de medida indisponível.');
        expect(repositorios.get(PlanoAlimentarVersaoOrm)!.save).not.toHaveBeenCalled();
      }
    });
    it('FOOD01 não transforma falha de autorização de medida em sucesso editorial', async () => {
      const documento=documentoParcial();
      Object.assign(documento.refeicoes[0].itens[0],{alimentoComposicaoId:AVALIACAO_ID,medidaCaseira:{id:AVALIACAO_ID,revisao:1,aplicacaoId:PLANO_ID}});
      const resolver=jest.spyOn(ServicoMedidasCaseiras.prototype,'resolverAplicacao').mockRejectedValue(new ForbiddenException('Revogado'));
      try {
        await expect(salvarEdicao(documento)).rejects.toBeInstanceOf(ForbiddenException);
        expect(repositorios.get(PlanoAlimentarVersaoOrm)!.save).not.toHaveBeenCalled();
      } finally {resolver.mockRestore();}
    });
    it.each(['-', '-1'])('preserva micros manuais pendentes %s sem materializar nem publicar', async valor => {
      const documento = documentoCompleto();
      Object.assign(documento.refeicoes[0].itens[0],{micronutrientesPor100g:{ferroMg:valor}});
      const salvo = await salvarEdicao(documento);
      expect(salvo).toMatchObject({edicaoEstado:'pendente',documentoEdicao:documento,totais:undefined});
      await expect(servico.revisar(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),{rascunhoIdEsperado:VERSAO_ID,rascunhoRevisaoEsperada:1})).rejects.toThrow();
    });
    it('recusa overflow sem alterar snapshot nem contador', async () => {
      repositorios.get(PlanoAlimentarVersaoOrm)!.registros[0].rascunhoRevisao = 2147483647;
      await expect(salvarEdicao(documentoParcial(), 2147483647)).rejects.toBeInstanceOf(BadRequestException);
      await expect(servico.revisar(TENANT_ID, PACIENTE_ID, PLANO_ID, usuarioProfissional())).rejects.toThrow('limite de revisões');
      expect(repositorios.get(PlanoAlimentarVersaoOrm)!.save).not.toHaveBeenCalled();
    });
    it('ACK editorial identifica revisão operacional para rejeitar flags de retorno obsoleto', async () => {
      Object.assign(repositorios.get(PlanoAlimentarOrm)!.registros[0],{ativacaoRevisao:4,ativoParaPaciente:true});
      expect(await salvarEdicao(documentoParcial())).toMatchObject({ativacaoRevisao:4,ativoParaPaciente:true});
    });
    it('não transforma falha de banco ao ler identidades em conflito editorial', async () => {
      const erro=new Error('Falha sintética de banco');
      jest.mocked(gerenciador.query).mockRejectedValueOnce(erro);
      await expect(salvarEdicao(documentoCompleto())).rejects.toBe(erro);
    });
    it('não transforma falha de persistência em sucesso editorial pendente', async () => {
      repositorios.get(PlanoAlimentarVersaoOrm)!.save.mockRejectedValueOnce(new Error('Falha sintética de persistência'));
      await expect(salvarEdicao(documentoParcial())).rejects.toThrow('Falha sintética de persistência');
    });
    it('guarda e reabre alimentos válidos sem avaliação ou meta, cifrando a edição', async () => {
      expect(await salvarEdicao(documentoParcial())).toEqual(expect.objectContaining({ rascunhoRevisao: 1, edicaoEstado: 'pendente', documentoEdicao: documentoParcial() }));
      const salvo = repositorios.get(PlanoAlimentarVersaoOrm)!.registros[0];
      expect(Buffer.isBuffer(salvo.edicaoSnapshotCriptografado)).toBe(true);
      expect(await servico.obterRascunho(TENANT_ID, PACIENTE_ID, PLANO_ID, usuarioProfissional())).toMatchObject({ documentoEdicao: documentoParcial(), edicaoEstado: 'pendente' });
      expect(repositorios.get(PlanoAlimentarItemOrm)!.delete).not.toHaveBeenCalled();
    });

    it('materializa documento completo e mantém cópia editorial sem incluí-la na projeção paciente', async () => {
      const salvo = await salvarEdicao(documentoCompleto());
      expect(salvo).toMatchObject({ edicaoEstado: 'materializada', rascunhoRevisao: 1, totais: { energiaKcal: 80 } });
      const antes = await servico.obterRascunho(TENANT_ID, PACIENTE_ID, PLANO_ID, usuarioProfissional());
      const precondicao = { rascunhoIdEsperado: VERSAO_ID, rascunhoRevisaoEsperada: 1 };
      const revisado = await servico.revisar(TENANT_ID, PACIENTE_ID, PLANO_ID, usuarioProfissional(), precondicao);
      expect(revisado).toMatchObject({ edicaoEstado: 'materializada', rascunhoRevisao: 2 });
      await expect(servico.publicar(TENANT_ID, PACIENTE_ID, PLANO_ID, usuarioProfissional(), precondicao)).rejects.toBeInstanceOf(ConflictException);
      const publicado = await servico.publicar(TENANT_ID, PACIENTE_ID, PLANO_ID, usuarioProfissional(), { ...precondicao, rascunhoRevisaoEsperada: 2 });
      expect(publicado.current).not.toHaveProperty('documentoEdicao');
      expect(publicado.current?.totais).toEqual(antes.totais);
      const preview = await servico.obterApresentacaoPaciente(TENANT_ID, PACIENTE_ID, PLANO_ID, 1, usuarioProfissional());
      expect(JSON.stringify(preview)).not.toMatch(/documentoEdicao|edicaoSnapshot|rascunhoRevisao|edicaoProtegida/);
    });

    it('conteúdo publicado independe de corrupção posterior do documento editorial', async () => {
      await salvarEdicao(documentoCompleto());
      await servico.revisar(TENANT_ID, PACIENTE_ID, PLANO_ID, usuarioProfissional(), { rascunhoIdEsperado: VERSAO_ID, rascunhoRevisaoEsperada: 1 });
      await servico.publicar(TENANT_ID, PACIENTE_ID, PLANO_ID, usuarioProfissional(), { rascunhoIdEsperado: VERSAO_ID, rascunhoRevisaoEsperada: 2 });
      repositorios.get(PlanoAlimentarVersaoOrm)!.registros[0].edicaoSnapshotCriptografado = Buffer.from('inválido');
      const versao = await servico.obterVersao(TENANT_ID, PACIENTE_ID, PLANO_ID, 1, usuarioProfissional());
      expect(versao.totais).toMatchObject({ energiaKcal: 80 });
      expect(versao.refeicoes).toHaveLength(1);
      expect(versao).not.toHaveProperty('documentoEdicao');
      const preview = await servico.obterApresentacaoPaciente(TENANT_ID, PACIENTE_ID, PLANO_ID, 1, usuarioProfissional());
      expect(preview.refeicoes).toHaveLength(1);
    });

    it.each(['pendente', 'indisponivel'])('não apresenta nem copia materialização antiga quando edição está %s', async estado => {
      await salvarEdicao(documentoCompleto());
      await salvarEdicao(documentoParcial(), 1);
      if (estado === 'indisponivel') repositorios.get(PlanoAlimentarVersaoOrm)!.registros[0].edicaoSnapshotCriptografado = Buffer.from('inválido');
      const atual = await servico.obterRascunho(TENANT_ID, PACIENTE_ID, PLANO_ID, usuarioProfissional());
      expect(atual).toMatchObject({ edicaoEstado: estado, refeicoes: [], objetivos: undefined, observacoes: undefined, avaliacaoAntropometricaId: undefined, formulaCodigo: undefined });
      await expect(servico.obterApresentacaoPaciente(TENANT_ID, PACIENTE_ID, PLANO_ID, 1, usuarioProfissional())).rejects.toBeInstanceOf(ConflictException);
    });

    it('guarda linha incompleta e entrada numérica em edição sem convertê-la em zero', async () => {
      const documento = documentoParcial();
      const valor = { ...documento, refeicoes: [{ ...documento.refeicoes[0], itens: [{ ...documento.refeicoes[0].itens[0], quantidade: '', porcaoGramas: '-' }] }] };
      expect(await salvarEdicao(valor)).toMatchObject({ edicaoEstado: 'pendente', documentoEdicao: valor, totais: undefined });
    });

    it.each([
      { segredo: 'não permitido' },
      { pacienteId: PACIENTE_ID },
      { possuiCondicaoEspecial: 'false' },
      { avaliacaoAntropometricaId: 'outro' },
      { refeicoes: [{ chaveCliente: 'duplicada', itens: [{ chaveCliente: 'duplicada' }] }] },
      { refeicoes: Array.from({ length: 51 }, (_, i) => ({ chaveCliente: `r-${i}`, itens: [] })) }
    ])('rejeita estrutura editorial inválida sem escrita (%#)', async alteracao => {
      await expect(salvarEdicao({ ...documentoParcial(), ...alteracao })).rejects.toBeInstanceOf(BadRequestException);
      expect(repositorios.get(PlanoAlimentarVersaoOrm)!.save).not.toHaveBeenCalled();
      expect(repositorios.get(PlanoAlimentarItemOrm)!.delete).not.toHaveBeenCalled();
    });

    it('nega avaliação de outro paciente mesmo em documento parcial', async () => {
      repositorios.get(AvaliacaoAntropometricaOrm)!.registros[0].pacienteId = 'outro-paciente';
      await expect(salvarEdicao({ ...documentoParcial(), avaliacaoAntropometricaId: AVALIACAO_ID })).rejects.toBeInstanceOf(BadRequestException);
      expect(repositorios.get(PlanoAlimentarVersaoOrm)!.save).not.toHaveBeenCalled();
    });

    it('não reutiliza o cálculo anterior no resumo PA04 quando há edição pendente', async () => {
      await servico.atualizarRascunho(TENANT_ID, PACIENTE_ID, PLANO_ID, usuarioProfissional(), dadosRascunho());
      await salvarEdicao(documentoParcial(), 1);
      const lista = await servico.listar(TENANT_ID, PACIENTE_ID, usuarioProfissional());
      expect(lista.itens[0].draft?.resumoNutricional).toEqual({ estado: 'indisponivel' });
    });

    it('cipher editorial corrompido falha fechado na leitura e revisão', async () => {
      await salvarEdicao(documentoCompleto());
      repositorios.get(PlanoAlimentarVersaoOrm)!.registros[0].edicaoSnapshotCriptografado = Buffer.from('cipher-inválido');
      expect(await servico.obterRascunho(TENANT_ID, PACIENTE_ID, PLANO_ID, usuarioProfissional())).toMatchObject({ edicaoEstado: 'indisponivel', calculo: undefined });
      await expect(servico.revisar(TENANT_ID, PACIENTE_ID, PLANO_ID, usuarioProfissional(), { rascunhoIdEsperado: VERSAO_ID, rascunhoRevisaoEsperada: 1 })).rejects.toBeInstanceOf(ConflictException);
    });

    it('não revisa cálculos antigos depois de guardar uma edição parcial', async () => {
      await servico.atualizarRascunho(TENANT_ID, PACIENTE_ID, PLANO_ID, usuarioProfissional(), dadosRascunho());
      await salvarEdicao(documentoParcial(), 1);
      await expect(servico.revisar(TENANT_ID, PACIENTE_ID, PLANO_ID, usuarioProfissional())).rejects.toBeInstanceOf(ConflictException);
      expect(await servico.obterRascunho(TENANT_ID, PACIENTE_ID, PLANO_ID, usuarioProfissional())).toMatchObject({ edicaoEstado: 'pendente', calculo: undefined, totais: undefined });
    });

    it('não permite revisar um rascunho protegido sem precondição de edição', async () => {
      await servico.atualizarRascunho(TENANT_ID, PACIENTE_ID, PLANO_ID, usuarioProfissional(), Object.assign(dadosRascunho(), { rascunhoIdEsperado: VERSAO_ID, rascunhoRevisaoEsperada: 0 }));
      await expect(servico.revisar(TENANT_ID, PACIENTE_ID, PLANO_ID, usuarioProfissional())).rejects.toBeInstanceOf(ConflictException);
    });

    it('revisar e publicar avançam a revisão geral de modo monotônico', async () => {
      await servico.atualizarRascunho(TENANT_ID, PACIENTE_ID, PLANO_ID, usuarioProfissional(), dadosRascunho());
      expect(await servico.revisar(TENANT_ID, PACIENTE_ID, PLANO_ID, usuarioProfissional())).toMatchObject({ rascunhoRevisao: 2 });
      const publicado = await servico.publicar(TENANT_ID, PACIENTE_ID, PLANO_ID, usuarioProfissional());
      expect(publicado.current).toMatchObject({ rascunhoRevisao: 3 });
    });

    it('incrementa a revisão geral também nas escritas legadas sem preferências', async () => {
      const primeiro = await servico.atualizarRascunho(TENANT_ID, PACIENTE_ID, PLANO_ID, usuarioProfissional(), dadosRascunho());
      expect(primeiro).toMatchObject({ rascunhoRevisao: 1 });
      const segundo = await servico.atualizarRascunho(TENANT_ID, PACIENTE_ID, PLANO_ID, usuarioProfissional(), dadosRascunho());
      expect(segundo).toMatchObject({ rascunhoRevisao: 2 });
    });

    it('recusa replay do contrato novo antes de excluir alimentos', async () => {
      const entrada = Object.assign(dadosRascunho(), { rascunhoIdEsperado: VERSAO_ID, rascunhoRevisaoEsperada: 0 });
      await servico.atualizarRascunho(TENANT_ID, PACIENTE_ID, PLANO_ID, usuarioProfissional(), entrada);
      const deletes = repositorios.get(PlanoAlimentarItemOrm)!.delete.mock.calls.length;
      await expect(servico.atualizarRascunho(TENANT_ID, PACIENTE_ID, PLANO_ID, usuarioProfissional(), entrada)).rejects.toBeInstanceOf(ConflictException);
      expect(repositorios.get(PlanoAlimentarItemOrm)!.delete).toHaveBeenCalledTimes(deletes);
    });

    it('não permite writer antigo depois da adesão ao contrato protegido', async () => {
      await servico.atualizarRascunho(TENANT_ID, PACIENTE_ID, PLANO_ID, usuarioProfissional(), Object.assign(dadosRascunho(), { rascunhoIdEsperado: VERSAO_ID, rascunhoRevisaoEsperada: 0 }));
      await expect(servico.atualizarRascunho(TENANT_ID, PACIENTE_ID, PLANO_ID, usuarioProfissional(), dadosRascunho())).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('PA05 — apresentação cifrada, CAS e versões', () => {
    const preferencias = () => ({ schemaVersao: 1, profissional: { horario: true, macros: true, medidasCaseiras: true, orientacoes: true, substituicoesExpandidas: true, modoCompacto: false }, paciente: { horario: false, macros: false, medidasCaseiras: false, orientacoes: true, substituicoesExpandidas: false, modoCompacto: true } });
    const entrada = (revisao = 0, id = VERSAO_ID) => Object.assign(dadosRascunho(), { preferenciasApresentacao: preferencias(), apresentacaoRevisaoEsperada: revisao, rascunhoIdEsperado: id });
    it('salva prefs cifradas, retorna DTO e rejeita replay antes de alterar filhos', async () => {
      const resultado = await servico.atualizarRascunho(TENANT_ID, PACIENTE_ID, PLANO_ID, usuarioProfissional(), entrada());
      expect(resultado).toMatchObject({ preferenciasApresentacao: preferencias(), apresentacaoRevisao: 1, apresentacaoEstado: 'configurada' });
      const salvo = repositorios.get(PlanoAlimentarVersaoOrm)!.registros[0];
      expect(Buffer.isBuffer(salvo.apresentacaoSnapshotCriptografado)).toBe(true);
      expect(JSON.parse(criptografia.descriptografar(salvo.apresentacaoSnapshotCriptografado))).toEqual(preferencias());
      const deletes = repositorios.get(PlanoAlimentarItemOrm)!.delete.mock.calls.length;
      await expect(servico.atualizarRascunho(TENANT_ID, PACIENTE_ID, PLANO_ID, usuarioProfissional(), entrada())).rejects.toBeInstanceOf(ConflictException);
      expect(repositorios.get(PlanoAlimentarItemOrm)!.delete).toHaveBeenCalledTimes(deletes);
    });
    it.each([undefined, -1, 0.5])('recusa revisão ausente ou inválida (%s)', async revisao => {
      await expect(servico.atualizarRascunho(TENANT_ID, PACIENTE_ID, PLANO_ID, usuarioProfissional(), Object.assign(entrada(), { apresentacaoRevisaoEsperada: revisao }))).rejects.toBeInstanceOf(BadRequestException);
      expect(repositorios.get(PlanoAlimentarItemOrm)!.delete).not.toHaveBeenCalled();
    });
    it('recusa geração antiga mesmo com revisão coincidente', async () => {
      await expect(servico.atualizarRascunho(TENANT_ID, PACIENTE_ID, PLANO_ID, usuarioProfissional(), entrada(0, '10000000-0000-4000-8000-000000000099'))).rejects.toBeInstanceOf(ConflictException);
    });
    it('PUT legado conserva preferências e revisão já salvas', async () => {
      await servico.atualizarRascunho(TENANT_ID, PACIENTE_ID, PLANO_ID, usuarioProfissional(), entrada());
      await expect(servico.atualizarRascunho(TENANT_ID, PACIENTE_ID, PLANO_ID, usuarioProfissional(), dadosRascunho())).resolves.toMatchObject({ preferenciasApresentacao: preferencias(), apresentacaoRevisao: 1 });
    });
    it('publicação preserva preferências e nova versão herda cipher com revisão inicial explícita', async () => {
      await servico.atualizarRascunho(TENANT_ID, PACIENTE_ID, PLANO_ID, usuarioProfissional(), entrada());
      await servico.revisar(TENANT_ID, PACIENTE_ID, PLANO_ID, usuarioProfissional());
      await servico.publicar(TENANT_ID, PACIENTE_ID, PLANO_ID, usuarioProfissional());
      const publicado = structuredClone(repositorios.get(PlanoAlimentarVersaoOrm)!.registros[0]);
      const novo = await servico.criarNovaVersao(TENANT_ID, PACIENTE_ID, PLANO_ID, usuarioProfissional());
      expect(novo).toMatchObject({ preferenciasApresentacao: preferencias(), apresentacaoRevisao: 1 });
      expect(repositorios.get(PlanoAlimentarVersaoOrm)!.registros[0].hashConteudo).toBe(publicado.hashConteudo);
      expect(repositorios.get(PlanoAlimentarVersaoOrm)!.registros[0].apresentacaoRevisao).toBe(1);
    });
    it('snapshot perdido no novo rascunho herdado continua indisponível', async () => {
      await servico.atualizarRascunho(TENANT_ID, PACIENTE_ID, PLANO_ID, usuarioProfissional(), entrada());
      await servico.revisar(TENANT_ID, PACIENTE_ID, PLANO_ID, usuarioProfissional());
      await servico.publicar(TENANT_ID, PACIENTE_ID, PLANO_ID, usuarioProfissional());
      const novo = await servico.criarNovaVersao(TENANT_ID, PACIENTE_ID, PLANO_ID, usuarioProfissional());
      repositorios.get(PlanoAlimentarVersaoOrm)!.registros.find(v => v.id === novo.id)!.apresentacaoSnapshotCriptografado = null;
      await expect(servico.obterRascunho(TENANT_ID, PACIENTE_ID, PLANO_ID, usuarioProfissional())).resolves.toMatchObject({ apresentacaoEstado: 'indisponivel' });
    });
    it('clone não converte snapshot publicado perdido em legado', async () => {
      await servico.atualizarRascunho(TENANT_ID, PACIENTE_ID, PLANO_ID, usuarioProfissional(), entrada());
      await servico.revisar(TENANT_ID, PACIENTE_ID, PLANO_ID, usuarioProfissional());
      await servico.publicar(TENANT_ID, PACIENTE_ID, PLANO_ID, usuarioProfissional());
      repositorios.get(PlanoAlimentarVersaoOrm)!.registros[0].apresentacaoSnapshotCriptografado = null;
      await expect(servico.criarNovaVersao(TENANT_ID, PACIENTE_ID, PLANO_ID, usuarioProfissional())).rejects.toBeInstanceOf(ConflictException);
    });
    it('corrupção fica indisponível e bloqueia revisão/publicação sem expor cipher', async () => {
      await servico.atualizarRascunho(TENANT_ID, PACIENTE_ID, PLANO_ID, usuarioProfissional(), entrada());
      repositorios.get(PlanoAlimentarVersaoOrm)!.registros[0].apresentacaoSnapshotCriptografado = Buffer.from('cipher-invalido-sintetico');
      await expect(servico.obterRascunho(TENANT_ID, PACIENTE_ID, PLANO_ID, usuarioProfissional())).resolves.toMatchObject({ apresentacaoEstado: 'indisponivel', apresentacaoRevisao: 1 });
      await expect(servico.revisar(TENANT_ID, PACIENTE_ID, PLANO_ID, usuarioProfissional())).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('PA05 — prévia paciente autorizada', () => {
    it('filtra substituições internas e devolve somente preferências paciente', async () => {
      const dados = dadosRascunho();
      dados.refeicoes[0].itens[0].substituicoes = [
        { descricao: 'Alternativa privada sintética', quantidade: 1, unidade: 'porção', porcaoGramas: 100, nutrientesPor100g: { energiaKcal: 100, proteinasG: 10, carboidratosG: 10, gordurasG: 5 }, liberadaParaPaciente: false, preferida: true },
        { descricao: 'Alternativa liberada sintética', quantidade: 1, unidade: 'porção', porcaoGramas: 100, nutrientesPor100g: { energiaKcal: 100, proteinasG: 10, carboidratosG: 10, gordurasG: 5 }, liberadaParaPaciente: true, preferida: false }
      ];
      await servico.atualizarRascunho(TENANT_ID, PACIENTE_ID, PLANO_ID, usuarioProfissional(), dados);
      const preview = await (servico as any).obterApresentacaoPaciente(TENANT_ID, PACIENTE_ID, PLANO_ID, 1, usuarioProfissional());
      expect(preview.status).toBe('rascunho');
      expect(preview.refeicoes[0].itens[0].substituicoes).toHaveLength(1);
      expect(JSON.stringify(preview)).not.toMatch(/privada|composicaoSnapshot|justificativaDivergencia|apresentacaoRevisao|revisadaPor|hashConteudo/);
    });
    it.each(['tenant', 'carteira', 'papel', 'permissao', 'paciente'] as const)('recusa prévia fora do escopo (%s)', async caso => {
      const usuario = usuarioProfissional();
      if (caso === 'carteira') repositorios.get(PacienteOrm)!.registros[0].profissionalResponsavelId = 'outro-profissional';
      if (caso === 'papel') usuario.papel = 'Patient';
      if (caso === 'permissao') usuario.permissoes = [];
      await expect((servico as any).obterApresentacaoPaciente(caso === 'tenant' ? 'tenant-alheio' : TENANT_ID, caso === 'paciente' ? 'paciente-alheio' : PACIENTE_ID, PLANO_ID, 1, usuario)).rejects.toThrow();
    });
  });

});
