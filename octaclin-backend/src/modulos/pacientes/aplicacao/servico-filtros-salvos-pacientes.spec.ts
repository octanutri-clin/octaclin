import { ForbiddenException } from '@nestjs/common';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { ServicoFiltrosSalvosPacientes } from './servico-filtros-salvos-pacientes';

const TENANT_ID = '10000000-0000-4000-8000-000000000001';
const USUARIO_ID = '10000000-0000-4000-8000-000000000002';
const PROFISSIONAL_ID = '10000000-0000-4000-8000-000000000003';

function profissional(): UsuarioAutenticado {
  return {
    usuarioId: USUARIO_ID,
    tenantId: TENANT_ID,
    papel: 'Professional',
    emailHash: 'hash',
    permissoes: ['pacientes.listar', 'pacientes.ler', 'pacientes.gerenciar']
  };
}

function colaborador(): UsuarioAutenticado {
  return { ...profissional(), papel: 'Collaborator', permissoes: ['pacientes.listar', 'pacientes.ler'] };
}

describe('ServicoFiltrosSalvosPacientes.criar', () => {
  it('cifra o nome e guarda somente criterio estruturado', async () => {
    const { servico, repositorio, criptografia } = montar();
    const resumo = await servico.criar(TENANT_ID, profissional(), {
      nome: 'Risco alto sem retorno',
      origem: 'pessoal',
      criterios: { risco: 'alto', semProximaConsulta: true }
    });

    const salvo = repositorio.registros[0];
    expect(Buffer.isBuffer(salvo.nomeCriptografado)).toBe(true);
    expect(criptografia.descriptografar(salvo.nomeCriptografado)).toBe('Risco alto sem retorno');
    expect(salvo.criterios).toEqual({ risco: 'alto', semProximaConsulta: true });
    expect(resumo.nome).toBe('Risco alto sem retorno');
  });

  it('rejeita o texto da busca livre', async () => {
    const { servico } = montar();
    await expect(servico.criar(TENANT_ID, profissional(), {
      nome: 'Maria', origem: 'pessoal', criterios: { busca: 'Maria' } as never
    })).rejects.toThrow('Criterio nao suportado em filtro salvo: busca.');
  });

  it('exige pacientes.gerenciar para filtro de clinica', async () => {
    const { servico } = montar();
    await expect(servico.criar(TENANT_ID, colaborador(), {
      nome: 'Da clinica', origem: 'clinica', criterios: {}
    })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('filtro pessoal exige profissional vinculado e clinica exige nulo', async () => {
    const { servico, repositorio } = montar();
    await servico.criar(TENANT_ID, profissional(), { nome: 'Minha', origem: 'pessoal', criterios: {} });
    await servico.criar(TENANT_ID, profissional(), { nome: 'Nossa', origem: 'clinica', criterios: {} });
    expect(repositorio.registros[0].profissionalId).toBe(PROFISSIONAL_ID);
    expect(repositorio.registros[1].profissionalId).toBeUndefined();
  });

  it('barra ao atingir o teto de filtros ativos', async () => {
    const { servico, repositorio } = montar();
    repositorio.registros = Array.from({ length: 20 }, (_, indice) => ({
      id: `id-${indice}`, tenantId: TENANT_ID, origem: 'pessoal',
      profissionalId: PROFISSIONAL_ID, arquivadoEm: null
    }));
    await expect(servico.criar(TENANT_ID, profissional(), {
      nome: 'Excedente', origem: 'pessoal', criterios: {}
    })).rejects.toThrow('Limite de 20 filtros salvos atingido.');
  });

  it('filtro arquivado nao conta para o teto', async () => {
    const { servico, repositorio } = montar();
    repositorio.registros = Array.from({ length: 20 }, (_, indice) => ({
      id: `id-${indice}`, tenantId: TENANT_ID, origem: 'pessoal',
      profissionalId: PROFISSIONAL_ID, arquivadoEm: new Date()
    }));
    await expect(servico.criar(TENANT_ID, profissional(), {
      nome: 'Cabe', origem: 'pessoal', criterios: {}
    })).resolves.toBeDefined();
  });
});

/** Casa a condicao do TypeORM; IsNull() chega como objeto com _type 'isNull'. */
function casa(registro: any, condicao: any): boolean {
  return Object.entries(condicao).every(([chave, valor]: [string, any]) => {
    if (valor && typeof valor === 'object' && valor._type === 'isNull') {
      return registro[chave] === undefined || registro[chave] === null;
    }
    return registro[chave] === valor;
  });
}

function criarRepositorio(iniciais: any[] = []) {
  type Registro = any;
  const repositorio: {
    registros: Registro[];
    find: jest.Mock<Promise<Registro[]>>;
    findOne: jest.Mock<Promise<Registro | null>>;
    count: jest.Mock<Promise<number>>;
    create: jest.Mock<Registro>;
    save: jest.Mock<Promise<Registro>>;
  } = {
    registros: [...iniciais] as any[],
    find: jest.fn(async (opcoes: any = {}): Promise<Registro[]> => {
      const condicoes = Array.isArray(opcoes.where) ? opcoes.where : [opcoes.where].filter(Boolean);
      if (!condicoes.length) return [...repositorio.registros];
      return repositorio.registros.filter((registro: Registro) =>
        condicoes.some((condicao: any) => casa(registro, condicao)));
    }),
    findOne: jest.fn(async (opcoes: any): Promise<Registro | null> =>
      repositorio.registros.find((registro: Registro) => registro.id === opcoes.where.id) ?? null),
    count: jest.fn(async (opcoes: any): Promise<number> => repositorio.registros.filter((registro: Registro) =>
      registro.origem === opcoes.where.origem
      && (opcoes.where.profissionalId === undefined || registro.profissionalId === opcoes.where.profissionalId)
      && !registro.arquivadoEm).length),
    create: jest.fn((dados: any): Registro => ({ id: `filtro-${repositorio.registros.length}`, atualizadoEm: new Date(), ...dados })),
    save: jest.fn(async (registro: any): Promise<Registro> => {
      const indice = repositorio.registros.findIndex((existente: Registro) => existente.id === registro.id);
      if (indice >= 0) repositorio.registros[indice] = registro;
      else repositorio.registros.push(registro);
      return registro;
    })
  };
  return repositorio;
}

function montar() {
  const criptografia = new CriptografiaDadosSensiveis();
  const repositorio = criarRepositorio();
  const profissionais = {
    findOne: jest.fn(async () => ({
      id: PROFISSIONAL_ID, tenantId: TENANT_ID, usuarioId: USUARIO_ID, arquivadoEm: null
    }))
  };
  const gerenciador = {
    getRepository: (entidade: any) => (entidade.name === 'ProfissionalOrm' ? profissionais : repositorio)
  };
  const executorTenant = {
    executar: async (_tenantId: string, operacao: any) => operacao(gerenciador)
  } as unknown as ExecutorTenant;

  return {
    servico: new ServicoFiltrosSalvosPacientes(executorTenant, criptografia),
    repositorio,
    criptografia
  };
}
