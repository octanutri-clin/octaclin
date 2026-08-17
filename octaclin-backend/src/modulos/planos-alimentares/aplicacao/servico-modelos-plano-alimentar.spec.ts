import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { UserActionLogOrm } from '../../../infraestrutura/auditoria/user-action-log.orm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { ProfissionalOrm } from '../../profissionais/infraestrutura/profissional.orm';
import { AlimentoComposicaoOrm } from '../infraestrutura/alimento-composicao.orm';
import { FonteComposicaoAlimentoOrm } from '../infraestrutura/fonte-composicao-alimento.orm';
import { ModeloPlanoAlimentarOrm } from '../infraestrutura/modelo-plano-alimentar.orm';
import { ServicoModelosPlanoAlimentar } from './servico-modelos-plano-alimentar';

const TENANT_ID = '10000000-0000-4000-8000-000000000001';
const USUARIO_ID = '10000000-0000-4000-8000-000000000002';
const PROFISSIONAL_ID = '10000000-0000-4000-8000-000000000003';
const OUTRO_PROFISSIONAL_ID = '10000000-0000-4000-8000-000000000004';
const MODELO_ID = '10000000-0000-4000-8000-000000000005';
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

function refeicoesExemplo() {
  return [
    {
      nome: 'Cafe da manha',
      itens: [
        {
          alimentoComposicaoId: ALIMENTO_ID,
          quantidade: 1,
          unidade: 'porcao',
          porcaoGramas: 50,
          substituicoes: []
        }
      ]
    }
  ];
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

describe('ServicoModelosPlanoAlimentar', () => {
  let criptografia: CriptografiaDadosSensiveis;
  let repositorios: Map<Function, RepositorioMemoria>;
  let servico: ServicoModelosPlanoAlimentar;

  beforeEach(() => {
    criptografia = new CriptografiaDadosSensiveis();
    repositorios = new Map<Function, RepositorioMemoria>();
    repositorios.set(ProfissionalOrm, criarRepositorio([
      { id: PROFISSIONAL_ID, tenantId: TENANT_ID, usuarioId: USUARIO_ID, arquivadoEm: undefined }
    ]));
    repositorios.set(ModeloPlanoAlimentarOrm, criarRepositorio());
    repositorios.set(AlimentoComposicaoOrm, criarRepositorio([
      { id: ALIMENTO_ID, fonteId: FONTE_ID, nome: 'Pao frances' }
    ]));
    repositorios.set(FonteComposicaoAlimentoOrm, criarRepositorio([
      { id: FONTE_ID, situacao: 'ativa', codigo: 'TACO', nome: 'TACO', versao: '4a' }
    ]));
    repositorios.set(UserActionLogOrm, criarRepositorio());
    const gerenciador = {
      getRepository: jest.fn((entidade: Function) => repositorios.get(entidade))
    } as unknown as EntityManager;
    const executor = {
      executar: jest.fn(async (_tenantId: string, operacao: (manager: EntityManager) => Promise<unknown>) =>
        operacao(gerenciador)
      )
    };
    servico = new ServicoModelosPlanoAlimentar(executor as unknown as ExecutorTenant, criptografia);
  });

  function modeloPessoalDeOutro() {
    repositorios.get(ModeloPlanoAlimentarOrm)!.registros.push({
      id: MODELO_ID,
      tenantId: TENANT_ID,
      origem: 'pessoal',
      profissionalId: OUTRO_PROFISSIONAL_ID,
      nomeCriptografado: criptografia.criptografar('Modelo do colega'),
      conteudoCriptografado: criptografia.criptografar(JSON.stringify(refeicoesExemplo())),
      totalRefeicoes: 1,
      totalItens: 1,
      criadoPorUsuarioId: USUARIO_ID,
      arquivadoEm: undefined
    });
  }

  describe('criar', () => {
    it('guarda nome e conteudo criptografados e conta a estrutura', async () => {
      await servico.criar(TENANT_ID, usuarioProfissional(), {
        nome: 'Plano padrao',
        origem: 'pessoal',
        refeicoes: refeicoesExemplo() as never
      });
      const salvo = repositorios.get(ModeloPlanoAlimentarOrm)!.save.mock.calls[0][0];
      expect(criptografia.descriptografar(salvo.nomeCriptografado)).toBe('Plano padrao');
      expect(salvo.totalRefeicoes).toBe(1);
      expect(salvo.totalItens).toBe(1);
      // Nome e conteudo sao dado clinico do profissional: nunca em claro.
      expect(salvo.nome).toBeUndefined();
    });

    it('vincula modelo pessoal ao profissional do usuario', async () => {
      await servico.criar(TENANT_ID, usuarioProfissional(), {
        nome: 'Meu modelo',
        origem: 'pessoal',
        refeicoes: refeicoesExemplo() as never
      });
      expect(repositorios.get(ModeloPlanoAlimentarOrm)!.save.mock.calls[0][0].profissionalId).toBe(PROFISSIONAL_ID);
    });

    // Modelo da clinica preso a um profissional deixaria de ser compartilhado no
    // dia em que esse profissional fosse desligado.
    it('nao vincula profissional em modelo da clinica', async () => {
      await servico.criar(TENANT_ID, usuarioProfissional(), {
        nome: 'Modelo da casa',
        origem: 'clinica',
        refeicoes: refeicoesExemplo() as never
      });
      expect(repositorios.get(ModeloPlanoAlimentarOrm)!.save.mock.calls[0][0].profissionalId).toBeUndefined();
    });

    it('exige permissao de gerenciar', async () => {
      const usuario = { ...usuarioProfissional(), permissoes: ['planos_alimentares.ler' as const] };
      await expect(
        servico.criar(TENANT_ID, usuario, { nome: 'X', origem: 'pessoal', refeicoes: refeicoesExemplo() as never })
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('registra auditoria da criacao', async () => {
      await servico.criar(TENANT_ID, usuarioProfissional(), {
        nome: 'Plano padrao',
        origem: 'clinica',
        refeicoes: refeicoesExemplo() as never
      });
      expect(repositorios.get(UserActionLogOrm)!.save).toHaveBeenCalled();
    });
  });

  describe('listar', () => {
    it('pagina e devolve resumo sem descriptografar o conteudo', async () => {
      await servico.criar(TENANT_ID, usuarioProfissional(), {
        nome: 'Plano padrao',
        origem: 'clinica',
        refeicoes: refeicoesExemplo() as never
      });
      const pagina = await servico.listar(TENANT_ID, usuarioProfissional(), { pagina: 1, limite: 10 });
      expect(pagina).toEqual(
        expect.objectContaining({ total: 1, pagina: 1, limite: 10 })
      );
      expect(pagina.itens[0]).toEqual(
        expect.objectContaining({ nome: 'Plano padrao', origem: 'clinica', totalRefeicoes: 1, totalItens: 1 })
      );
      expect(pagina.itens[0]).not.toHaveProperty('refeicoes');
    });

    // Filtro no banco, e nao depois de buscar: pos-filtrar deixaria o `total`
    // da paginacao contando modelos que o profissional nao pode ver.
    it('restringe modelo pessoal ao dono ja na consulta', async () => {
      await servico.listar(TENANT_ID, usuarioProfissional(), { pagina: 1, limite: 10 });
      const consulta = repositorios.get(ModeloPlanoAlimentarOrm)!.findAndCount.mock.calls[0][0];
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
    it('devolve as refeicoes para aplicar no rascunho', async () => {
      await servico.criar(TENANT_ID, usuarioProfissional(), {
        nome: 'Plano padrao',
        origem: 'clinica',
        refeicoes: refeicoesExemplo() as never
      });
      const modelo = await servico.obter(TENANT_ID, MODELO_ID, usuarioProfissional());
      expect(modelo.refeicoes[0].nome).toBe('Cafe da manha');
      expect(modelo.alimentosIndisponiveis).toEqual([]);
    });

    // Avisa antes de aplicar em vez de deixar o rascunho falhar depois com
    // "fonte nao esta ativa" sem dizer qual item.
    it('aponta alimento cuja fonte deixou de estar ativa', async () => {
      repositorios.get(FonteComposicaoAlimentoOrm)!.registros[0].situacao = 'suspensa';
      await servico.criar(TENANT_ID, usuarioProfissional(), {
        nome: 'Plano padrao',
        origem: 'clinica',
        refeicoes: refeicoesExemplo() as never
      });
      const modelo = await servico.obter(TENANT_ID, MODELO_ID, usuarioProfissional());
      expect(modelo.alimentosIndisponiveis).toEqual([ALIMENTO_ID]);
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
        nome: 'Plano padrao',
        origem: 'clinica',
        refeicoes: refeicoesExemplo() as never
      });
      await servico.arquivar(TENANT_ID, MODELO_ID, usuarioProfissional());
      expect(repositorios.get(ModeloPlanoAlimentarOrm)!.registros[0].arquivadoEm).toBeInstanceOf(Date);
    });

    it('nega arquivar modelo pessoal de outro profissional', async () => {
      modeloPessoalDeOutro();
      await expect(servico.arquivar(TENANT_ID, MODELO_ID, usuarioProfissional())).rejects.toBeInstanceOf(
        NotFoundException
      );
    });
  });
});
