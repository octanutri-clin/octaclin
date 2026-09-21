import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { UserActionLogOrm } from '../../../infraestrutura/auditoria/user-action-log.orm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { ProfissionalOrm } from '../../profissionais/infraestrutura/profissional.orm';
import { ModeloEvolucaoClinicaOrm } from '../infraestrutura/modelo-evolucao-clinica.orm';
import { ServicoModelosEvolucaoClinica } from './servico-modelos-evolucao-clinica';

const TENANT_ID = '10000000-0000-4000-8000-000000000001';
const USUARIO_ID = '10000000-0000-4000-8000-000000000002';
const PROFISSIONAL_ID = '10000000-0000-4000-8000-000000000003';
const OUTRO_PROFISSIONAL_ID = '10000000-0000-4000-8000-000000000004';
const MODELO_ID = '10000000-0000-4000-8000-000000000005';

function usuarioProfissional(): UsuarioAutenticado {
  return {
    usuarioId: USUARIO_ID,
    tenantId: TENANT_ID,
    papel: 'Professional',
    emailHash: 'hash',
    permissoes: ['pacientes.ler', 'pacientes.gerenciar']
  };
}

interface RepositorioMemoria {
  registros: any[];
  find: jest.Mock;
  findAndCount: jest.Mock;
  findOne: jest.Mock;
  save: jest.Mock;
  create: jest.Mock;
}

function criarRepositorio(iniciais: any[] = []): RepositorioMemoria {
  const repositorio: RepositorioMemoria = {
    registros: [...iniciais],
    find: jest.fn(async (opcoes: any = {}) => filtrar(repositorio.registros, opcoes)),
    findAndCount: jest.fn(async (opcoes: any = {}) => {
      const encontrados = filtrar(repositorio.registros, opcoes);
      const pagina = encontrados.slice(opcoes.skip ?? 0, (opcoes.skip ?? 0) + (opcoes.take ?? encontrados.length));
      return [pagina, encontrados.length];
    }),
    findOne: jest.fn(async (opcoes: any = {}) => filtrar(repositorio.registros, opcoes)[0] ?? null),
    save: jest.fn(async (registro: any) => {
      const existente = repositorio.registros.find((atual) => atual.id === registro.id);
      if (existente) Object.assign(existente, registro);
      else repositorio.registros.push({ ...registro, id: registro.id ?? MODELO_ID });
      return registro;
    }),
    create: jest.fn((dados: any) => ({ ...dados }))
  };
  return repositorio;
}

function filtrar(registros: any[], opcoes: any): any[] {
  const condicoes = Array.isArray(opcoes.where) ? opcoes.where : [opcoes.where].filter(Boolean);
  if (!condicoes.length) return [...registros];
  return registros.filter((registro) =>
    condicoes.some((condicao: any) =>
      Object.entries(condicao).every(([chave, valor]) => {
        if (valor && typeof valor === 'object' && '_type' in (valor as any)) {
          const operador = valor as any;
          if (operador._type === 'isNull') return registro[chave] === undefined || registro[chave] === null;
          if (operador._type === 'in') return operador._value.includes(registro[chave]);
        }
        return registro[chave] === valor;
      })
    )
  );
}

