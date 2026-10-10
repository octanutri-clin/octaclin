import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { UserActionLogOrm } from '../../../infraestrutura/auditoria/user-action-log.orm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { ProfissionalOrm } from '../../profissionais/infraestrutura/profissional.orm';
import { TenantConfiguracaoOrm } from '../../tenancy/infraestrutura/tenant-configuracao.orm';
import { AlimentoComposicaoOrm } from '../infraestrutura/alimento-composicao.orm';
import { FonteComposicaoAlimentoOrm } from '../infraestrutura/fonte-composicao-alimento.orm';
import { ModeloPlanoAlimentarOrm } from '../infraestrutura/modelo-plano-alimentar.orm';
import { RevisaoModeloPlanoAlimentarOrm } from '../infraestrutura/revisao-modelo-plano-alimentar.orm';
import { ServicoModelosPlanoAlimentar } from './servico-modelos-plano-alimentar';

const TENANT_ID = '10000000-0000-4000-8000-000000000001';
const OUTRO_TENANT_ID = '10000000-0000-4000-8000-000000000008';
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
  let proximoIdRevisao = 1;
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
      registro.id ??= registro.numero ? `revisao-${proximoIdRevisao++}` : MODELO_ID;
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
  let consultaSql: jest.Mock;
  let servico: ServicoModelosPlanoAlimentar;

  beforeEach(() => {
    criptografia = new CriptografiaDadosSensiveis();
    repositorios = new Map<Function, RepositorioMemoria>();
    repositorios.set(ProfissionalOrm, criarRepositorio([
      { id: PROFISSIONAL_ID, tenantId: TENANT_ID, usuarioId: USUARIO_ID, arquivadoEm: undefined }
    ]));
    repositorios.set(ModeloPlanoAlimentarOrm, criarRepositorio());
    repositorios.set(RevisaoModeloPlanoAlimentarOrm, criarRepositorio());
    repositorios.set(TenantConfiguracaoOrm, criarRepositorio());
    repositorios.set(AlimentoComposicaoOrm, criarRepositorio([
      { id: ALIMENTO_ID, fonteId: FONTE_ID, nome: 'Pao frances' }
    ]));
    repositorios.set(FonteComposicaoAlimentoOrm, criarRepositorio([
      { id: FONTE_ID, situacao: 'ativa', codigo: 'TACO', nome: 'TACO', versao: '4a' }
    ]));
    repositorios.set(UserActionLogOrm, criarRepositorio());
    const gerenciador = {
      getRepository: jest.fn((entidade: Function) => repositorios.get(entidade)),
      query: (consultaSql = jest.fn(async () => []))
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

  function modeloDeOutroTenant() {
    repositorios.get(ModeloPlanoAlimentarOrm)!.registros.push({
      id: MODELO_ID,
      tenantId: OUTRO_TENANT_ID,
      origem: 'clinica',
      nomeCriptografado: criptografia.criptografar('Modelo de outro tenant'),
      conteudoCriptografado: criptografia.criptografar(JSON.stringify(refeicoesExemplo())),
      totalRefeicoes: 1,
      totalItens: 1,
      versaoAtual: 1,
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
      expect(salvo.versaoAtual).toBe(1);
      expect(repositorios.get(RevisaoModeloPlanoAlimentarOrm)!.save).toHaveBeenCalledWith(
        expect.objectContaining({ numero: 1, tenantId: TENANT_ID, modeloId: MODELO_ID })
      );
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
    it('oferece estruturas vazias apenas ao tenant que recebeu o kit, sem contá-las como modelos', async () => {
      repositorios.get(TenantConfiguracaoOrm)!.registros.push({
        tenantId: TENANT_ID, chave: 'kit_inicial_clinica', valor: { versao: 1 }
      });
      const pagina = await servico.listar(TENANT_ID, usuarioProfissional());
      expect(pagina.total).toBe(0);
      expect(pagina.itens).toEqual([]);
      expect(pagina.estruturasIniciais.length).toBeGreaterThan(0);
      for (const estrutura of pagina.estruturasIniciais) {
        expect(estrutura.refeicoes.length).toBeGreaterThan(0);
        expect(estrutura.refeicoes.every((refeicao) => refeicao.itens.length === 0)).toBe(true);
        expect(JSON.stringify(estrutura)).not.toMatch(/alimentoComposicaoId|quantidade|porcaoGramas/);
      }
    });

    it('nao mostra estruturas a tenant antigo ou com marcador de outro tenant', async () => {
      repositorios.get(TenantConfiguracaoOrm)!.registros.push({
        tenantId: '20000000-0000-4000-8000-000000000001', chave: 'kit_inicial_clinica', valor: { versao: 1 }
      });
      expect((await servico.listar(TENANT_ID, usuarioProfissional())).estruturasIniciais).toEqual([]);
    });

    it('libera somente estruturas selecionadas pelo marcador v2', async () => {
      repositorios.get(TenantConfiguracaoOrm)!.registros.push({
        tenantId: TENANT_ID,
        chave: 'kit_inicial_clinica',
        valor: { versao: 2, itens: ['estrutura:cinco-refeicoes'] }
      });
      const pagina = await servico.listar(TENANT_ID, usuarioProfissional());
      expect(pagina.estruturasIniciais.map((estrutura) => estrutura.id)).toEqual(['cinco-refeicoes']);
    });

    it('não libera estruturas se o marcador for inválido ou incompatível', async () => {
      repositorios.get(TenantConfiguracaoOrm)!.registros.push({
        tenantId: TENANT_ID,
        chave: 'kit_inicial_clinica',
        valor: { versao: 2, itens: [] }
      });
      expect((await servico.listar(TENANT_ID, usuarioProfissional())).estruturasIniciais).toEqual([]);
    });

    it('nega o kit a usuario sem permissao de ler planos', async () => {
      repositorios.get(TenantConfiguracaoOrm)!.registros.push({
        tenantId: TENANT_ID, chave: 'kit_inicial_clinica', valor: { versao: 1 }
      });
      await expect(servico.listar(TENANT_ID, { ...usuarioProfissional(), permissoes: [] }))
        .rejects.toBeInstanceOf(ForbiddenException);
      expect(repositorios.get(TenantConfiguracaoOrm)!.findOne).not.toHaveBeenCalled();
    });

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

    it('responde 404 para modelo existente em outro tenant', async () => {
      modeloDeOutroTenant();
      await expect(servico.obter(TENANT_ID, MODELO_ID, usuarioProfissional())).rejects.toBeInstanceOf(NotFoundException);
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
      expect(consultaSql).toHaveBeenCalledWith(
        'select id from modelos_plano_alimentar where tenant_id = $1 and id = $2 for update',
        [TENANT_ID, MODELO_ID]
      );
      expect(consultaSql.mock.invocationCallOrder[0]).toBeLessThan(
        repositorios.get(ModeloPlanoAlimentarOrm)!.findOne.mock.invocationCallOrder[0]
      );
    });

    it('nega arquivar modelo pessoal de outro profissional', async () => {
      modeloPessoalDeOutro();
      await expect(servico.arquivar(TENANT_ID, MODELO_ID, usuarioProfissional())).rejects.toBeInstanceOf(
        NotFoundException
      );
    });

    it('nao arquiva modelo existente em outro tenant', async () => {
      modeloDeOutroTenant();
      await expect(servico.arquivar(TENANT_ID, MODELO_ID, usuarioProfissional())).rejects.toBeInstanceOf(NotFoundException);
      expect(repositorios.get(ModeloPlanoAlimentarOrm)!.save).not.toHaveBeenCalled();
    });
  });

  describe('versionamento', () => {
    it('edita um modelo legado atomicamente criando snapshots cifrados v1 e v2', async () => {
      const legado = {
        id: MODELO_ID, tenantId: TENANT_ID, origem: 'clinica', profissionalId: undefined,
        nomeCriptografado: criptografia.criptografar('Legado'),
        conteudoCriptografado: criptografia.criptografar(JSON.stringify(refeicoesExemplo())),
        totalRefeicoes: 1, totalItens: 1, versaoAtual: 1, criadoPorUsuarioId: USUARIO_ID,
        arquivadoEm: undefined
      };
      repositorios.get(ModeloPlanoAlimentarOrm)!.registros.push(legado);
      const refeicoes = [{ nome: 'Nova estrutura', itens: [{ quantidade: 2, unidade: 'porcao', porcaoGramas: 70 }] }];
      const resultado = await servico.editar(TENANT_ID, MODELO_ID, usuarioProfissional(), {
        versaoEsperada: 1, nome: 'Revisado', refeicoes: refeicoes as never
      });
      expect(resultado.versaoAtual).toBe(2);
      const revisoes = repositorios.get(RevisaoModeloPlanoAlimentarOrm)!.registros;
      expect(revisoes.map((revisao) => revisao.numero)).toEqual([1, 2]);
      expect(criptografia.descriptografar(revisoes[0].nomeCriptografado)).toBe('Legado');
      expect(criptografia.descriptografar(revisoes[1].nomeCriptografado)).toBe('Revisado');
      expect(legado.versaoAtual).toBe(2);
      expect(legado.criadoPorUsuarioId).toBe(USUARIO_ID);
      expect(consultaSql).toHaveBeenCalledTimes(1);
    });

    it('recusa versão concorrente sem inserir revisão nem alterar modelo', async () => {
      const legado = {
        id: MODELO_ID, tenantId: TENANT_ID, origem: 'clinica', nomeCriptografado: Buffer.from('x'),
        conteudoCriptografado: Buffer.from('x'), totalRefeicoes: 1, totalItens: 1, versaoAtual: 3,
        criadoPorUsuarioId: USUARIO_ID, arquivadoEm: undefined
      };
      repositorios.get(ModeloPlanoAlimentarOrm)!.registros.push(legado);
      await expect(servico.editar(TENANT_ID, MODELO_ID, usuarioProfissional(), {
        versaoEsperada: 2, nome: 'Revisado', refeicoes: refeicoesExemplo() as never
      })).rejects.toBeInstanceOf(ConflictException);
      expect(legado.versaoAtual).toBe(3);
      expect(repositorios.get(RevisaoModeloPlanoAlimentarOrm)!.save).not.toHaveBeenCalled();
    });

    it('valida propriedade pessoal depois do lock e responde 404 sem consultar revisões', async () => {
      modeloPessoalDeOutro();
      await expect(servico.editar(TENANT_ID, MODELO_ID, usuarioProfissional(), {
        versaoEsperada: 1, nome: 'Alterado', refeicoes: refeicoesExemplo() as never
      })).rejects.toBeInstanceOf(NotFoundException);
      expect(consultaSql).toHaveBeenCalledTimes(1);
      expect(consultaSql.mock.invocationCallOrder[0]).toBeLessThan(
        repositorios.get(ModeloPlanoAlimentarOrm)!.findOne.mock.invocationCallOrder[0]
      );
      expect(repositorios.get(RevisaoModeloPlanoAlimentarOrm)!.findOne).not.toHaveBeenCalled();
    });

    it('nao edita modelo existente em outro tenant nem consulta revisoes', async () => {
      modeloDeOutroTenant();
      await expect(servico.editar(TENANT_ID, MODELO_ID, usuarioProfissional(), {
        versaoEsperada: 1, nome: 'Alterado', refeicoes: refeicoesExemplo() as never
      })).rejects.toBeInstanceOf(NotFoundException);
      expect(repositorios.get(ModeloPlanoAlimentarOrm)!.save).not.toHaveBeenCalled();
      expect(repositorios.get(RevisaoModeloPlanoAlimentarOrm)!.findOne).not.toHaveBeenCalled();
    });

    it('nega ler histórico sem permissão de leitura', async () => {
      await expect(servico.listarVersoes(TENANT_ID, MODELO_ID,
        { ...usuarioProfissional(), permissoes: [] }, { pagina: 1, limite: 10 }
      )).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('não revela histórico de modelo pessoal de outro profissional', async () => {
      modeloPessoalDeOutro();
      await expect(servico.listarVersoes(TENANT_ID, MODELO_ID, usuarioProfissional(), { pagina: 1, limite: 10 }))
        .rejects.toBeInstanceOf(NotFoundException);
      expect(repositorios.get(RevisaoModeloPlanoAlimentarOrm)!.findAndCount).not.toHaveBeenCalled();
    });

    it('nao consulta revisoes de modelo existente em outro tenant', async () => {
      modeloDeOutroTenant();
      await expect(servico.listarVersoes(TENANT_ID, MODELO_ID, usuarioProfissional(), { pagina: 1, limite: 10 }))
        .rejects.toBeInstanceOf(NotFoundException);
      expect(repositorios.get(RevisaoModeloPlanoAlimentarOrm)!.findAndCount).not.toHaveBeenCalled();
    });

    it('nao abre snapshot de modelo existente em outro tenant', async () => {
      modeloDeOutroTenant();
      await expect(servico.obterVersao(TENANT_ID, MODELO_ID, 1, usuarioProfissional()))
        .rejects.toBeInstanceOf(NotFoundException);
      expect(repositorios.get(RevisaoModeloPlanoAlimentarOrm)!.findOne).not.toHaveBeenCalled();
    });

    it('restaura snapshot como nova versão sem sobrescrever revisões', async () => {
      const modelo = {
        id: MODELO_ID, tenantId: TENANT_ID, origem: 'clinica', nomeCriptografado: criptografia.criptografar('Atual'),
        conteudoCriptografado: criptografia.criptografar(JSON.stringify(refeicoesExemplo())),
        totalRefeicoes: 1, totalItens: 1, versaoAtual: 2, criadoPorUsuarioId: USUARIO_ID, arquivadoEm: undefined
      };
      const historico = {
        id: '10000000-0000-4000-8000-000000000008', tenantId: TENANT_ID, modeloId: MODELO_ID, numero: 1,
        nomeCriptografado: criptografia.criptografar('Antigo'),
        conteudoCriptografado: criptografia.criptografar(JSON.stringify(refeicoesExemplo())),
        totalRefeicoes: 1, totalItens: 1, autorUsuarioId: USUARIO_ID, criadoEm: new Date()
      };
      repositorios.get(ModeloPlanoAlimentarOrm)!.registros.push(modelo);
      repositorios.get(RevisaoModeloPlanoAlimentarOrm)!.registros.push(historico);
      const resultado = await servico.restaurarVersao(TENANT_ID, MODELO_ID, 1, usuarioProfissional(), 2);
      expect(resultado.versaoAtual).toBe(3);
      expect(historico.numero).toBe(1);
      expect(repositorios.get(RevisaoModeloPlanoAlimentarOrm)!.registros.map((r) => r.numero)).toEqual([1, 3]);
      expect(repositorios.get(RevisaoModeloPlanoAlimentarOrm)!.save.mock.calls[0][0].numero).toBe(3);
    });

    it('nao restaura modelo existente em outro tenant nem consulta seu historico', async () => {
      modeloDeOutroTenant();
      await expect(servico.restaurarVersao(TENANT_ID, MODELO_ID, 1, usuarioProfissional(), 1))
        .rejects.toBeInstanceOf(NotFoundException);
      expect(repositorios.get(ModeloPlanoAlimentarOrm)!.save).not.toHaveBeenCalled();
      expect(repositorios.get(RevisaoModeloPlanoAlimentarOrm)!.findOne).not.toHaveBeenCalled();
    });
  });
});
