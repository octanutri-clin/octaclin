import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { UserActionLogOrm } from '../../../infraestrutura/auditoria/user-action-log.orm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { BibliotecaCondutaOrm } from '../infraestrutura/biblioteca-conduta.orm';
import { ServicoBibliotecaCondutas } from './servico-biblioteca-condutas';

const TENANT_ID = '10000000-0000-4000-8000-000000000001';
const USUARIO_ID = '10000000-0000-4000-8000-000000000002';
const OUTRO_TENANT_ID = '20000000-0000-4000-8000-000000000001';
const ITEM_ID = '10000000-0000-4000-8000-000000000005';

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
  findAndCount: jest.Mock;
  findOne: jest.Mock;
  save: jest.Mock;
  create: jest.Mock;
}

function criarRepositorio(iniciais: any[] = []): RepositorioMemoria {
  const repositorio: RepositorioMemoria = {
    registros: [...iniciais],
    findAndCount: jest.fn(async (opcoes: any = {}) => {
      const encontrados = filtrar(repositorio.registros, opcoes);
      const pagina = encontrados.slice(opcoes.skip ?? 0, (opcoes.skip ?? 0) + (opcoes.take ?? encontrados.length));
      return [pagina, encontrados.length];
    }),
    findOne: jest.fn(async (opcoes: any = {}) => filtrar(repositorio.registros, opcoes)[0] ?? null),
    save: jest.fn(async (registro: any) => {
      const existente = repositorio.registros.find((atual) => atual.id === registro.id);
      if (existente) Object.assign(existente, registro);
      else repositorio.registros.push({ ...registro, id: registro.id ?? ITEM_ID });
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
        }
        return registro[chave] === valor;
      })
    )
  );
}