describe('ServicoModelosEvolucaoClinica', () => {
  let criptografia: CriptografiaDadosSensiveis;
  let repositorios: Map<Function, RepositorioMemoria>;
  let servico: ServicoModelosEvolucaoClinica;

  beforeEach(() => {
    criptografia = new CriptografiaDadosSensiveis();
    repositorios = new Map<Function, RepositorioMemoria>();
    repositorios.set(
      ProfissionalOrm,
      criarRepositorio([{ id: PROFISSIONAL_ID, tenantId: TENANT_ID, usuarioId: USUARIO_ID, arquivadoEm: undefined }])
    );
    repositorios.set(ModeloEvolucaoClinicaOrm, criarRepositorio());
    repositorios.set(UserActionLogOrm, criarRepositorio());
    const gerenciador = {
      getRepository: jest.fn((entidade: Function) => repositorios.get(entidade))
    } as unknown as EntityManager;
    const executor = {
      executar: jest.fn(async (_tenantId: string, operacao: (manager: EntityManager) => Promise<unknown>) =>
        operacao(gerenciador)
      )
    };
    servico = new ServicoModelosEvolucaoClinica(executor as unknown as ExecutorTenant, criptografia);
  });

  function modeloPessoalDeOutro() {
    repositorios.get(ModeloEvolucaoClinicaOrm)!.registros.push({
      id: MODELO_ID,
      tenantId: TENANT_ID,
      origem: 'pessoal',
      profissionalId: OUTRO_PROFISSIONAL_ID,
      nomeCriptografado: criptografia.criptografar('Modelo do colega'),
      tipo: 'retorno',
      conteudoCriptografado: criptografia.criptografar('Peso: __ kg'),
      tamanhoConteudo: 12,
      criadoPorUsuarioId: OUTRO_PROFISSIONAL_ID,
      arquivadoEm: undefined
    });
  }

  describe('criar', () => {
    it('guarda nome e conteudo criptografados e conta o tamanho', async () => {
      await servico.criar(TENANT_ID, usuarioProfissional(), {
        nome: 'Retorno padrao',
        origem: 'pessoal',
        tipo: 'retorno',
        conteudo: 'Peso: __ kg. IMC: __.'
      });
      const salvo = repositorios.get(ModeloEvolucaoClinicaOrm)!.save.mock.calls[0][0];
      expect(criptografia.descriptografar(salvo.nomeCriptografado)).toBe('Retorno padrao');
      expect(criptografia.descriptografar(salvo.conteudoCriptografado)).toBe('Peso: __ kg. IMC: __.');
      expect(salvo.tamanhoConteudo).toBe('Peso: __ kg. IMC: __.'.length);
      // Nome e conteudo sao dado clinico do profissional: nunca em claro.
      expect(salvo.nome).toBeUndefined();
      expect(salvo.conteudo).toBeUndefined();
    });

    it('vincula modelo pessoal ao profissional do usuario', async () => {
      await servico.criar(TENANT_ID, usuarioProfissional(), {
        nome: 'Meu modelo',
        origem: 'pessoal',
        conteudo: 'Texto padrao'
      });
      expect(repositorios.get(ModeloEvolucaoClinicaOrm)!.save.mock.calls[0][0].profissionalId).toBe(
        PROFISSIONAL_ID
      );
    });

    // Modelo da clinica preso a um profissional deixaria de ser compartilhado
    // no dia em que esse profissional fosse desligado.
    it('nao vincula profissional em modelo da clinica', async () => {
      await servico.criar(TENANT_ID, usuarioProfissional(), {
        nome: 'Modelo da casa',
        origem: 'clinica',
        conteudo: 'Texto padrao'
      });
      expect(repositorios.get(ModeloEvolucaoClinicaOrm)!.save.mock.calls[0][0].profissionalId).toBeUndefined();
    });

    it('usa observacao como tipo default, igual a evolucao em si', async () => {
      await servico.criar(TENANT_ID, usuarioProfissional(), {
        nome: 'Modelo sem tipo',
        origem: 'clinica',
        conteudo: 'Texto padrao'
      });
      expect(repositorios.get(ModeloEvolucaoClinicaOrm)!.save.mock.calls[0][0].tipo).toBe('observacao');
    });

    it('exige permissao de gerenciar', async () => {
      const usuario = { ...usuarioProfissional(), permissoes: ['pacientes.ler' as const] };
      await expect(
        servico.criar(TENANT_ID, usuario, { nome: 'X', origem: 'pessoal', conteudo: 'Texto padrao' })
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('registra auditoria da criacao', async () => {
      await servico.criar(TENANT_ID, usuarioProfissional(), {
        nome: 'Modelo da casa',
        origem: 'clinica',
        conteudo: 'Texto padrao'
      });
      expect(repositorios.get(UserActionLogOrm)!.save).toHaveBeenCalled();
    });
  });

  describe('listar', () => {
    it('pagina e devolve resumo sem descriptografar o conteudo', async () => {
      await servico.criar(TENANT_ID, usuarioProfissional(), {
        nome: 'Modelo da casa',
        origem: 'clinica',
        tipo: 'consulta',
        conteudo: 'Texto padrao'
      });
      const pagina = await servico.listar(TENANT_ID, usuarioProfissional(), { pagina: 1, limite: 10 });
      expect(pagina).toEqual(expect.objectContaining({ total: 1, pagina: 1, limite: 10 }));
      expect(pagina.itens[0]).toEqual(
        expect.objectContaining({ nome: 'Modelo da casa', origem: 'clinica', tipo: 'consulta' })
      );
      expect(pagina.itens[0]).not.toHaveProperty('conteudo');
    });

    // Filtro no banco, e nao depois de buscar: pos-filtrar deixaria o `total`
    // da paginacao contando modelos que o profissional nao pode ver.
    it('restringe modelo pessoal ao dono ja na consulta', async () => {
      await servico.listar(TENANT_ID, usuarioProfissional(), { pagina: 1, limite: 10 });
      const consulta = repositorios.get(ModeloEvolucaoClinicaOrm)!.findAndCount.mock.calls[0][0];
      expect(consulta.where).toEqual([
        expect.objectContaining({ tenantId: TENANT_ID, origem: 'clinica' }),
        expect.objectContaining({ tenantId: TENANT_ID, origem: 'pessoal', profissionalId: PROFISSIONAL_ID })
      ]);
    });

    it('nao lista modelo pessoal de outro profissional', async () => {
      modeloPessoalDeOutro();
      const pagina = await servico.listar(TENANT_ID, usuarioProfissional(), { pagina: 1, limite: 10 });
      expect(pagina.total).toBe(0);
      expect(pagina.itens).toEqual([]);
    });
  });

  describe('obter', () => {
    it('devolve tipo e conteudo para pre-preencher o formulario', async () => {
      await servico.criar(TENANT_ID, usuarioProfissional(), {
        nome: 'Modelo da casa',
        origem: 'clinica',
        tipo: 'retorno',
        conteudo: 'Peso: __ kg'
      });
      const modelo = await servico.obter(TENANT_ID, MODELO_ID, usuarioProfissional());
      expect(modelo).toEqual(
        expect.objectContaining({ nome: 'Modelo da casa', origem: 'clinica', tipo: 'retorno', conteudo: 'Peso: __ kg' })
      );
    });

    it('nega modelo pessoal de outro profissional', async () => {
      modeloPessoalDeOutro();
      await expect(servico.obter(TENANT_ID, MODELO_ID, usuarioProfissional())).rejects.toBeInstanceOf(
        NotFoundException
      );
    });
  });

  describe('arquivar', () => {
    it('marca a data de arquivamento', async () => {
      await servico.criar(TENANT_ID, usuarioProfissional(), {
        nome: 'Modelo da casa',
        origem: 'clinica',
        conteudo: 'Texto padrao'
      });
      await servico.arquivar(TENANT_ID, MODELO_ID, usuarioProfissional());
      expect(repositorios.get(ModeloEvolucaoClinicaOrm)!.registros[0].arquivadoEm).toBeInstanceOf(Date);
    });

    it('nega arquivar modelo pessoal de outro profissional', async () => {
      modeloPessoalDeOutro();
      await expect(servico.arquivar(TENANT_ID, MODELO_ID, usuarioProfissional())).rejects.toBeInstanceOf(
        NotFoundException
      );
    });
  });
});
