import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { UserActionLogOrm } from '../../../infraestrutura/auditoria/user-action-log.orm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { ProfissionalOrm } from '../../profissionais/infraestrutura/profissional.orm';
import { AlimentoComposicaoOrm } from '../infraestrutura/alimento-composicao.orm';
import { FonteComposicaoAlimentoOrm } from '../infraestrutura/fonte-composicao-alimento.orm';
import { ReceitaNutricionalOrm } from '../infraestrutura/receita-nutricional.orm';
import { ServicoReceitasNutricionais } from './servico-receitas-nutricionais';

const TENANT_ID = '10000000-0000-4000-8000-000000000001';
const USUARIO_ID = '10000000-0000-4000-8000-000000000002';
const PROFISSIONAL_ID = '10000000-0000-4000-8000-000000000003';
const OUTRO_PROFISSIONAL_ID = '10000000-0000-4000-8000-000000000004';
const RECEITA_ID = '10000000-0000-4000-8000-000000000005';
const ALIMENTO_ID = '10000000-0000-4000-8000-000000000006';
const FONTE_ID = '10000000-0000-4000-8000-000000000007';

function usuarioProfissional(): UsuarioAutenticado {
  return {
    usuarioId: USUARIO_ID,
    tenantId: TENANT_ID,
    papel: 'Professional',
    emailHash: 'hash',
    permissoes: ['planos_alimentares.ler', 'planos_alimentares.gerenciar']
  };
}

function itensExemplo() {
  return [{ alimentoComposicaoId: ALIMENTO_ID, quantidade: 1, unidade: 'porcao', porcaoGramas: 50, substituicoes: [] }];
}

interface RepositorioMemoria {
  registros: any[];
  find: jest.Mock;
  findAndCount: jest.Mock;
  findOne: jest.Mock;
  save: jest.Mock;
  create: jest.Mock;
}

function filtrar(registros: any[], opcoes: any): any[] {
  const condicoes = Array.isArray(opcoes.where) ? opcoes.where : [opcoes.where].filter(Boolean);
  if (!condicoes.length) return [...registros];
  return registros.filter((registro) => condicoes.some((condicao: any) => Object.entries(condicao).every(([chave, valor]) => {
    if (valor && typeof valor === 'object' && '_type' in (valor as any)) {
      const operador = valor as any;
      if (operador._type === 'isNull') return registro[chave] === undefined || registro[chave] === null;
      if (operador._type === 'in') return operador._value.includes(registro[chave]);
    }
    return registro[chave] === valor;
  })));
}

function criarRepositorio(iniciais: any[] = []): RepositorioMemoria {
  const repositorio: RepositorioMemoria = {
    registros: [...iniciais],
    find: jest.fn(async (opcoes: any = {}) => filtrar(repositorio.registros, opcoes)),
    findAndCount: jest.fn(async (opcoes: any = {}) => {
      const encontrados = filtrar(repositorio.registros, opcoes);
      return [encontrados.slice(opcoes.skip ?? 0, (opcoes.skip ?? 0) + (opcoes.take ?? encontrados.length)), encontrados.length];
    }),
    findOne: jest.fn(async (opcoes: any = {}) => filtrar(repositorio.registros, opcoes)[0] ?? null),
    save: jest.fn(async (registro: any) => {
      const existente = repositorio.registros.find((item) => item.id === registro.id);
      if (existente) Object.assign(existente, registro);
      else repositorio.registros.push({ ...registro, id: registro.id ?? RECEITA_ID, atualizadoEm: new Date() });
      return registro;
    }),
    create: jest.fn((dados: any) => ({ ...dados }))
  };
  return repositorio;
}