describe('ServicoBibliotecaCondutas', () => {
  let criptografia: CriptografiaDadosSensiveis;
  let repositorio: RepositorioMemoria;
  let auditLog: RepositorioMemoria;
  let servico: ServicoBibliotecaCondutas;

  beforeEach(() => {
    criptografia = new CriptografiaDadosSensiveis();
    repositorio = criarRepositorio();
    repositorio.registros.push({
      id: ITEM_ID,
      tenantId: OUTRO_TENANT_ID,
      tipo: 'orientacao',
      nomeCriptografado: criptografia.criptografar('Item de outro tenant'),
      conteudoCriptografado: criptografia.criptografar('Conteudo de outro tenant'),
      tamanhoConteudo: 20,
      criadoPorUsuarioId: USUARIO_ID,
      arquivadoEm: undefined
    });
    auditLog = criarRepositorio();
    const gerenciador = {
      getRepository: jest.fn((entidade: Function) =>
        entidade === BibliotecaCondutaOrm ? repositorio : auditLog
      )
    } as unknown as EntityManager;
    const executor = {
      executar: jest.fn(async (_tenantId: string, operacao: (manager: EntityManager) => Promise<unknown>) =>
        operacao(gerenciador)
      )
    };
    servico = new ServicoBibliotecaCondutas(executor as unknown as ExecutorTenant, criptografia);
  });

  describe('criar', () => {
    it('guarda nome e conteudo criptografados e conta o tamanho', async () => {
      await servico.criar(TENANT_ID, usuarioProfissional(), {
        nome: 'Orientacao pos-consulta padrao',
        tipo: 'orientacao',
        conteudo: 'Manter hidratacao e retornar em 30 dias.'
      });
      const salvo = repositorio.save.mock.calls[0][0];
      expect(criptografia.descriptografar(salvo.nomeCriptografado)).toBe('Orientacao pos-consulta padrao');
      expect(criptografia.descriptografar(salvo.conteudoCriptografado)).toBe(
        'Manter hidratacao e retornar em 30 dias.'
      );
      expect(salvo.tamanhoConteudo).toBe('Manter hidratacao e retornar em 30 dias.'.length);
      expect(salvo.tenantId).toBe(TENANT_ID);
      // Nome e conteudo sao dado clinico: nunca em claro.
      expect(salvo.nome).toBeUndefined();
      expect(salvo.conteudo).toBeUndefined();
    });

    it('exige permissao de gerenciar', async () => {
      const usuario = { ...usuarioProfissional(), permissoes: ['pacientes.ler' as const] };
      await expect(
        servico.criar(TENANT_ID, usuario, { nome: 'X', tipo: 'meta', conteudo: 'Conteudo minimo' })
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('exige papel profissional ou superadmin', async () => {
      const usuario = { ...usuarioProfissional(), papel: 'Collaborator' as const };
      await expect(
        servico.criar(TENANT_ID, usuario, { nome: 'X', tipo: 'meta', conteudo: 'Conteudo minimo' })
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('registra auditoria da criacao', async () => {
      await servico.criar(TENANT_ID, usuarioProfissional(), {
        nome: 'Item novo',
        tipo: 'meta',
        conteudo: 'Conteudo minimo'
      });
      expect(auditLog.save).toHaveBeenCalled();
    });
  });

  describe('listar', () => {
    it('pagina e devolve resumo sem descriptografar o conteudo', async () => {
      await servico.criar(TENANT_ID, usuarioProfissional(), {
        nome: 'Item do tenant',
        tipo: 'suplemento',
        conteudo: 'Conteudo do item'
      });
      const pagina = await servico.listar(TENANT_ID, usuarioProfissional(), { pagina: 1, limite: 10 });
      expect(pagina.total).toBe(1);
      expect(pagina.itens[0]).toEqual(
        expect.objectContaining({ nome: 'Item do tenant', tipo: 'suplemento' })
      );
      expect(pagina.itens[0]).not.toHaveProperty('conteudo');
    });

    it('nunca lista item de outro tenant', async () => {
      const pagina = await servico.listar(TENANT_ID, usuarioProfissional(), { pagina: 1, limite: 10 });
      expect(pagina.total).toBe(0);
      expect(pagina.itens).toEqual([]);
    });

    it('filtra por tipo', async () => {
      await servico.criar(TENANT_ID, usuarioProfissional(), { nome: 'Meta 1', tipo: 'meta', conteudo: 'Conteudo A' });
      await servico.criar(TENANT_ID, usuarioProfissional(), {
        nome: 'Orientacao 1',
        tipo: 'orientacao',
        conteudo: 'Conteudo B'
      });
      const pagina = await servico.listar(TENANT_ID, usuarioProfissional(), { pagina: 1, limite: 10, tipo: 'meta' });
      expect(pagina.total).toBe(1);
      expect(pagina.itens[0].nome).toBe('Meta 1');
    });
  });

  describe('obter', () => {
    it('devolve nome/tipo/conteudo para pre-preencher o formulario', async () => {
      await servico.criar(TENANT_ID, usuarioProfissional(), {
        nome: 'Item do tenant',
        tipo: 'produto',
        conteudo: 'Conteudo do item'
      });
      const item = await servico.obter(TENANT_ID, ITEM_ID, usuarioProfissional());
      expect(item).toEqual(
        expect.objectContaining({ nome: 'Item do tenant', tipo: 'produto', conteudo: 'Conteudo do item' })
      );
    });

    it('nao encontra item de outro tenant', async () => {
      await expect(servico.obter(TENANT_ID, ITEM_ID, usuarioProfissional())).rejects.toBeInstanceOf(
        NotFoundException
      );
    });
  });

  describe('arquivar', () => {
    it('marca a data de arquivamento e some da listagem', async () => {
      await servico.criar(TENANT_ID, usuarioProfissional(), {
        nome: 'Item do tenant',
        tipo: 'meta',
        conteudo: 'Conteudo do item'
      });
      await servico.arquivar(TENANT_ID, ITEM_ID, usuarioProfissional());
      expect(repositorio.registros.find((registro) => registro.id === ITEM_ID)!.arquivadoEm).toBeInstanceOf(Date);
      const pagina = await servico.listar(TENANT_ID, usuarioProfissional(), { pagina: 1, limite: 10 });
      expect(pagina.total).toBe(0);
    });

    it('nao arquiva item de outro tenant', async () => {
      await expect(servico.arquivar(TENANT_ID, ITEM_ID, usuarioProfissional())).rejects.toBeInstanceOf(
        NotFoundException
      );
    });
  });
});
