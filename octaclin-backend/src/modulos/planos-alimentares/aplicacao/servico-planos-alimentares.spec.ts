import * as projecaoAjuda from './projecao-ajuda-dietetica';
import * as comparacaoReferencias from '../dominio/comparacao-referencias';
import { ReceitaNutricionalOrm } from '../infraestrutura/receita-nutricional.orm';
import { porcionarReceita } from '../dominio/porcionamento-receita';
import { criarSnapshotMicronutrientes } from '../dominio/micronutrientes';
import { ServicoEquivalenciasPlano } from './servico-equivalencias-plano';
import { FontesGruposSubstituicoes } from './fontes-grupos-substituicoes';
import { ServicoGruposSubstituicoes } from './servico-grupos-substituicoes';
import { ServiceUnavailableException } from '@nestjs/common';
import { ServicoAlimentosPersonalizados } from './servico-alimentos-personalizados';
import { normalizarComposicaoPersonalizada } from '../dominio/alimentos-personalizados';
import { ServicoMedidasCaseiras } from './servico-medidas-caseiras';
import { randomUUID } from 'crypto';
import { BadRequestException, ConflictException, ForbiddenException, InternalServerErrorException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
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

  describe('FOOD06 M04 API de prévia de rascunho',()=>{
    async function preparar() {
      Object.assign(repositorios.get(PlanoAlimentarOrm)!.registros[0],{ativoParaPaciente:true,ativacaoRevisao:0});
      const documento={schemaVersao:1 as const,avaliacaoAntropometricaId:AVALIACAO_ID,formula:'mifflin_st_jeor_1990' as const,fatorAtividade:1.4,carboidratosBasisPoints:5000,proteinasBasisPoints:2000,gordurasBasisPoints:3000,possuiCondicaoEspecial:false,aplicabilidadeFormulaConfirmada:true,objetivos:'CANARIO_PRIVADO',justificativaDivergenciaClinica:'Conferência sintética de planejamento',refeicoes:[{chaveCliente:'refeicao',nome:'Almoço sintético',itens:[{chaveCliente:'item',descricao:'Ingrediente sintético',quantidade:1,unidade:'porção',porcaoGramas:100,nutrientesPor100g:{energiaKcal:100,proteinasG:10,carboidratosG:20,gordurasG:2},micronutrientesPor100g:{ferroMg:2},substituicoes:[]}]}]};
      await servico.salvarEdicaoRascunho(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),{rascunhoIdEsperado:VERSAO_ID,rascunhoRevisaoEsperada:0,documento});
      return {rascunhoIdEsperado:VERSAO_ID,rascunhoRevisaoEsperada:1,ativacaoRevisaoEsperada:0,operacao:{tipo:'definir_porcao_manual',refeicaoChave:'refeicao',itemChave:'item',quantidade:1.5,unidade:'porção',porcaoGramas:150}};
    }
    async function prepararReceita() {
      const base=await preparar();
      const receitaId='50000000-0000-4000-8000-000000000051';
      const conteudo={metadados:{schemaVersao:1,baseQuantidades:'receita_inteira',rendimentoPorcoes:3},instrucoes:'Preparação sintética original',itens:[{descricao:'Ingrediente da receita',quantidade:3,unidade:'porção',porcaoGramas:300,nutrientesPor100g:{energiaKcal:100,proteinasG:10,carboidratosG:20,gordurasG:2},micronutrientesPor100g:{ferroMg:2},substituicoes:[{descricao:'Alternativa da receita',quantidade:3,unidade:'porção',porcaoGramas:300,nutrientesPor100g:{energiaKcal:900,proteinasG:10,carboidratosG:20,gordurasG:2},liberadaParaPaciente:true,preferida:true}]}]};
      const receita={id:receitaId,tenantId:TENANT_ID,profissionalId:PROFISSIONAL_ID,origem:'pessoal',tipo:'receita',versaoAtual:1,nomeCriptografado:criptografia.criptografar('Receita sintética'),conteudoCriptografado:criptografia.criptografar(JSON.stringify(conteudo)),etiquetasHashes:[]};
      repositorios.set(ReceitaNutricionalOrm,criarRepositorio([receita]));
      return {receita,conteudo,comando:{...base,operacao:{tipo:'inserir_receita',refeicaoChave:'refeicao',receitaId,receitaVersaoEsperada:1,porcoesDesejadas:1.5}}};
    }
    it('receita M04 usa porcionamento original uma vez, sem gravação nem soma de alternativas',async()=>{
      const c=await prepararReceita(),antes=estado();
      const p=await servico.preverMicronutrientes(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),c.comando);
      expect(p.comparacao.antes.calculo.nutrientes.energiaKcal.total).toBe(100);
      expect(p.comparacao.depois.calculo.nutrientes.energiaKcal.total).toBe(250);
      expect(p.comparacao.depois.cobertura.nutrientes.ferroMg.total).toBe(5);
      expect(p.comparacao.depois.cobertura.nutrientes.selenioMcg.estado).toBe('DESCONHECIDO');
      expect(estado()).toBe(antes);
      expect((await servico.preverMicronutrientes(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),c.comando)).fingerprint).toBe(p.fingerprint);
      const salvo=await servico.confirmarPreviaMicronutrientes(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),{...c.comando,fingerprintEsperado:p.fingerprint});
      expect(salvo.rascunhoRevisao).toBe(2);expect(salvo.refeicoes[0].itens).toHaveLength(2);
      expect(salvo.documentoEdicao!.refeicoes[0].itens[1]).toMatchObject({porcaoGramas:150,quantidade:1.5,substituicoes:[{liberadaParaPaciente:false,preferida:false}]});
      expect(salvo.documentoEdicao!.refeicoes[0].itens[1].chaveCliente).not.toBe('item');
      expect(JSON.parse(criptografia.descriptografar(c.receita.conteudoCriptografado))).toEqual(c.conteudo);
      const final=estado();await expect(servico.confirmarPreviaMicronutrientes(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),{...c.comando,fingerprintEsperado:p.fingerprint})).rejects.toBeInstanceOf(ConflictException);expect(estado()).toBe(final);
    });
    it('receita M04 fixa versão e reautoriza origem pessoal na confirmação',async()=>{
      const c=await prepararReceita(),p=await servico.preverMicronutrientes(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),c.comando);
      c.receita.versaoAtual=2;const antes=estado();
      await expect(servico.confirmarPreviaMicronutrientes(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),{...c.comando,fingerprintEsperado:p.fingerprint})).rejects.toBeInstanceOf(ConflictException);expect(estado()).toBe(antes);
      c.receita.versaoAtual=1;c.receita.profissionalId='outro-profissional';
      await expect(servico.preverMicronutrientes(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),c.comando)).rejects.toBeInstanceOf(NotFoundException);
    });
    it('receita M04 não infere base legada, rejeita destino inexistente e confirmação adulterada',async()=>{
      const c=await prepararReceita();
      await expect(servico.preverMicronutrientes(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),{...c.comando,operacao:{...c.comando.operacao,refeicaoChave:'alheia'}})).rejects.toBeInstanceOf(ConflictException);
      const p=await servico.preverMicronutrientes(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),c.comando),antes=estado();
      await expect(servico.confirmarPreviaMicronutrientes(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),{...c.comando,operacao:{...c.comando.operacao,porcoesDesejadas:2.5},fingerprintEsperado:p.fingerprint})).rejects.toBeInstanceOf(ConflictException);expect(estado()).toBe(antes);
      c.receita.conteudoCriptografado=criptografia.criptografar(JSON.stringify({itens:c.conteudo.itens}));
      await expect(servico.preverMicronutrientes(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),c.comando)).rejects.toThrow('porções');
    });
    it.each([[1,200,4],[1.5,250,5],[2.5,350,7]])('receita M04 %s porções usa a receita original, não uma prévia arredondada',async(porcoes,energia,ferro)=>{
      const c=await prepararReceita();
      for(const n of [1.333,porcoes]){
        const p=await servico.preverMicronutrientes(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),{...c.comando,operacao:{...c.comando.operacao,porcoesDesejadas:n}});
        if(n===porcoes){expect(p.comparacao.depois.calculo.nutrientes.energiaKcal.total).toBe(energia);expect(p.comparacao.depois.cobertura.nutrientes.ferroMg.total).toBe(ferro);}
      }
    });
    it('receita M04 bases equivalentes dão os mesmos fatos e mudanças de composição invalidam a prévia',async()=>{
      const c=await prepararReceita(),p=await servico.preverMicronutrientes(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),c.comando);
      const conteudo={...c.conteudo,metadados:{...c.conteudo.metadados,baseQuantidades:'por_porcao'},itens:c.conteudo.itens.map(i=>({...i,quantidade:1,porcaoGramas:100,substituicoes:i.substituicoes.map(a=>({...a,quantidade:1,porcaoGramas:100}))}))};
      c.receita.conteudoCriptografado=criptografia.criptografar(JSON.stringify(conteudo));
      const igual=await servico.preverMicronutrientes(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),c.comando);
      expect(igual.comparacao).toEqual(p.comparacao);
      const item=conteudo.itens[0];item.nutrientesPor100g.energiaKcal=200;
      c.receita.conteudoCriptografado=criptografia.criptografar(JSON.stringify(conteudo));
      const antes=estado();await expect(servico.confirmarPreviaMicronutrientes(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),{...c.comando,fingerprintEsperado:igual.fingerprint})).rejects.toBeInstanceOf(ConflictException);expect(estado()).toBe(antes);
    });
    it('receita M04 compartilhada exige tenant e estado ativo e respeita limites de expansão',async()=>{
      const c=await prepararReceita();
      c.receita.origem='clinica';c.receita.profissionalId='outro-profissional';
      await expect(servico.preverMicronutrientes(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),c.comando)).resolves.toHaveProperty('fingerprint');
      c.receita.tenantId='outro-tenant';await expect(servico.preverMicronutrientes(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),c.comando)).rejects.toBeInstanceOf(NotFoundException);
      c.receita.tenantId=TENANT_ID;Object.assign(c.receita,{arquivadoEm:new Date()});
      await expect(servico.preverMicronutrientes(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),c.comando)).rejects.toBeInstanceOf(NotFoundException);
      Object.assign(c.receita,{arquivadoEm:null,conteudoCriptografado:criptografia.criptografar(JSON.stringify({...c.conteudo,itens:Array.from({length:100},()=>c.conteudo.itens[0])}))});
      const antes=estado();await expect(servico.preverMicronutrientes(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),c.comando)).rejects.toThrow('limites');expect(estado()).toBe(antes);
    });
    it('M09 oferece texto explicativo próprio na prévia sem habilitar referências',async()=>{
      const entrada=await preparar();
      const r=await servico.preverMicronutrientes(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),entrada);
      expect(r).toHaveProperty('ajuda.schemaVersao',1);
      expect(r).toHaveProperty('ajuda.comparacoesHabilitadas',false);
      expect(r).toHaveProperty('ajuda.topicos',expect.arrayContaining([expect.objectContaining({codigo:'RDA',texto:expect.stringContaining('não comprova deficiência')})]));
      expect(JSON.stringify(r)).not.toContain('CANARIO_PRIVADO');
    });
    it('M09 análise sem seleção possui ajuda mas nenhuma comparação habilitada',async()=>{
      const r=await servico.analisarMicronutrientes(TENANT_ID,PACIENTE_ID,usuarioProfissional(),{selecoes:[]});
      expect(r).toHaveProperty('ajuda.topicos',expect.arrayContaining([expect.objectContaining({codigo:'UL',texto:expect.stringContaining('não garante segurança individual')})]));
      expect(r.comparacoes.estado).toBe('indisponivel');expect(r.calculo.estado).toBe('sem_selecao');
    });
    it('M09 alteração somente do título da ajuda não muda fingerprint ou fatos da prévia',async()=>{
      const entrada=await preparar(),antes=await servico.preverMicronutrientes(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),entrada);
      const original=projecaoAjuda.projetarAjudaDietetica;
      const stub=jest.spyOn(projecaoAjuda,'projetarAjudaDietetica').mockImplementation(()=>{const a=original();a.topicos[0].titulo='Ajuda sobre ingestão recomendada';return a;});
      try{
        const depois=await servico.preverMicronutrientes(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),entrada);
        expect(depois.ajuda.topicos[0].titulo).not.toBe(antes.ajuda.topicos[0].titulo);
        expect(depois.fingerprint).toBe(antes.fingerprint);expect(depois.comparacao).toEqual(antes.comparacao);
      }finally{stub.mockRestore();}
    });
    const estado=()=>JSON.stringify([...repositorios].map(([tipo,repo])=>({tipo:tipo.name,registros:repo.registros})));
    it('prévia não grava, calcula uma vez, não devolve texto/cifra e tem fingerprint estável',async()=>{
      const entrada=await preparar(),antes=estado();
      const p=await servico.preverMicronutrientes(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),entrada);
      expect(p.fingerprint).toMatch(/^[a-f0-9]{64}$/);
      expect(p.comparacao.diferencas.ferroMg.delta).toMatchObject({estado:'calculavel',diferenca:1,percentual:{valor:50}});
      expect(p.comparacao.antes.calculo.nutrientes.energiaKcal.total).toBe(100);
      expect(p.comparacao.depois.calculo.nutrientes.energiaKcal.total).toBe(150);
      expect(estado()).toBe(antes);expect(JSON.stringify(p)).not.toMatch(/CANARIO_PRIVADO|Criptograf|documentoEdicao|contextosCustom/);
      expect((await servico.preverMicronutrientes(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),entrada)).fingerprint).toBe(p.fingerprint);
    });
    it('nega usuário/tenant/carteira, revisão stale e ativação alterada antes de projetar',async()=>{
      const entrada=await preparar();
      await expect(servico.preverMicronutrientes('outro-tenant',PACIENTE_ID,PLANO_ID,usuarioProfissional(),entrada)).rejects.toBeInstanceOf(NotFoundException);
      for(const u of [{...usuarioProfissional(),papel:'SuperAdmin' as const},{...usuarioProfissional(),permissoes:['planos_alimentares.ler' as const]}])await expect(servico.preverMicronutrientes(TENANT_ID,PACIENTE_ID,PLANO_ID,u,entrada)).rejects.toBeInstanceOf(ForbiddenException);
      await expect(servico.preverMicronutrientes(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),{...entrada,rascunhoRevisaoEsperada:0})).rejects.toBeInstanceOf(ConflictException);
      repositorios.get(PlanoAlimentarOrm)!.registros[0].ativacaoRevisao=1;
      await expect(servico.preverMicronutrientes(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),entrada)).rejects.toBeInstanceOf(ConflictException);
      repositorios.get(PlanoAlimentarOrm)!.registros[0].ativacaoRevisao=0;
      repositorios.get(PacienteOrm)!.registros[0].profissionalResponsavelId='transferido';
      await expect(servico.preverMicronutrientes(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),entrada)).rejects.toBeInstanceOf(NotFoundException);
    });
    it('comando exige alvo editorial pertencente à mesma revisão e não admite composição do cliente',async()=>{
      const entrada=await preparar(),antes=estado();
      await expect(servico.preverMicronutrientes(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),{...entrada,operacao:{...entrada.operacao,itemChave:'alheio'}})).rejects.toBeInstanceOf(ConflictException);
      await expect(servico.preverMicronutrientes(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),{...entrada,operacao:{...entrada.operacao,micronutrientesPor100g:{ferroMg:999}}})).rejects.toBeInstanceOf(BadRequestException);
      expect(estado()).toBe(antes);
    });
    it('confirma na transação do writer, mantém fonte/manual e rejeita replay por CAS',async()=>{
      const entrada=await preparar(),p=await servico.preverMicronutrientes(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),entrada);
      const chamadas=executor.executar.mock.calls.length;
      const r=await servico.confirmarPreviaMicronutrientes(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),{...entrada,fingerprintEsperado:p.fingerprint});
      expect(executor.executar.mock.calls.length-chamadas).toBe(1);
      expect(r.rascunhoRevisao).toBe(2);expect(r.refeicoes[0].itens[0].porcaoGramas).toBe(150);
      expect(r.refeicoes[0].itens[0].composicaoSnapshot.micronutrientes?.nutrientes.ferroMg.porcao).toBe(3);
      const salvo=estado();await expect(servico.confirmarPreviaMicronutrientes(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),{...entrada,fingerprintEsperado:p.fingerprint})).rejects.toBeInstanceOf(ConflictException);expect(estado()).toBe(salvo);
    });
    it('troca catálogo, preserva alternativas e invalida composição atualizada/inativa sem alterar a prévia original',async()=>{
      const entrada=await preparar();
      const alimentoId='50000000-0000-4000-8000-000000000010',fonteId='50000000-0000-4000-8000-000000000011';
      repositorios.get(FonteComposicaoAlimentoOrm)!.registros.push({id:fonteId,codigo:'usda_fdc_foundation',nome:'Fonte sintética',versao:'sintetica-1',esquemaVersao:'octaclin-composicao-v1',situacao:'ativa',hashConteudo:'a'.repeat(64)});
      const alimento={id:alimentoId,fonteId,codigoOrigem:'SINT',nome:'Alternativa de catálogo',baseGramas:'100',energiaKcal:'200',proteinasG:'10',carboidratosG:'20',lipidiosG:'4',micronutrientes:{metadadosOrigem:{nutrientsOriginal:[{nutrient:{id:1089,unitName:'MG'},amount:4}]}}};
      repositorios.get(AlimentoComposicaoOrm)!.registros.push(alimento);
      const comando={...entrada,operacao:{...entrada.operacao,tipo:'substituir_catalogo',alimentoComposicaoId:alimentoId}};
      const p=await servico.preverMicronutrientes(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),comando);
      expect(p.comparacao.depois.calculo.nutrientes.ferroMg.total).toBe(6);
      const original=JSON.stringify(p),antes=estado();alimento.energiaKcal='250';
      await expect(servico.confirmarPreviaMicronutrientes(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),{...comando,fingerprintEsperado:p.fingerprint})).rejects.toBeInstanceOf(ConflictException);
      const atual=await servico.preverMicronutrientes(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),comando);
      expect(atual.fingerprint).not.toBe(p.fingerprint);expect(JSON.stringify(p)).toBe(original);
      expect(atual.comparacao.depois.calculo.nutrientes.energiaKcal.total).toBe(375);
      repositorios.get(FonteComposicaoAlimentoOrm)!.registros.find(f=>f.id===fonteId).situacao='inativa';
      await expect(servico.confirmarPreviaMicronutrientes(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),{...comando,fingerprintEsperado:atual.fingerprint})).rejects.toBeInstanceOf(BadRequestException);
      expect(repositorios.get(PlanoAlimentarVersaoOrm)!.registros[0].rascunhoRevisao).toBe(1);
      expect(estado()).not.toBe(antes); // somente a fixture de catálogo foi alterada explicitamente
    });
    it('preserva flags legítimas de alternativas existentes e não as soma',async()=>{
      await preparar();
      const salvo=await servico.obterRascunho(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional());
      const doc=salvo.documentoEdicao!;
      doc.refeicoes[0].itens[0].substituicoes=[{chaveCliente:'alt-legitima',descricao:'Alternativa',quantidade:1,unidade:'porção',porcaoGramas:50,nutrientesPor100g:{energiaKcal:999,proteinasG:10,carboidratosG:20,gordurasG:4},liberadaParaPaciente:true,preferida:true}];
      await servico.salvarEdicaoRascunho(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),{rascunhoIdEsperado:VERSAO_ID,rascunhoRevisaoEsperada:1,documento:doc});
      const comando={rascunhoIdEsperado:VERSAO_ID,rascunhoRevisaoEsperada:2,ativacaoRevisaoEsperada:0,operacao:{tipo:'definir_porcao_manual',refeicaoChave:'refeicao',itemChave:'item',quantidade:2,unidade:'porção',porcaoGramas:200}};
      const p=await servico.preverMicronutrientes(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),comando);
      expect(p.comparacao.depois.calculo.nutrientes.energiaKcal.total).toBe(200);
      expect(p.comparacao.depois.cobertura.nutrientes.selenioMcg.estado).toBe('DESCONHECIDO');
      const r=await servico.confirmarPreviaMicronutrientes(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),{...comando,fingerprintEsperado:p.fingerprint});
      expect(r.refeicoes[0].itens[0].substituicoes[0]).toMatchObject({liberadaParaPaciente:true,preferida:true,porcaoGramas:50});
    });
    it('rascunho incompleto e estado OFF não viram cálculo completo',async()=>{
      const comando=await preparar();
      const plano=repositorios.get(PlanoAlimentarOrm)!.registros[0];plano.ativoParaPaciente=false;
      const p=await servico.preverMicronutrientes(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),comando);
      expect(p.comparacao.depois.calculo.estado).toBe('sem_itens_incluidos');
      expect(p.comparacao.diferencas.ferroMg.delta.estado).toBe('indisponivel');
      repositorios.get(PlanoAlimentarVersaoOrm)!.registros[0].edicaoMaterializadaRevisao=null;
      await expect(servico.preverMicronutrientes(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),comando)).rejects.toBeInstanceOf(ConflictException);
    });
    it('R4 troca custom por catálogo por intenção explícita e preserva o snapshot anterior',async()=>{
      await preparar();
      const doc=(await servico.obterRascunho(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional())).documentoEdicao!;
      const id='50000000-0000-4000-8000-000000000021',fonteId='50000000-0000-4000-8000-000000000022';
      doc.refeicoes[0].itens[0].alimentoPersonalizado={id,revisao:1,aplicacaoId:id};
      const composicao=normalizarComposicaoPersonalizada({nome:'Custom anterior',base:{tipo:'por100g'},nutrientes:{energiaKcal:100,proteinasG:10,carboidratosG:20,gordurasG:2},micronutrientes:{ferroMg:2}});
      const resolver=jest.spyOn(ServicoAlimentosPersonalizados.prototype,'resolverAplicacao').mockResolvedValue({id,revisao:1,composicao});
      try{
        const anterior=await servico.salvarEdicaoRascunho(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),{rascunhoIdEsperado:VERSAO_ID,rascunhoRevisaoEsperada:1,documento:doc});
        const congelado=JSON.stringify(anterior.refeicoes[0].itens[0].composicaoSnapshot);
        repositorios.get(AlimentoComposicaoOrm)!.registros.push({id,fonteId,codigoOrigem:'fixture',nome:'Novo catálogo',baseGramas:'100',energiaKcal:'200',proteinasG:'10',carboidratosG:'20',lipidiosG:'4'});
        repositorios.get(FonteComposicaoAlimentoOrm)!.registros.push({id:fonteId,situacao:'ativa'});
        const comando={rascunhoIdEsperado:VERSAO_ID,rascunhoRevisaoEsperada:2,ativacaoRevisaoEsperada:0,operacao:{tipo:'substituir_catalogo',refeicaoChave:'refeicao',itemChave:'item',quantidade:1,unidade:'porção',porcaoGramas:100,alimentoComposicaoId:id}};
        const p=await servico.preverMicronutrientes(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),comando);
        const salvo=await servico.confirmarPreviaMicronutrientes(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),{...comando,fingerprintEsperado:p.fingerprint});
        expect(salvo.refeicoes[0].itens[0].composicaoSnapshot.origem).toBe('catalogo');
        expect(salvo.documentoEdicao!.refeicoes[0].itens[0]).toMatchObject({alimentoPersonalizado:null,descricao:'Novo catálogo'});
        expect(JSON.stringify(anterior.refeicoes[0].itens[0].composicaoSnapshot)).toBe(congelado);expect(resolver).toHaveBeenCalledTimes(1);
      }finally{resolver.mockRestore();}
    });
    it('R4 porção manual não restaura vínculo de medida caseira por omissão legada',async()=>{
      await preparar();
      const id='50000000-0000-4000-8000-000000000031',fonteId='50000000-0000-4000-8000-000000000032';
      repositorios.get(AlimentoComposicaoOrm)!.registros.push({id,fonteId,codigoOrigem:'fixture',nome:'Ingrediente',baseGramas:'100',energiaKcal:'100',proteinasG:'10',carboidratosG:'20',lipidiosG:'2'});
      repositorios.get(FonteComposicaoAlimentoOrm)!.registros.push({id:fonteId,situacao:'ativa'});
      const doc=(await servico.obterRascunho(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional())).documentoEdicao!;
      const item=doc.refeicoes[0].itens[0];item.alimentoComposicaoId=id;delete item.nutrientesPor100g;delete item.micronutrientesPor100g;
      item.medidaCaseira={id,revisao:1,aplicacaoId:fonteId};
      const resolver=jest.spyOn(ServicoMedidasCaseiras.prototype,'resolverAplicacao').mockResolvedValue({quantidade:1,unidade:'colher',porcaoGramas:100,referencia:{id,revisao:1,nome:'colher',quantidadeReferencia:1,pesoReferenciaGramas:100}});
      try{
        await servico.salvarEdicaoRascunho(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),{rascunhoIdEsperado:VERSAO_ID,rascunhoRevisaoEsperada:1,documento:doc});
        const comando={rascunhoIdEsperado:VERSAO_ID,rascunhoRevisaoEsperada:2,ativacaoRevisaoEsperada:0,operacao:{tipo:'definir_porcao_manual',refeicaoChave:'refeicao',itemChave:'item',quantidade:1,unidade:'colher',porcaoGramas:100}};
        const p=await servico.preverMicronutrientes(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),comando);
        const salvo=await servico.confirmarPreviaMicronutrientes(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),{...comando,fingerprintEsperado:p.fingerprint});
        expect(salvo.documentoEdicao!.refeicoes[0].itens[0].medidaCaseira).toBeNull();
        expect(salvo.medidasCaseirasAplicadas).toBeUndefined();expect(repositorios.get(PlanoAlimentarVersaoOrm)!.registros[0].medidasCaseirasSnapshotCriptografado).toBeNull();expect(resolver).toHaveBeenCalledTimes(1);
      }finally{resolver.mockRestore();}
    });
    it('mudança das preferências do rascunho invalida a confirmação anterior',async()=>{
      const entrada=await preparar(),p=await servico.preverMicronutrientes(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),entrada);
      repositorios.get(PlanoAlimentarVersaoOrm)!.registros[0].apresentacaoRevisao=1;
      const antes=estado();
      await expect(servico.confirmarPreviaMicronutrientes(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),{...entrada,fingerprintEsperado:p.fingerprint})).rejects.toBeInstanceOf(ConflictException);
      expect(estado()).toBe(antes);
    });
    it('não confirma operação alterada ou fingerprint adulterado e não grava nada',async()=>{
      const entrada=await preparar(),p=await servico.preverMicronutrientes(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),entrada),antes=estado();
      for(const c of [{...entrada,fingerprintEsperado:'a'.repeat(64)},{...entrada,operacao:{...entrada.operacao,porcaoGramas:200},fingerprintEsperado:p.fingerprint}])await expect(servico.confirmarPreviaMicronutrientes(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),c)).rejects.toBeInstanceOf(ConflictException);
      expect(estado()).toBe(antes);
    });
  });

  describe('PA06c cálculo combinado', () => {
    async function publicarParaCalculo(dados = dadosRascunho()) {
      const v = await servico.atualizarRascunho(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),dados);
      const versao = repositorios.get(PlanoAlimentarVersaoOrm)!.registros[0];
      versao.publicadaEm = new Date('2026-10-16T12:00:00Z');
      Object.assign(repositorios.get(PlanoAlimentarOrm)!.registros[0], { versaoPublicadaAtualId:VERSAO_ID, ativoParaPaciente:true, ativacaoRevisao:0, ativacaoDefinida:true });
      return { selecoes:[{planoId:PLANO_ID,versaoIdEsperada:VERSAO_ID,ativacaoRevisaoEsperada:0,identidadesRefeicoes:[v.ativacaoRefeicoes[0].identidadeId]}] };
    }
    it.each(['receita_inteira','por_porcao'] as const)('FOOD06 lê receita %s de1,5porções uma vez e não soma alternativas/preferência',async base=>{
      const macros={energiaKcal:120,proteinasG:10,carboidratosG:20,gordurasG:4};
      const original={instrucoes:'Preparo sintético',metadados:{schemaVersao:1,baseQuantidades:base,rendimentoPorcoes:4},itens:[{
        descricao:'Ingrediente receita',quantidade:base==='receita_inteira'?4:1,unidade:'porção',porcaoGramas:base==='receita_inteira'?500:125,
        nutrientesPor100g:macros,micronutrientesPor100g:{ferroMg:2,calcioMg:0},substituicoes:[{descricao:'Alternativa não contar',quantidade:1,unidade:'porção',porcaoGramas:100,nutrientesPor100g:macros,micronutrientesPor100g:{ferroMg:900},liberadaParaPaciente:true,preferida:true}]
      }]};
      const preservado=JSON.stringify(original),p=porcionarReceita(original,1.5);
      if(p.estado!=='calculavel')throw new Error('Porcionamento indisponível');
      expect(p.itens[0].porcaoGramas).toBe(187.5);
      const dados=dadosRascunho();Object.assign(dados.refeicoes[0],{itens:p.itens});
      const entrada=await publicarParaCalculo(dados);
      const antes=JSON.stringify([...repositorios].map(([tipo,repo])=>({tipo:tipo.name,registros:repo.registros})));
      const r=await servico.analisarMicronutrientes(TENANT_ID,PACIENTE_ID,usuarioProfissional(),entrada);
      expect(r.calculo.nutrientes.energiaKcal.total).toBe(225);
      expect(r.cobertura.nutrientes.ferroMg).toMatchObject({estado:'COMPLETO',total:3.75,contagens:{incluidos:1,conhecidos:1}});
      expect(r.cobertura.nutrientes.calcioMg).toMatchObject({estado:'COMPLETO',total:0});
      expect(r.cobertura.nutrientes.selenioMcg.estado).toBe('DESCONHECIDO');
      const d=await servico.detalharMicronutrientes(TENANT_ID,PACIENTE_ID,usuarioProfissional(),{...entrada,codigo:'ferroMg',pagina:1,limite:25});
      expect(d.refeicoes[0].itens[0]).toMatchObject({porcaoGramas:'187.500',cobertura:{total:3.75}});
      expect(JSON.stringify([...repositorios].map(([tipo,repo])=>({tipo:tipo.name,registros:repo.registros})))).toBe(antes);
      expect(JSON.stringify(original)).toBe(preservado);
    });
    it('FOOD06 receita de catálogo usa base nutricional autorizada e conserva publicação após mudança de fonte',async()=>{
      const alimentoId='10000000-0000-4000-8000-000000000061',fonteId='10000000-0000-4000-8000-000000000062';
      const fonte={id:fonteId,codigo:'usda_fdc_foundation',nome:'Fonte sintética original',versao:'v1',situacao:'ativa',direitoUsoStatus:'aprovado',esquemaVersao:'octaclin-composicao-v1',hashConteudo:'a'.repeat(64)};
      const alimento={id:alimentoId,fonteId,codigoOrigem:'SINTETICO',nome:'Ingrediente catálogo',preparacao:'Cozido',baseGramas:'10',energiaKcal:'10',proteinasG:'1',carboidratosG:'2',lipidiosG:'0.4',micronutrientes:{metadadosOrigem:{nutrientsOriginal:[{nutrient:{id:1089,unitName:'MG'},amount:2}]}}};
      repositorios.get(AlimentoComposicaoOrm)!.registros.push(alimento);repositorios.get(FonteComposicaoAlimentoOrm)!.registros.push(fonte);
      const original={metadados:{schemaVersao:1,baseQuantidades:'receita_inteira',rendimentoPorcoes:4},itens:[{alimentoComposicaoId:alimentoId,quantidade:4,unidade:'porção',porcaoGramas:500}]};
      const p=porcionarReceita(original,1.5);if(p.estado!=='calculavel')throw new Error('Prévia indisponível');
      const dados=dadosRascunho();Object.assign(dados.refeicoes[0],{itens:p.itens});
      const entrada=await publicarParaCalculo(dados);
      const consultar=()=>servico.detalharMicronutrientes(TENANT_ID,PACIENTE_ID,usuarioProfissional(),{...entrada,codigo:'ferroMg',pagina:1,limite:25});
      const r=await consultar();expect(r.cobertura).toMatchObject({estado:'COMPLETO',total:37.5});
      expect(r.refeicoes[0].itens[0].composicao).toMatchObject({preparacao:'Cozido',baseGramas:10,fonte:{versao:'v1'}});
      fonte.versao='v2';fonte.situacao='inativa';alimento.micronutrientes.metadadosOrigem.nutrientsOriginal[0].amount=999;
      expect((await consultar()).refeicoes).toEqual(r.refeicoes);
      await servico.criarNovaVersao(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional());
      await expect(servico.atualizarRascunho(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),dados)).rejects.toThrow('Fonte do alimento nao esta ativa');
      expect((await consultar()).refeicoes).toEqual(r.refeicoes);
    });
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
    it('FOOD06 detalhe usa identidade persistente, página limitada e total integral sem escrita', async () => {
      const entrada = await publicarParaCalculo();
      const antes = JSON.stringify([...repositorios].map(([tipo, repo]) => ({ tipo: tipo.name, registros: repo.registros })));
      const r = await servico.detalharMicronutrientes(TENANT_ID,PACIENTE_ID,usuarioProfissional(),{...entrada,codigo:'calcioMg',pagina:1,limite:1});
      expect(r).toMatchObject({schemaVersao:1,motorVersao:'food06-contribuicoes-v1',total:1,pagina:1,limite:1,
        refeicoes:[{planoId:PLANO_ID,itens:[{itemId:repositorios.get(PlanoAlimentarItemOrm)!.registros[0].id,descricao:'Alimento manual'}]}]});
      expect(JSON.stringify(r)).not.toMatch(/indiceItem|Criptograf|contextoInterno/);
      expect(JSON.stringify([...repositorios].map(([tipo, repo]) => ({ tipo: tipo.name, registros: repo.registros })))).toBe(antes);
      const vazia = await servico.detalharMicronutrientes(TENANT_ID,PACIENTE_ID,usuarioProfissional(),{...entrada,codigo:'calcioMg',pagina:2,limite:1});
      expect(vazia).toMatchObject({total:1,refeicoes:[]});
    });
    it('FOOD06 projeta fonte/preparo congelados e coordenadas exatas sem contexto clínico',async()=>{
      const entrada=await publicarParaCalculo();
      const registro=repositorios.get(PlanoAlimentarItemOrm)!.registros[0];
      const snapshot=JSON.parse(criptografia.descriptografar(registro.composicaoSnapshotCriptografada));
      Object.assign(snapshot,{origem:'catalogo',preparacao:'Cozido',fonte:{codigo:'TACO',nome:'Tabela sintética',versao:'sintetica-v1',hashConteudo:'CANARIO_INTERNO'},contextoClinico:'CANARIO_INTERNO'});
      registro.composicaoSnapshotCriptografada=criptografia.criptografar(JSON.stringify(snapshot));
      const r=await servico.detalharMicronutrientes(TENANT_ID,PACIENTE_ID,usuarioProfissional(),{...entrada,codigo:'ferroMg',pagina:1,limite:1});
      expect(r.refeicoes[0]).toMatchObject({refeicaoId:registro.refeicaoId,versaoNumero:1});
      expect(r.refeicoes[0].itens[0]).toMatchObject({composicao:{origem:'catalogo',preparacao:'Cozido',fonte:{codigo:'TACO',nome:'Tabela sintética',versao:'sintetica-v1'}}});
      expect(JSON.stringify(r)).not.toContain('CANARIO_INTERNO');
    });
    it('FOOD06 detalhe reautoriza e rejeita revisão stale em cada página', async () => {
      const entrada = {...await publicarParaCalculo(),codigo:'calcioMg',pagina:1,limite:1};
      await expect(servico.detalharMicronutrientes('outro-tenant',PACIENTE_ID,usuarioProfissional(),entrada)).rejects.toBeInstanceOf(NotFoundException);
      await expect(servico.detalharMicronutrientes(TENANT_ID,PACIENTE_ID,{...usuarioProfissional(),permissoes:[]},entrada)).rejects.toBeInstanceOf(ForbiddenException);
      repositorios.get(PlanoAlimentarOrm)!.registros[0].ativacaoRevisao = 1;
      await expect(servico.detalharMicronutrientes(TENANT_ID,PACIENTE_ID,usuarioProfissional(),entrada)).rejects.toBeInstanceOf(ConflictException);
      repositorios.get(PlanoAlimentarOrm)!.registros[0].ativacaoRevisao = 0;
      repositorios.get(PacienteOrm)!.registros[0].profissionalResponsavelId = 'transferido';
      await expect(servico.detalharMicronutrientes(TENANT_ID,PACIENTE_ID,usuarioProfissional(),entrada)).rejects.toBeInstanceOf(NotFoundException);
    });
    it('FOOD06 analisa fatos/cobertura sem referências clínicas, escrita ou projeção de texto', async () => {
      const entrada = await publicarParaCalculo();
      const registro = repositorios.get(PlanoAlimentarItemOrm)!.registros[0];
      const snapshot = JSON.parse(criptografia.descriptografar(registro.composicaoSnapshotCriptografada));
      snapshot.micronutrientes = criarSnapshotMicronutrientes({ calcioMg: { estado: 'conhecido', valor: 0 } }, 100, 100);
      snapshot.contextoInterno = 'canario-factual-sintetico';
      registro.composicaoSnapshotCriptografada = criptografia.criptografar(JSON.stringify(snapshot));
      const antes = JSON.stringify([...repositorios].map(([tipo, repo]) => ({ tipo: tipo.name, registros: repo.registros })));
      const r = await servico.analisarMicronutrientes(TENANT_ID,PACIENTE_ID,usuarioProfissional(),entrada);
      expect(r).toMatchObject({ schemaVersao:1, motorVersao:'food06-factual-v1', comparacoes:{estado:'indisponivel',motivo:'referencias_nao_habilitadas'} });
      expect(r.calculo.nutrientes.energiaKcal.total).toBe(120);
      expect(r.cobertura.nutrientes.calcioMg).toMatchObject({estado:'COMPLETO',total:0});
      expect(r.cobertura.nutrientes.ferroMg).toMatchObject({estado:'DESCONHECIDO'});
      expect(r.cobertura.nutrientes.ferroMg).not.toHaveProperty('total');
      expect(r.publicacoes).toEqual([{planoId:PLANO_ID,versaoId:VERSAO_ID,ativacaoRevisao:0}]);
      expect(JSON.stringify(r)).not.toMatch(/Criptograf|objetivos|Alimento manual|canario-factual-sintetico/);
      const repetido = await servico.analisarMicronutrientes(TENANT_ID,PACIENTE_ID,usuarioProfissional(),entrada);
      expect(repetido.calculo).toEqual(r.calculo);
      expect(JSON.stringify([...repositorios].map(([tipo, repo]) => ({ tipo: tipo.name, registros: repo.registros })))).toBe(antes);
      const legado = await servico.calcularCombinado(TENANT_ID,PACIENTE_ID,usuarioProfissional(),entrada);
      const { calculadoEm: _data, publicacoes: _publicacoes, ...calculoLegado } = legado;
      expect(r.calculo).toEqual(calculoLegado);
    });
    it('FOOD06 preserva impedimento técnico de snapshot sem expor conteúdo', async () => {
      const entrada = await publicarParaCalculo();
      repositorios.get(PlanoAlimentarItemOrm)!.registros[0].composicaoSnapshotCriptografada = Buffer.from('corrompido-sintetico');
      const r = await servico.analisarMicronutrientes(TENANT_ID,PACIENTE_ID,usuarioProfissional(),entrada);
      expect(r.cobertura.nutrientes.ferroMg).toMatchObject({estado:'INDISPONIVEL',causas:[{codigo:'snapshot_indisponivel',quantidade:1}]});
      expect(JSON.stringify(r)).not.toContain('corrompido-sintetico');
    });
    it('FOOD06 seleção vazia e OFF continuam factuais e rejeitam revisão obsoleta', async () => {
      expect((await servico.analisarMicronutrientes(TENANT_ID,PACIENTE_ID,usuarioProfissional(),{selecoes:[]})).calculo.estado).toBe('sem_selecao');
      const entrada = await publicarParaCalculo();
      repositorios.get(PlanoAlimentarOrm)!.registros[0].ativoParaPaciente = false;
      expect((await servico.analisarMicronutrientes(TENANT_ID,PACIENTE_ID,usuarioProfissional(),entrada)).calculo.itensIncluidos).toBe(0);
      repositorios.get(PlanoAlimentarOrm)!.registros[0].ativacaoRevisao = 1;
      await expect(servico.analisarMicronutrientes(TENANT_ID,PACIENTE_ID,usuarioProfissional(),entrada)).rejects.toBeInstanceOf(ConflictException);
    });
    it('FOOD06 nega tenant, carteira, paciente/plano alheio e permissão revogada sem subtotal', async () => {
      const entrada = await publicarParaCalculo();
      await expect(servico.analisarMicronutrientes('outro-tenant',PACIENTE_ID,usuarioProfissional(),entrada)).rejects.toBeInstanceOf(NotFoundException);
      await expect(servico.analisarMicronutrientes(TENANT_ID,PACIENTE_ID,{...usuarioProfissional(),usuarioId:'outro-profissional'},entrada)).rejects.toThrow();
      await expect(servico.analisarMicronutrientes(TENANT_ID,PACIENTE_ID,{...usuarioProfissional(),papel:'Client'},entrada)).rejects.toBeInstanceOf(ForbiddenException);
      await expect(servico.analisarMicronutrientes(TENANT_ID,PACIENTE_ID,{...usuarioProfissional(),permissoes:[]},entrada)).rejects.toBeInstanceOf(ForbiddenException);
      await expect(servico.analisarMicronutrientes(TENANT_ID,PACIENTE_ID,usuarioProfissional(),{selecoes:[...entrada.selecoes,{...entrada.selecoes[0],planoId:randomUUID()}]})).rejects.toBeInstanceOf(NotFoundException);
      repositorios.get(PacienteOrm)!.registros[0].profissionalResponsavelId = 'transferido';
      await expect(servico.analisarMicronutrientes(TENANT_ID,PACIENTE_ID,usuarioProfissional(),entrada)).rejects.toBeInstanceOf(NotFoundException);
    });
    it.each([{tenantId:'adulterado'}, {coeficientes:{ferroMg:9}}, {elegivel:true}, {snapshots:[]}])('FOOD06 rejeita payload extra %o', async extra => {
      await expect(servico.analisarMicronutrientes(TENANT_ID,PACIENTE_ID,usuarioProfissional(),{selecoes:[],...extra})).rejects.toBeInstanceOf(BadRequestException);
    });
    describe('FOOD06 T3a: referencias DRI por opt-in na analise ao vivo', () => {
      // Confirmacoes sinteticas do profissional; nascimento e data vem so do servidor.
      const confirmacoes = (extra: Record<string, unknown> = {}) => ({ populacaoReferencia:'feminina', populacaoConfirmada:true, gestacao:'nao', lactacao:'nao',
        aplicabilidade:'confirmada', mesmoDiaPlanejado:true, tabagismo:'nao', ...extra });
      const comCalcioZero = async () => {
        const entrada = await publicarParaCalculo();
        const registro = repositorios.get(PlanoAlimentarItemOrm)!.registros[0];
        const snapshot = JSON.parse(criptografia.descriptografar(registro.composicaoSnapshotCriptografada));
        snapshot.micronutrientes = criarSnapshotMicronutrientes({ calcioMg: { estado: 'conhecido', valor: 0 } }, 100, 100);
        registro.composicaoSnapshotCriptografada = criptografia.criptografar(JSON.stringify(snapshot));
        return entrada;
      };
      it('sem a flag a resposta e identica a de antes (mesmas chaves e placeholder)', async () => {
        const entrada = await comCalcioZero();
        const r = await servico.analisarMicronutrientes(TENANT_ID,PACIENTE_ID,usuarioProfissional(),entrada);
        expect(Object.keys(r).sort()).toEqual(['ajuda','calculadoEm','calculo','cobertura','comparacoes','fontes','motorVersao','publicacoes','schemaVersao']);
        expect(r.comparacoes).toEqual({estado:'indisponivel',motivo:'referencias_nao_habilitadas'});
        const comFlagFalse = await servico.analisarMicronutrientes(TENANT_ID,PACIENTE_ID,usuarioProfissional(),{...entrada,incluirReferencias:false});
        expect(comFlagFalse.comparacoes).toEqual({estado:'indisponivel',motivo:'referencias_nao_habilitadas'});
      });
      it('com a flag compara com as referencias da versao vigente usando o nascimento do servidor', async () => {
        const entrada = await comCalcioZero();
        repositorios.get(PacienteOrm)!.registros[0].dataNascimento = '1985-06-15';
        const r = await servico.analisarMicronutrientes(TENANT_ID,PACIENTE_ID,usuarioProfissional(),{...entrada,incluirReferencias:true,confirmacoes:confirmacoes()});
        expect(r.comparacoes).toMatchObject({estado:'calculado',versaoReferencias:'dri-hc-2025-11-19-adulto-v1',contextoElegivel:true,motivosContexto:[],
          fonteReferencias:{autoridade:'Health Canada',licenca:'OGL-Canada'}});
        if (r.comparacoes.estado !== 'calculado') throw new Error('esperado calculado');
        expect(r.comparacoes.nutrientes).toHaveLength(22);
        const calcio = r.comparacoes.nutrientes.find(n => n.codigo === 'calcioMg')!;
        // Calcio conhecido 0 mg (zero conhecido e valido) contra a RDA feminina 31-50 de 1000 mg.
        expect(calcio.referencia).toMatchObject({estado:'comparavel',tipo:'RDA',percentual:0,valorReferencia:1000});
        expect(calcio.ul).toMatchObject({estado:'comparavel',posicao:'abaixo',valorReferencia:2500});
        // Ferro sem valor conhecido: cobertura incompleta, nunca percentual.
        expect(r.comparacoes.nutrientes.find(n => n.codigo === 'ferroMg')!.referencia).toEqual({estado:'indisponivel',motivo:'dados_incompletos'});
        expect(JSON.stringify(r.comparacoes)).not.toMatch(/1985|nascimento|idadeAnos|deficien|toxic|adequad|segur/i);
        // O calculo factual nao muda com a flag.
        const semFlag = await servico.analisarMicronutrientes(TENANT_ID,PACIENTE_ID,usuarioProfissional(),entrada);
        expect(r.calculo).toEqual(semFlag.calculo);
        expect(r.cobertura).toEqual(semFlag.cobertura);
      });
      it('sem nascimento cadastrado, ou com gestacao confirmada, a comparacao fica indisponivel com o motivo do contexto', async () => {
        const entrada = await comCalcioZero();
        const semNascimento = await servico.analisarMicronutrientes(TENANT_ID,PACIENTE_ID,usuarioProfissional(),{...entrada,incluirReferencias:true,confirmacoes:confirmacoes()});
        expect(semNascimento.comparacoes).toMatchObject({estado:'calculado',contextoElegivel:false,motivosContexto:['nascimento_nao_informado']});
        if (semNascimento.comparacoes.estado !== 'calculado') throw new Error('esperado calculado');
        expect(semNascimento.comparacoes.nutrientes.every(n => n.referencia.estado === 'indisponivel' && n.ul.estado === 'indisponivel')).toBe(true);
        repositorios.get(PacienteOrm)!.registros[0].dataNascimento = '1985-06-15';
        const gestante = await servico.analisarMicronutrientes(TENANT_ID,PACIENTE_ID,usuarioProfissional(),{...entrada,incluirReferencias:true,confirmacoes:confirmacoes({gestacao:'sim'})});
        expect(gestante.comparacoes).toMatchObject({estado:'calculado',contextoElegivel:false,motivosContexto:['gestacao_fora_do_escopo']});
      });
      it('reautoriza antes de ler o nascimento: tenant, carteira e permissao negados com a flag', async () => {
        const entrada = await comCalcioZero();
        repositorios.get(PacienteOrm)!.registros[0].dataNascimento = '1985-06-15';
        const corpo = {...entrada,incluirReferencias:true,confirmacoes:confirmacoes()};
        const consultasPaciente = repositorios.get(PacienteOrm)!.findOne;
        const leuNascimento = () => consultasPaciente.mock.calls.some(([opcoes]) => opcoes?.select?.dataNascimento);
        consultasPaciente.mockClear();
        await expect(servico.analisarMicronutrientes('outro-tenant',PACIENTE_ID,usuarioProfissional(),corpo)).rejects.toBeInstanceOf(NotFoundException);
        expect(leuNascimento()).toBe(false);
        await expect(servico.analisarMicronutrientes(TENANT_ID,PACIENTE_ID,{...usuarioProfissional(),permissoes:[]},corpo)).rejects.toBeInstanceOf(ForbiddenException);
        await expect(servico.analisarMicronutrientes(TENANT_ID,PACIENTE_ID,{...usuarioProfissional(),papel:'Client'},corpo)).rejects.toBeInstanceOf(ForbiddenException);
        repositorios.get(PacienteOrm)!.registros[0].profissionalResponsavelId = 'transferido';
        await expect(servico.analisarMicronutrientes(TENANT_ID,PACIENTE_ID,usuarioProfissional(),corpo)).rejects.toBeInstanceOf(NotFoundException);
        // Carteira negada: o nascimento nunca chega a ser lido (a autorização vem antes).
        expect(leuNascimento()).toBe(false);
      });
      it('SuperAdmin nao recebe referencias (dispensa a carteira); a analise sem a flag continua como antes', async () => {
        const entrada = await comCalcioZero();
        repositorios.get(PacienteOrm)!.registros[0].dataNascimento = '1985-06-15';
        const admin = {...usuarioProfissional(),papel:'SuperAdmin' as const};
        const consultasPaciente = repositorios.get(PacienteOrm)!.findOne;
        consultasPaciente.mockClear();
        await expect(servico.analisarMicronutrientes(TENANT_ID,PACIENTE_ID,admin,{...entrada,incluirReferencias:true,confirmacoes:confirmacoes()})).rejects.toBeInstanceOf(ForbiddenException);
        expect(consultasPaciente.mock.calls.some(([opcoes]) => opcoes?.select?.dataNascimento)).toBe(false);
        const legado: any = await servico.analisarMicronutrientes(TENANT_ID,PACIENTE_ID,admin,entrada);
        expect(legado.comparacoes).toEqual({estado:'indisponivel',motivo:'referencias_nao_habilitadas'});
        const semFlag: any = await servico.analisarMicronutrientes(TENANT_ID,PACIENTE_ID,admin,{...entrada,incluirReferencias:false});
        expect(semFlag.comparacoes).toEqual({estado:'indisponivel',motivo:'referencias_nao_habilitadas'});
      });
      it('defeito no comparador nao e mascarado como limite de precisao', async () => {
        const entrada = await comCalcioZero();
        repositorios.get(PacienteOrm)!.registros[0].dataNascimento = '1985-06-15';
        const espiao = jest.spyOn(comparacaoReferencias, 'compararAnaliseComReferencias').mockImplementation(() => { throw new Error('defeito sintetico'); });
        try {
          const erro = await servico.analisarMicronutrientes(TENANT_ID,PACIENTE_ID,usuarioProfissional(),{...entrada,incluirReferencias:true,confirmacoes:confirmacoes()}).then(() => undefined, (e: unknown) => e);
          expect(erro).toBeInstanceOf(InternalServerErrorException);
          expect(erro).not.toBeInstanceOf(UnprocessableEntityException);
        } finally { espiao.mockRestore(); }
      });
      it.each([
        [{incluirReferencias:true}],
        [{confirmacoes:{}}],
        [{incluirReferencias:true,confirmacoes:{nascimento:'1990-01-01'}}],
        [{incluirReferencias:'true'}],
        [{incluirReferencias:true,contexto:{elegivel:true}}]
      ])('rejeita opt-in malformado %o sem calcular', async extra => {
        const entrada = await comCalcioZero();
        await expect(servico.analisarMicronutrientes(TENANT_ID,PACIENTE_ID,usuarioProfissional(),{...entrada,...extra} as never)).rejects.toBeInstanceOf(BadRequestException);
      });
      it('a analise com referencias continua somente leitura', async () => {
        const entrada = await comCalcioZero();
        repositorios.get(PacienteOrm)!.registros[0].dataNascimento = '1985-06-15';
        const antes = JSON.stringify([...repositorios].map(([tipo, repo]) => ({ tipo: tipo.name, registros: repo.registros })));
        await servico.analisarMicronutrientes(TENANT_ID,PACIENTE_ID,usuarioProfissional(),{...entrada,incluirReferencias:true,confirmacoes:confirmacoes()});
        expect(JSON.stringify([...repositorios].map(([tipo, repo]) => ({ tipo: tipo.name, registros: repo.registros })))).toBe(antes);
      });
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
      expect(salvo.refeicoes[0].itens[0].substituicoes[0].equivalenciaAplicada).toBe(true);
      expect(salvo.refeicoes[0].itens[0].substituicoes[0].referenciaEquivalencia).toEqual({ itemChave: 'item-sintetico', alternativaChave: 'equivalente' });
      expect(JSON.stringify(salvo.equivalenciasAplicadas)).not.toMatch(/comandoHash|snapshotAlternativa|dependenciasHash|ator/);
    });
    it('FOOD06 confirma mudança de porção preservando proveniência FOOD05 e exige revisão da equivalência',async()=>{
      Object.assign(repositorios.get(PlanoAlimentarOrm)!.registros[0],{ativoParaPaciente:true,ativacaoRevisao:0});
      const {d,aplicacaoId}=await prepararEquivalencia();
      await salvarEdicao(d);
      const versao=repositorios.get(PlanoAlimentarVersaoOrm)!.registros[0];
      const antes=versao.edicaoSnapshotCriptografado;
      const comando={rascunhoIdEsperado:VERSAO_ID,rascunhoRevisaoEsperada:1,ativacaoRevisaoEsperada:0,operacao:{tipo:'definir_porcao_manual',refeicaoChave:'refeicao-sintetica',itemChave:'item-sintetico',quantidade:1.5,unidade:'porção',porcaoGramas:120}};
      const previa=await servico.preverMicronutrientes(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),comando);
      expect(versao.edicaoSnapshotCriptografado).toBe(antes);
      const salvo:any=await servico.confirmarPreviaMicronutrientes(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),{...comando,fingerprintEsperado:previa.fingerprint});
      expect(salvo.equivalenciasAplicadas.equivalente).toMatchObject({aplicacaoId,estado:'revisao_pendente'});
      expect(salvo.documentoEdicao.refeicoes[0].itens[0].substituicoes[0]).toMatchObject({liberadaParaPaciente:false,preferida:false});
      expect(JSON.parse(criptografia.descriptografar(versao.edicaoSnapshotCriptografado)).equivalencias.equivalente.aplicacaoId).toBe(aplicacaoId);
    });
    it.each(['alterada','indisponivel'] as const)('FOOD06 rejeita confirmação se a fonte da equivalência ficar %s após a prévia',async cenario=>{
      Object.assign(repositorios.get(PlanoAlimentarOrm)!.registros[0],{ativoParaPaciente:true,ativacaoRevisao:0});
      const {d}=await prepararEquivalencia(true);await salvarEdicao(d);
      const comando={rascunhoIdEsperado:VERSAO_ID,rascunhoRevisaoEsperada:1,ativacaoRevisaoEsperada:0,operacao:{tipo:'definir_porcao_manual',refeicaoChave:'refeicao-sintetica',itemChave:'item-sintetico',quantidade:1.5,unidade:'porção',porcaoGramas:120}};
      const previa=await servico.preverMicronutrientes(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),comando);
      expect(JSON.stringify(previa)).not.toMatch(/fingerprintResolucao|dependenciasHash|copiaOrigem/);
      const versao=repositorios.get(PlanoAlimentarVersaoOrm)!.registros[0],antes=versao.edicaoSnapshotCriptografado;
      const catalogo=repositorios.get(AlimentoComposicaoOrm)!.registros.find((r:any)=>r.id==='10000000-0000-4000-8000-000000000087')!;
      if(cenario==='alterada')catalogo.energiaKcal='161';
      else repositorios.get(AlimentoComposicaoOrm)!.registros.splice(repositorios.get(AlimentoComposicaoOrm)!.registros.indexOf(catalogo),1);
      await expect(servico.confirmarPreviaMicronutrientes(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),{...comando,fingerprintEsperado:previa.fingerprint})).rejects.toBeInstanceOf(ConflictException);
      expect(versao.edicaoSnapshotCriptografado).toBe(antes);
      expect(versao.rascunhoRevisao).toBe(1);
    });
    it('FOOD05 permite equivalência em grupo FOOD04 quando o nutriente alvo existe e os demais macros estão ausentes',async()=>{
      const {d}=await prepararEquivalencia(true);const principal=d.refeicoes[0].itens[0],alternativa=principal.substituicoes[0];
      delete alternativa.nutrientesPor100g;
      const catalogo=repositorios.get(AlimentoComposicaoOrm)!.registros.find((r:any)=>r.id==='10000000-0000-4000-8000-000000000087')!;delete catalogo.proteinasG;delete catalogo.carboidratosG;delete catalogo.lipidiosG;
      alternativa.alimentoComposicaoId=catalogo.id;
      alternativa.origemGrupo={grupoId:'10000000-0000-4000-8000-000000000051',entradaId:'10000000-0000-4000-8000-000000000052',aplicacaoId:'10000000-0000-4000-8000-000000000053',revisao:1};
      const fontes=new FontesGruposSubstituicoes(criptografia);
      const resolverGrupo=jest.spyOn(ServicoGruposSubstituicoes.prototype,'resolverAplicacao').mockResolvedValue({id:alternativa.origemGrupo.entradaId,origem:'catalogo',alimentoId:'10000000-0000-4000-8000-000000000087',revisao:1,quantidade:1,unidade:'g',porcaoGramas:80,composicao:{descricao:'Alternativa FOOD04 sintética',nutrientesPor100g:{energiaKcal:80},micronutrientesPor100g:{},fonte:{codigo:'SINTETICA',versao:'1'}}} as any);
      try{
        const equivalencias=new ServicoEquivalenciasPlano(executor as any,criptografia,fontes,new ServicoGruposSubstituicoes(executor as any,criptografia,fontes));
        const previa=await equivalencias.prever(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),{versaoId:VERSAO_ID,rascunhoRevisaoEsperada:0,documentoEdicao:d,itemChave:principal.chaveCliente,nutriente:'energiaKcal',alternativas:[alternativa],politica:{passoPorcaoGramas:'1'}});
        const linha=previa.alternativas[0];expect(linha.resultado).toMatchObject({estado:'calculavel',aplicavel:true,motivosAplicacao:[]});expect(linha.impacto?.estado).toBe('incompleto');
        if(linha.resultado.estado!=='calculavel'||!linha.fingerprint)throw new Error('Prévia sintética FOOD04 deveria ser aplicável pelo alvo.');
        alternativa.porcaoGramas=linha.resultado.porcaoEfetivaGramas;alternativa.equivalencia={acao:'calcular',aplicacaoId:randomUUID(),nutriente:'energiaKcal',politica:{passoPorcaoGramas:'1'},porcaoEfetiva:linha.resultado.porcaoEfetivaGramas,fingerprintEsperado:linha.fingerprint};
        const salvo:any=await salvarEdicao(d);expect(salvo.edicaoEstado).toBe('materializada');expect(salvo.equivalenciasAplicadas?.[alternativa.chaveCliente]?.estado).toBe('calculada_revisada');
      }finally{resolverGrupo.mockRestore();}
    });
    it('FOOD05 materializa substituição individual com macros não alvo ausentes sem fabricar zeros',async()=>{
      const {d}=await prepararEquivalencia(true);const principal=d.refeicoes[0].itens[0],alternativa=principal.substituicoes[0];delete alternativa.nutrientesPor100g;
      const catalogo=repositorios.get(AlimentoComposicaoOrm)!.registros.find((r:any)=>r.id==='10000000-0000-4000-8000-000000000087')!;delete catalogo.proteinasG;delete catalogo.carboidratosG;delete catalogo.lipidiosG;
      const fontes=new FontesGruposSubstituicoes(criptografia);const equivalencias=new ServicoEquivalenciasPlano(executor as any,criptografia,fontes,new ServicoGruposSubstituicoes(executor as any,criptografia,fontes));
      const previa=await equivalencias.prever(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),{versaoId:VERSAO_ID,rascunhoRevisaoEsperada:0,documentoEdicao:d,itemChave:principal.chaveCliente,nutriente:'energiaKcal',alternativas:[alternativa],politica:{passoPorcaoGramas:'1'}});
      const linha=previa.alternativas[0];expect(linha.resultado).toMatchObject({estado:'calculavel',aplicavel:true});expect(linha.impacto?.estado).toBe('incompleto');
      if(linha.resultado.estado!=='calculavel'||!linha.fingerprint)throw new Error('Prévia individual FOOD05 deveria ser aplicável pelo alvo.');
      alternativa.porcaoGramas=linha.resultado.porcaoEfetivaGramas;alternativa.equivalencia={acao:'calcular',aplicacaoId:randomUUID(),nutriente:'energiaKcal',politica:{passoPorcaoGramas:'1'},porcaoEfetiva:linha.resultado.porcaoEfetivaGramas,fingerprintEsperado:linha.fingerprint};
      const salvo:any=await salvarEdicao(d);expect(salvo.edicaoEstado).toBe('materializada');expect(salvo.equivalenciasAplicadas?.[alternativa.chaveCliente]?.estado).toBe('calculada_revisada');
      expect(salvo.refeicoes[0].itens[0].substituicoes[0].composicaoSnapshot.nutrientesPor100g).toMatchObject({energiaKcal:160});
      expect(salvo.refeicoes[0].itens[0].substituicoes[0].composicaoSnapshot.nutrientesPor100g).not.toHaveProperty('proteinasG');
      expect(salvo.refeicoes[0].itens[0].substituicoes[0].composicaoSnapshot.nutrientesPorcao).not.toHaveProperty('proteinasG');
      Object.assign(repositorios.get(PlanoAlimentarOrm)!.registros[0],{ativoParaPaciente:true,ativacaoRevisao:0});
      const comando={rascunhoIdEsperado:VERSAO_ID,rascunhoRevisaoEsperada:1,ativacaoRevisaoEsperada:0,operacao:{tipo:'definir_porcao_manual',refeicaoChave:'refeicao-sintetica',itemChave:'item-sintetico',quantidade:1.5,unidade:'porção',porcaoGramas:120}};
      const p=await servico.preverMicronutrientes(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),comando);
      const confirmado:any=await servico.confirmarPreviaMicronutrientes(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),{...comando,fingerprintEsperado:p.fingerprint});
      expect(confirmado.equivalenciasAplicadas.equivalente.estado).toBe('revisao_pendente');
      expect(confirmado.refeicoes[0].itens[0].substituicoes[0].composicaoSnapshot.nutrientesPor100g).not.toHaveProperty('proteinasG');
    });
    it('FOOD05 copia proveniência da versão autorizada no backend, remapeia chaves e marca nova aplicação pendente',async()=>{
      const {d,aplicacaoId}=await prepararEquivalencia();
      const primeira:any=await salvarEdicao(d);
      primeira.documentoEdicao.refeicoes[0].itens[0].substituicoes[0].liberadaParaPaciente=true;
      primeira.documentoEdicao.refeicoes[0].itens[0].substituicoes[0].preferida=true;
      const origem:any=await salvarEdicao(primeira.documentoEdicao,1),doc:any=JSON.parse(JSON.stringify(origem.documentoEdicao));
      const itemOrigem=doc.refeicoes[0].itens[0],alternativaOrigem=itemOrigem.substituicoes[0];
      const itemDestino=JSON.parse(JSON.stringify(itemOrigem)),alternativaDestino=itemDestino.substituicoes[0];
      itemDestino.chaveCliente='item-copia-food05';alternativaDestino.chaveCliente='alternativa-copia-food05';delete alternativaDestino.equivalencia;
      alternativaDestino.liberadaParaPaciente=false;alternativaDestino.preferida=false;
      doc.refeicoes[0].itens.push(itemDestino);
      const salvo:any=await servico.salvarEdicaoRascunho(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),{
        rascunhoIdEsperado:VERSAO_ID,rascunhoRevisaoEsperada:2,documento:doc,
        copiasEquivalencia:[{pacienteOrigemId:PACIENTE_ID,planoOrigemId:PLANO_ID,versaoIdOrigem:VERSAO_ID,numeroVersaoOrigem:1,rascunhoRevisaoOrigemEsperada:2,itemChaveOrigem:itemOrigem.chaveCliente,alternativaChaveOrigem:alternativaOrigem.chaveCliente,itemChaveDestino:itemDestino.chaveCliente,alternativaChaveDestino:alternativaDestino.chaveCliente}]
      } as any);
      const contextos=JSON.parse(criptografia.descriptografar(repositorios.get(PlanoAlimentarVersaoOrm)!.registros[0].edicaoSnapshotCriptografado)).equivalencias;
      expect(salvo.equivalenciasAplicadas['alternativa-copia-food05']).toMatchObject({estado:'revisao_pendente'});
      expect(salvo.documentoEdicao.refeicoes[0].itens[1].substituicoes[0]).toMatchObject({liberadaParaPaciente:false,preferida:false});
      expect(contextos['alternativa-copia-food05']).toMatchObject({itemChave:'item-copia-food05',alternativaChave:'alternativa-copia-food05',estado:'revisao_pendente',copiaOrigem:{pacienteId:PACIENTE_ID,planoId:PLANO_ID,versaoId:VERSAO_ID,rascunhoRevisaoOrigem:2,origemInicial:{rascunhoRevisaoOrigem:2},aplicacaoId, itemChave:itemOrigem.chaveCliente,alternativaChave:alternativaOrigem.chaveCliente,copiadaPor:{usuarioId:USUARIO_ID,profissionalId:PROFISSIONAL_ID}}});
      expect(contextos['alternativa-copia-food05'].aplicacaoId).not.toBe(aplicacaoId);
      expect(alternativaDestino.equivalencia).toBeUndefined();
    });
    it.each(['liberadaParaPaciente','preferida'])('FOOD05 recusa cópia com %s positiva antes de gravar',async campo=>{
      const {d}=await prepararEquivalencia();
      const origem:any=await salvarEdicao(d),doc:any=JSON.parse(JSON.stringify(origem.documentoEdicao));
      const itemOrigem=doc.refeicoes[0].itens[0],alternativaOrigem=itemOrigem.substituicoes[0];
      const itemDestino=JSON.parse(JSON.stringify(itemOrigem)),alternativaDestino=itemDestino.substituicoes[0];
      itemDestino.chaveCliente=`item-copia-flags-${campo}`;alternativaDestino.chaveCliente=`alternativa-copia-flags-${campo}`;delete alternativaDestino.equivalencia;
      alternativaDestino[campo]=true;doc.refeicoes[0].itens.push(itemDestino);
      const versao=repositorios.get(PlanoAlimentarVersaoOrm)!.registros[0],revisaoAntes=versao.rascunhoRevisao;
      await expect(servico.salvarEdicaoRascunho(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),{
        rascunhoIdEsperado:VERSAO_ID,rascunhoRevisaoEsperada:1,documento:doc,
        copiasEquivalencia:[{pacienteOrigemId:PACIENTE_ID,planoOrigemId:PLANO_ID,versaoIdOrigem:VERSAO_ID,numeroVersaoOrigem:1,rascunhoRevisaoOrigemEsperada:1,itemChaveOrigem:itemOrigem.chaveCliente,alternativaChaveOrigem:alternativaOrigem.chaveCliente,itemChaveDestino:itemDestino.chaveCliente,alternativaChaveDestino:alternativaDestino.chaveCliente}]
      } as any)).rejects.toBeInstanceOf(BadRequestException);
      expect(versao.rascunhoRevisao).toBe(revisaoAntes);
    });
    it('FOOD05 não libera equivalência copiada no mesmo save que resolve revisão pendente',async()=>{
      const {d}=await prepararEquivalencia();
      const origem:any=await salvarEdicao(d),doc:any=JSON.parse(JSON.stringify(origem.documentoEdicao));
      const itemOrigem=doc.refeicoes[0].itens[0],alternativaOrigem=itemOrigem.substituicoes[0];
      const itemDestino=JSON.parse(JSON.stringify(itemOrigem)),alternativaDestino=itemDestino.substituicoes[0];
      itemDestino.chaveCliente='item-copia-revisao-flags';alternativaDestino.chaveCliente='alternativa-copia-revisao-flags';delete alternativaDestino.equivalencia;
      alternativaDestino.liberadaParaPaciente=false;alternativaDestino.preferida=false;doc.refeicoes[0].itens.push(itemDestino);
      const copiada:any=await servico.salvarEdicaoRascunho(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),{
        rascunhoIdEsperado:VERSAO_ID,rascunhoRevisaoEsperada:1,documento:doc,
        copiasEquivalencia:[{pacienteOrigemId:PACIENTE_ID,planoOrigemId:PLANO_ID,versaoIdOrigem:VERSAO_ID,numeroVersaoOrigem:1,rascunhoRevisaoOrigemEsperada:1,itemChaveOrigem:itemOrigem.chaveCliente,alternativaChaveOrigem:alternativaOrigem.chaveCliente,itemChaveDestino:itemDestino.chaveCliente,alternativaChaveDestino:alternativaDestino.chaveCliente}]
      } as any);
      const contextos=JSON.parse(criptografia.descriptografar(repositorios.get(PlanoAlimentarVersaoOrm)!.registros[0].edicaoSnapshotCriptografado)).equivalencias;
      const contexto=contextos['alternativa-copia-revisao-flags'];
      const calculoOriginalPersistido=contexto.calculoOriginalCopia;
      const paraRecalcular:any=JSON.parse(JSON.stringify(copiada.documentoEdicao));
      const item=paraRecalcular.refeicoes[0].itens[1],alternativa=item.substituicoes[0];
      const fontes=new FontesGruposSubstituicoes(criptografia);
      const previaServico=new ServicoEquivalenciasPlano(executor as any,criptografia,fontes,new ServicoGruposSubstituicoes(executor as any,criptografia,fontes));
      const previa=await previaServico.prever(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),{
        versaoId:VERSAO_ID,rascunhoRevisaoEsperada:2,documentoEdicao:paraRecalcular,itemChave:item.chaveCliente,
        nutriente:'energiaKcal',alternativas:[alternativa],politica:{passoPorcaoGramas:'1'}
      });
      const linha=previa.alternativas[0];if(linha.resultado.estado!=='calculavel')throw new Error('Prévia de recálculo sintética deveria calcular');
      alternativa.porcaoGramas=linha.resultado.porcaoEfetivaGramas;
      alternativa.equivalencia={acao:'recalcular',aplicacaoId:randomUUID(),anteriorAplicacaoId:contexto.aplicacaoId,nutriente:'energiaKcal',politica:{passoPorcaoGramas:'1'},porcaoEfetiva:alternativa.porcaoGramas,fingerprintEsperado:linha.fingerprint};
      alternativa.liberadaParaPaciente=true;alternativa.preferida=true;
      const versao=repositorios.get(PlanoAlimentarVersaoOrm)!.registros[0],revisaoAntes=versao.rascunhoRevisao,snapshotAntes=versao.edicaoSnapshotCriptografado;
      await expect(servico.salvarEdicaoRascunho(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),{
        rascunhoIdEsperado:VERSAO_ID,rascunhoRevisaoEsperada:2,documento:paraRecalcular
      })).rejects.toBeInstanceOf(BadRequestException);
      expect(versao.rascunhoRevisao).toBe(revisaoAntes);
      expect(versao.edicaoSnapshotCriptografado).toBe(snapshotAntes);
      alternativa.liberadaParaPaciente=false;alternativa.preferida=false;
      const resolvida:any=await servico.salvarEdicaoRascunho(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),{
        rascunhoIdEsperado:VERSAO_ID,rascunhoRevisaoEsperada:2,documento:paraRecalcular
      });
      expect(resolvida.equivalenciasAplicadas['alternativa-copia-revisao-flags'].estado).toBe('calculada_revisada');
      expect(resolvida.documentoEdicao.refeicoes[0].itens[1].substituicoes[0]).toMatchObject({liberadaParaPaciente:false,preferida:false});
      const contextoRecalculado=JSON.parse(criptografia.descriptografar(repositorios.get(PlanoAlimentarVersaoOrm)!.registros[0].edicaoSnapshotCriptografado)).equivalencias['alternativa-copia-revisao-flags'];
      expect(contextoRecalculado.copiaOrigem).toEqual(contexto.copiaOrigem);
      expect(contextoRecalculado.calculoOriginalCopia).toEqual(calculoOriginalPersistido);
      await servico.revisar(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),{rascunhoIdEsperado:VERSAO_ID,rascunhoRevisaoEsperada:3});
      await servico.publicar(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),{rascunhoIdEsperado:VERSAO_ID,rascunhoRevisaoEsperada:4});
      const publicada:any=await servico.obterVersao(TENANT_ID,PACIENTE_ID,PLANO_ID,1,usuarioProfissional());
      expect(publicada.refeicoes[0].itens[1].substituicoes[0]).toMatchObject({liberadaParaPaciente:false,preferida:false});
      const nova:any=await servico.criarNovaVersao(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional());
      const ativada=JSON.parse(JSON.stringify(nova.documentoEdicao));
      ativada.refeicoes[0].itens[1].substituicoes[0].liberadaParaPaciente=true;
      ativada.refeicoes[0].itens[1].substituicoes[0].preferida=true;
      const salvamentoAtivacao:any=await servico.salvarEdicaoRascunho(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),{
        rascunhoIdEsperado:nova.id,rascunhoRevisaoEsperada:0,documento:ativada
      });
      expect(salvamentoAtivacao.documentoEdicao.refeicoes[0].itens[1].substituicoes[0]).toMatchObject({liberadaParaPaciente:true,preferida:true});
    });
    it('FOOD05 mantém flags legítimas ao recalcular equivalência já liberada que ficou pendente',async()=>{
      const {d}=await prepararEquivalencia();
      const primeira:any=await salvarEdicao(d);
      const liberada:any=JSON.parse(JSON.stringify(primeira.documentoEdicao));
      liberada.refeicoes[0].itens[0].substituicoes[0].liberadaParaPaciente=true;
      liberada.refeicoes[0].itens[0].substituicoes[0].preferida=true;
      const segunda:any=await salvarEdicao(liberada,1);
      const desatualizada:any=JSON.parse(JSON.stringify(segunda.documentoEdicao));
      desatualizada.refeicoes[0].itens[0].porcaoGramas=160;
      const pendente:any=await salvarEdicao(desatualizada,2);
      expect(pendente.equivalenciasAplicadas.equivalente.estado).toBe('revisao_pendente');
      const documento=JSON.parse(JSON.stringify(pendente.documentoEdicao));
      const item=documento.refeicoes[0].itens[0],alternativa=item.substituicoes[0];
      const fontes=new FontesGruposSubstituicoes(criptografia);
      const previaServico=new ServicoEquivalenciasPlano(executor as any,criptografia,fontes,new ServicoGruposSubstituicoes(executor as any,criptografia,fontes));
      const previa=await previaServico.prever(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),{
        versaoId:VERSAO_ID,rascunhoRevisaoEsperada:3,documentoEdicao:documento,itemChave:item.chaveCliente,
        nutriente:'energiaKcal',alternativas:[alternativa],politica:{passoPorcaoGramas:'1'}
      });
      const linha=previa.alternativas[0];if(linha.resultado.estado!=='calculavel')throw new Error('Prévia sintética deveria calcular');
      alternativa.porcaoGramas=linha.resultado.porcaoEfetivaGramas;
      alternativa.equivalencia={acao:'recalcular',aplicacaoId:randomUUID(),anteriorAplicacaoId:pendente.equivalenciasAplicadas.equivalente.aplicacaoId,nutriente:'energiaKcal',politica:{passoPorcaoGramas:'1'},porcaoEfetiva:alternativa.porcaoGramas,fingerprintEsperado:linha.fingerprint};
      const resolvida:any=await salvarEdicao(documento,3);
      expect(resolvida.equivalenciasAplicadas.equivalente.estado).toBe('calculada_revisada');
      expect(resolvida.documentoEdicao.refeicoes[0].itens[0].substituicoes[0]).toMatchObject({liberadaParaPaciente:true,preferida:true});
    });
    it('FOOD05 cópia não aceita referência de uma origem sem acesso no escopo atual',async()=>{
      const {d}=await prepararEquivalencia();const origem:any=await salvarEdicao(d),doc=JSON.parse(JSON.stringify(origem.documentoEdicao));
      const itemDestino=JSON.parse(JSON.stringify(doc.refeicoes[0].itens[0])),alternativaDestino=itemDestino.substituicoes[0];
      itemDestino.chaveCliente='item-sem-acesso';alternativaDestino.chaveCliente='alternativa-sem-acesso';delete alternativaDestino.equivalencia;doc.refeicoes[0].itens.push(itemDestino);
      await expect(servico.salvarEdicaoRascunho(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),{
        rascunhoIdEsperado:VERSAO_ID,rascunhoRevisaoEsperada:1,documento:doc,
        copiasEquivalencia:[{pacienteOrigemId:randomUUID(),planoOrigemId:randomUUID(),versaoIdOrigem:VERSAO_ID,numeroVersaoOrigem:1,rascunhoRevisaoOrigemEsperada:1,itemChaveOrigem:'item-origem',alternativaChaveOrigem:'alternativa-origem',itemChaveDestino:itemDestino.chaveCliente,alternativaChaveDestino:alternativaDestino.chaveCliente}]
      } as any)).rejects.toBeInstanceOf(NotFoundException);
      expect(repositorios.get(PlanoAlimentarVersaoOrm)!.registros[0].rascunhoRevisao).toBe(1);
    });
    it.each([
      ['identidade da versão divergente', { versaoIdOrigem: randomUUID(), rascunhoRevisaoOrigemEsperada: 1 }],
      ['revisão do rascunho divergente', { versaoIdOrigem: VERSAO_ID, rascunhoRevisaoOrigemEsperada: 0 }],
      ['revisão do rascunho ausente', { versaoIdOrigem: VERSAO_ID }]
    ])('FOOD05 recusa cópia quando %s', async (_caso, origemEsperada) => {
      const { d } = await prepararEquivalencia();
      const origem: any = await salvarEdicao(d), documento = JSON.parse(JSON.stringify(origem.documentoEdicao));
      const itemOrigem = documento.refeicoes[0].itens[0], alternativaOrigem = itemOrigem.substituicoes[0];
      const itemDestino = JSON.parse(JSON.stringify(itemOrigem)), alternativaDestino = itemDestino.substituicoes[0];
      itemDestino.chaveCliente = `item-origem-desatualizada-${_caso}`;
      alternativaDestino.chaveCliente = `alternativa-origem-desatualizada-${_caso}`;
      delete alternativaDestino.equivalencia;
      documento.refeicoes[0].itens.push(itemDestino);
      await expect(servico.salvarEdicaoRascunho(TENANT_ID, PACIENTE_ID, PLANO_ID, usuarioProfissional(), {
        rascunhoIdEsperado: VERSAO_ID, rascunhoRevisaoEsperada: 1, documento,
        copiasEquivalencia: [{
          pacienteOrigemId: PACIENTE_ID, planoOrigemId: PLANO_ID, numeroVersaoOrigem: 1,
          ...origemEsperada, itemChaveOrigem: itemOrigem.chaveCliente,
          alternativaChaveOrigem: alternativaOrigem.chaveCliente,
          itemChaveDestino: itemDestino.chaveCliente, alternativaChaveDestino: alternativaDestino.chaveCliente
        }]
      } as any)).rejects.toBeInstanceOf(ConflictException);
      expect(repositorios.get(PlanoAlimentarVersaoOrm)!.registros[0].rascunhoRevisao).toBe(1);
    });
    it('FOOD05 copia proveniência de versão publicada sem depender do snapshot editorial removido',async()=>{
      const {d}=await prepararEquivalencia(true);await salvarEdicao(d);
      await servico.revisar(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),{rascunhoIdEsperado:VERSAO_ID,rascunhoRevisaoEsperada:1});
      await servico.publicar(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),{rascunhoIdEsperado:VERSAO_ID,rascunhoRevisaoEsperada:2});
      const nova:any=await servico.criarNovaVersao(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional());
      const itemOrigem=nova.documentoEdicao.refeicoes[0].itens[0],alternativaOrigem=itemOrigem.substituicoes[0];
      const itemDestino=JSON.parse(JSON.stringify(itemOrigem)),alternativaDestino=itemDestino.substituicoes[0];
      itemDestino.chaveCliente='item-copia-versao-publicada';alternativaDestino.chaveCliente='alternativa-copia-versao-publicada';delete alternativaDestino.equivalencia;
      nova.documentoEdicao.refeicoes[0].itens.push(itemDestino);
      const salvo:any=await servico.salvarEdicaoRascunho(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),{
        rascunhoIdEsperado:nova.id,rascunhoRevisaoEsperada:0,documento:nova.documentoEdicao,
        copiasEquivalencia:[{pacienteOrigemId:PACIENTE_ID,planoOrigemId:PLANO_ID,versaoIdOrigem:VERSAO_ID,numeroVersaoOrigem:1,itemChaveOrigem:itemOrigem.chaveCliente,alternativaChaveOrigem:alternativaOrigem.chaveCliente,itemChaveDestino:itemDestino.chaveCliente,alternativaChaveDestino:alternativaDestino.chaveCliente}]
      } as any);
      expect(salvo.equivalenciasAplicadas['alternativa-copia-versao-publicada']).toMatchObject({estado:'revisao_pendente'});
      expect(alternativaDestino.equivalencia).toBeUndefined();
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
    it.each(['alterada','inativa'])('FOOD05 marca revisão após mudança acessível e preserva snapshot quando fonte %s',async(cenario)=>{
      const {d}=await prepararEquivalencia(true);const primeiro:any=await salvarEdicao(d);
      const a=repositorios.get(AlimentoComposicaoOrm)!.registros.find((r:any)=>r.id==='10000000-0000-4000-8000-000000000087')!;
      if(cenario==='alterada')a.energiaKcal='999';else repositorios.get(FonteComposicaoAlimentoOrm)!.registros.find((r:any)=>r.id===a.fonteId)!.situacao='inativa';
      const segundo:any=await salvarEdicao(primeiro.documentoEdicao,1);
      expect(segundo.equivalenciasAplicadas.equivalente.estado).toBe(cenario==='alterada'?'revisao_pendente':'calculada_revisada');
      const alt=segundo.refeicoes[0].itens[0].substituicoes[0];expect(alt.composicaoSnapshot.nutrientesPorcao.energiaKcal).toBe(80);expect(alt.composicaoSnapshot.micronutrientes.nutrientes.ferroMg.porcao).toBe(1);
      if(cenario==='alterada'){
        const fontes=new FontesGruposSubstituicoes(criptografia);const s=new ServicoEquivalenciasPlano(executor as any,criptografia,fontes,new ServicoGruposSubstituicoes(executor as any,criptografia,fontes));
        const doc=segundo.documentoEdicao,principal=doc.refeicoes[0].itens[0],alternativa=principal.substituicoes[0];
        const previa=await s.prever(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),{versaoId:VERSAO_ID,rascunhoRevisaoEsperada:2,documentoEdicao:doc,itemChave:principal.chaveCliente,nutriente:'energiaKcal',alternativas:[alternativa],politica:{passoPorcaoGramas:'1'},recalculoExplicitoChaves:[alternativa.chaveCliente]});
        expect(previa.alternativas[0].alimento?.nutrientes.energiaKcal).toBe('999');
        const linha=previa.alternativas[0];if(linha.resultado.estado!=='calculavel'||!linha.fingerprint)throw new Error('Prévia de recálculo deveria usar a composição corrente.');
        alternativa.porcaoGramas=linha.resultado.porcaoEfetivaGramas;alternativa.equivalencia={acao:'recalcular',aplicacaoId:randomUUID(),anteriorAplicacaoId:segundo.equivalenciasAplicadas.equivalente.aplicacaoId,nutriente:'energiaKcal',politica:{passoPorcaoGramas:'1'},porcaoEfetiva:linha.resultado.porcaoEfetivaGramas,fingerprintEsperado:linha.fingerprint};
        const recalculada:any=await salvarEdicao(doc,2);expect(recalculada.equivalenciasAplicadas.equivalente.estado).toBe('calculada_revisada');
        expect(recalculada.equivalenciasAplicadas.equivalente.alternativa.nutrientes.energiaKcal).toBe('999');
        expect(recalculada.refeicoes[0].itens[0].substituicoes[0].composicaoSnapshot.nutrientesPorcao.energiaKcal).toBeGreaterThan(0);
      }
    });
    it('FOOD05 projeta revisão pendente na leitura e bloqueia revisão/publicação após mudança de composição',async()=>{
      const {d}=await prepararEquivalencia(true);const salvo:any=await salvarEdicao(d);
      await servico.revisar(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),{rascunhoIdEsperado:VERSAO_ID,rascunhoRevisaoEsperada:1});
      const alimento=repositorios.get(AlimentoComposicaoOrm)!.registros.find((r:any)=>r.id==='10000000-0000-4000-8000-000000000087')!;alimento.energiaKcal='999';
      const leitura:any=await servico.obter(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional());
      expect(leitura.draft.equivalenciasAplicadas.equivalente.estado).toBe('revisao_pendente');
      expect(leitura.draft.documentoEdicao.refeicoes[0].itens[0].substituicoes[0].porcaoGramas).toBe('50');
      expect(repositorios.get(PlanoAlimentarVersaoOrm)!.registros[0].revisadaEm).not.toBeNull();
      await expect(servico.revisar(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),{rascunhoIdEsperado:VERSAO_ID,rascunhoRevisaoEsperada:2})).rejects.toThrow(/equivalência.*pendente/i);
      await expect(servico.publicar(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),{rascunhoIdEsperado:VERSAO_ID,rascunhoRevisaoEsperada:2})).rejects.toThrow(/equivalência.*pendente/i);
      const persistido=(servico as any).lerContextosEquivalencias(repositorios.get(PlanoAlimentarVersaoOrm)!.registros[0]);
      expect(persistido.equivalente.estado).toBe('calculada_revisada');
      const fontes=new FontesGruposSubstituicoes(criptografia),equivalencias=new ServicoEquivalenciasPlano(executor as any,criptografia,fontes,new ServicoGruposSubstituicoes(executor as any,criptografia,fontes));
      const documento=leitura.draft.documentoEdicao,item=documento.refeicoes[0].itens[0],alternativa=item.substituicoes[0];
      const previa=await equivalencias.prever(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),{versaoId:VERSAO_ID,rascunhoRevisaoEsperada:2,documentoEdicao:documento,itemChave:item.chaveCliente,nutriente:'energiaKcal',politica:{passoPorcaoGramas:'1'},alternativas:[alternativa],recalculoExplicitoChaves:[alternativa.chaveCliente]});
      expect(previa.alternativas[0].alimento?.nutrientes.energiaKcal).toBe('999');
      const linha=previa.alternativas[0];if(linha.resultado.estado!=='calculavel'||!linha.fingerprint)throw new Error('Prévia stale deveria permitir recálculo explícito validado.');
      alternativa.porcaoGramas=linha.resultado.porcaoEfetivaGramas;
      alternativa.equivalencia={acao:'recalcular',aplicacaoId:randomUUID(),anteriorAplicacaoId:leitura.draft.equivalenciasAplicadas.equivalente.aplicacaoId,nutriente:'energiaKcal',politica:{passoPorcaoGramas:'1'},porcaoEfetiva:linha.resultado.porcaoEfetivaGramas,fingerprintEsperado:linha.fingerprint};
      const recalculada:any=await salvarEdicao(documento,2);
      expect(recalculada.equivalenciasAplicadas.equivalente).toMatchObject({estado:'calculada_revisada',alternativa:{nutrientes:{energiaKcal:'999'}}});
    });
    it('FOOD05 não marca revisão por mudança somente de metadados nem de formatação numérica da fonte',async()=>{
      const {d}=await prepararEquivalencia(true);const primeiro:any=await salvarEdicao(d);
      const alimento=repositorios.get(AlimentoComposicaoOrm)!.registros.find((r:any)=>r.id==='10000000-0000-4000-8000-000000000087')!;alimento.energiaKcal='160.000';
      const fonte=repositorios.get(FonteComposicaoAlimentoOrm)!.registros.find((r:any)=>r.id===alimento.fonteId)!;fonte.versao='2';fonte.hashConteudo='b'.repeat(64);
      const salvo:any=await salvarEdicao(primeiro.documentoEdicao,1);
      expect(salvo.equivalenciasAplicadas.equivalente.estado).toBe('calculada_revisada');
      expect(salvo.refeicoes[0].itens[0].substituicoes[0].composicaoSnapshot.nutrientesPorcao.energiaKcal).toBe(80);
    });
    it('FOOD05 reabre prévia de equivalência com fonte aplicada inativa sem buscar composição nova',async()=>{
      const {d}=await prepararEquivalencia(true);const primeiro:any=await salvarEdicao(d);
      repositorios.get(FonteComposicaoAlimentoOrm)!.registros.find((r:any)=>r.id==='10000000-0000-4000-8000-000000000086')!.situacao='inativa';
      const fontes=new FontesGruposSubstituicoes(criptografia);const s=new ServicoEquivalenciasPlano(executor as any,criptografia,fontes,new ServicoGruposSubstituicoes(executor as any,criptografia,fontes));
      const previa=await s.prever(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),{versaoId:VERSAO_ID,rascunhoRevisaoEsperada:1,documentoEdicao:primeiro.documentoEdicao,itemChave:d.refeicoes[0].itens[0].chaveCliente,nutriente:'energiaKcal',alternativas:primeiro.documentoEdicao.refeicoes[0].itens[0].substituicoes,politica:{passoPorcaoGramas:'1'}});
      expect(previa.alternativas[0].resultado).toMatchObject({estado:'calculavel',porcaoEfetivaGramas:'50'});
    });
    it('FOOD05 não recalcula explicitamente usando snapshot quando a fonte atual está indisponível',async()=>{
      const {d}=await prepararEquivalencia(true);const primeiro:any=await salvarEdicao(d);
      const alimento=repositorios.get(AlimentoComposicaoOrm)!.registros.find((r:any)=>r.id==='10000000-0000-4000-8000-000000000087')!;alimento.energiaKcal='999';
      const pendente:any=await salvarEdicao(primeiro.documentoEdicao,1);expect(pendente.equivalenciasAplicadas.equivalente.estado).toBe('revisao_pendente');
      repositorios.get(FonteComposicaoAlimentoOrm)!.registros.find((r:any)=>r.id===alimento.fonteId)!.situacao='inativa';
      const fontes=new FontesGruposSubstituicoes(criptografia);const s=new ServicoEquivalenciasPlano(executor as any,criptografia,fontes,new ServicoGruposSubstituicoes(executor as any,criptografia,fontes));
      const doc=pendente.documentoEdicao,principal=doc.refeicoes[0].itens[0],alternativa=principal.substituicoes[0];
      const previa=await s.prever(TENANT_ID,PACIENTE_ID,PLANO_ID,usuarioProfissional(),{versaoId:VERSAO_ID,rascunhoRevisaoEsperada:2,documentoEdicao:doc,itemChave:principal.chaveCliente,nutriente:'energiaKcal',alternativas:[alternativa],politica:{passoPorcaoGramas:'1'},recalculoExplicitoChaves:[alternativa.chaveCliente]});
      expect(previa.alternativas[0].resultado).toMatchObject({estado:'indisponivel',motivo:'referencia_indisponivel'});
      expect(previa.alternativas[0].alimento).toBeUndefined();
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