describe('ServicoReceitasNutricionais', () => {
  let criptografia: CriptografiaDadosSensiveis;
  let repositorios: Map<Function, RepositorioMemoria>;
  let servico: ServicoReceitasNutricionais;

  beforeEach(() => {
    criptografia = new CriptografiaDadosSensiveis();
    repositorios = new Map();
    repositorios.set(ProfissionalOrm, criarRepositorio([{ id: PROFISSIONAL_ID, tenantId: TENANT_ID, usuarioId: USUARIO_ID }]));
    repositorios.set(ReceitaNutricionalOrm, criarRepositorio());
    repositorios.set(AlimentoComposicaoOrm, criarRepositorio([{ id: ALIMENTO_ID, fonteId: FONTE_ID }]));
    repositorios.set(FonteComposicaoAlimentoOrm, criarRepositorio([{ id: FONTE_ID, situacao: 'ativa' }]));
    repositorios.set(UserActionLogOrm, criarRepositorio());
    const gerenciador = { getRepository: jest.fn((entidade: Function) => repositorios.get(entidade)) } as unknown as EntityManager;
    const executor = { executar: jest.fn(async (_tenant: string, operacao: (manager: EntityManager) => Promise<unknown>) => operacao(gerenciador)) };
    servico = new ServicoReceitasNutricionais(executor as unknown as ExecutorTenant, criptografia);
  });

  function receitaPessoalDeOutro() {
    repositorios.get(ReceitaNutricionalOrm)!.registros.push({
      id: RECEITA_ID,
      tenantId: TENANT_ID,
      origem: 'pessoal',
      tipo: 'receita',
      profissionalId: OUTRO_PROFISSIONAL_ID,
      nomeCriptografado: criptografia.criptografar('Receita do colega'),
      conteudoCriptografado: criptografia.criptografar(JSON.stringify({ itens: itensExemplo() })),
      totalItens: 1,
      criadoPorUsuarioId: USUARIO_ID,
      atualizadoEm: new Date()
    });
  }

  it('cifra conteudo, vincula receita pessoal e registra auditoria', async () => {
    await servico.criar(TENANT_ID, usuarioProfissional(), { nome: 'Cafe rapido', origem: 'pessoal', tipo: 'receita', itens: itensExemplo() as never });
    const salvo = repositorios.get(ReceitaNutricionalOrm)!.save.mock.calls[0][0];
    expect(criptografia.descriptografar(salvo.nomeCriptografado)).toBe('Cafe rapido');
    expect(JSON.parse(criptografia.descriptografar(salvo.conteudoCriptografado)).itens).toHaveLength(1);
    expect(salvo.profissionalId).toBe(PROFISSIONAL_ID);
    expect(repositorios.get(UserActionLogOrm)!.save).toHaveBeenCalled();
  });

  it('lista somente receitas pessoais do dono e as da clinica', async () => {
    receitaPessoalDeOutro();
    await servico.listar(TENANT_ID, usuarioProfissional(), { pagina: 1, limite: 10 });
    const consulta = repositorios.get(ReceitaNutricionalOrm)!.findAndCount.mock.calls[0][0];
    expect(consulta.where).toEqual([
      expect.objectContaining({ tenantId: TENANT_ID, origem: 'clinica' }),
      expect.objectContaining({ tenantId: TENANT_ID, origem: 'pessoal', profissionalId: PROFISSIONAL_ID })
    ]);
  });

  it('nega obter ou editar uma receita pessoal de outro profissional sem enumerar o recurso', async () => {
    receitaPessoalDeOutro();
    await expect(servico.obter(TENANT_ID, RECEITA_ID, usuarioProfissional())).rejects.toBeInstanceOf(NotFoundException);
    await expect(servico.atualizar(TENANT_ID, RECEITA_ID, usuarioProfissional(), {
      nome: 'Alterar', origem: 'pessoal', tipo: 'receita', itens: itensExemplo() as never
    })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('atualiza snapshot e arquiva sem tocar plano publicado', async () => {
    await servico.criar(TENANT_ID, usuarioProfissional(), { nome: 'Antes', origem: 'clinica', tipo: 'receita', itens: itensExemplo() as never });
    await servico.atualizar(TENANT_ID, RECEITA_ID, usuarioProfissional(), {
      nome: 'Depois', origem: 'clinica', tipo: 'refeicao_pronta', instrucoes: 'Misture.', itens: itensExemplo() as never
    });
    const atual = repositorios.get(ReceitaNutricionalOrm)!.registros[0];
    expect(criptografia.descriptografar(atual.nomeCriptografado)).toBe('Depois');
    expect(atual.tipo).toBe('refeicao_pronta');
    await servico.arquivar(TENANT_ID, RECEITA_ID, usuarioProfissional());
    expect(atual.arquivadoEm).toBeInstanceOf(Date);
  });

  it('avisa item cuja fonte saiu do catalogo antes de aplicar', async () => {
    repositorios.get(FonteComposicaoAlimentoOrm)!.registros[0].situacao = 'suspensa';
    await servico.criar(TENANT_ID, usuarioProfissional(), { nome: 'Cafe', origem: 'clinica', tipo: 'receita', itens: itensExemplo() as never });
    const receita = await servico.obter(TENANT_ID, RECEITA_ID, usuarioProfissional());
    expect(receita.alimentosIndisponiveis).toEqual([ALIMENTO_ID]);
  });

  it('exige permissao de gerenciar para escrita', async () => {
    const usuario = { ...usuarioProfissional(), permissoes: ['planos_alimentares.ler' as const] };
    await expect(servico.criar(TENANT_ID, usuario, { nome: 'X', origem: 'pessoal', tipo: 'receita', itens: itensExemplo() as never })).rejects.toBeInstanceOf(ForbiddenException);
  });
});
