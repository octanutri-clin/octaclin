import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CriarReceitaNutricionalDto } from './dtos';
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
      if (operador._type === 'arrayContains') return operador._value.every((v: string) => (registro[chave] ?? []).includes(v));
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
    const gerenciador = {
      getRepository: jest.fn((entidade: Function) => repositorios.get(entidade)),
      query: jest.fn(async () => [])
    } as unknown as EntityManager;
    const executor = { executar: jest.fn(async (_tenant: string, operacao: (manager: EntityManager) => Promise<unknown>) => operacao(gerenciador)) };
    servico = new ServicoReceitasNutricionais(executor as unknown as ExecutorTenant, criptografia);
  });

  it('T02 grava os metadados no ciphertext e deriva o índice por tenant na mesma criação', async () => {
    const metadados = { schemaVersao: 1, etiquetas: ['Café'], baseQuantidades: 'receita_inteira', rendimentoPorcoes: 4, tempoPreparoMinutos: 20 };
    await servico.criar(TENANT_ID, usuarioProfissional(), {
      nome: 'Receita sintética', origem: 'pessoal', tipo: 'receita', categoria: 'Lanche', itens: itensExemplo(), metadados
    } as never);
    const receita = repositorios.get(ReceitaNutricionalOrm)!.registros[0];
    const conteudo = JSON.parse(criptografia.descriptografar(receita.conteudoCriptografado));
    expect(conteudo.metadados).toEqual(metadados);
    expect(receita.etiquetasHashes).toEqual([criptografia.gerarHashPerfilExato(TENANT_ID, 'tag', 'Café')]);
    expect(JSON.stringify(receita.etiquetasHashes)).not.toContain('Café');
  });

  it('T02 writer antigo preserva metadata e limpeza explícita não remove os outros campos', async () => {
    const entrada = { nome: 'Controle', origem: 'pessoal', tipo: 'receita', categoria: 'Lanche', itens: itensExemplo() };
    const metadados = { schemaVersao: 1, etiquetas: ['Lanche'], baseQuantidades: 'receita_inteira', rendimentoPorcoes: 4, tempoPreparoMinutos: 20 };
    await servico.criar(TENANT_ID, usuarioProfissional(), { ...entrada, metadados } as never);
    await servico.atualizar(TENANT_ID, RECEITA_ID, usuarioProfissional(), { ...entrada, versaoEsperada: 1 } as never);
    const aposLegado = await servico.obter(TENANT_ID, RECEITA_ID, usuarioProfissional());
    expect(aposLegado).toMatchObject({ metadados, versaoAtual: 2 });
    await servico.atualizar(TENANT_ID, RECEITA_ID, usuarioProfissional(), { ...entrada, versaoEsperada: 2, metadados: { tempoPreparoMinutos: null } } as never);
    expect(await servico.obter(TENANT_ID, RECEITA_ID, usuarioProfissional())).toMatchObject({ metadados: {
      schemaVersao: 1, etiquetas: ['Lanche'], baseQuantidades: 'receita_inteira', rendimentoPorcoes: 4
    }, versaoAtual: 3 });
    const cifra = repositorios.get(ReceitaNutricionalOrm)!.registros[0].conteudoCriptografado;
    expect(JSON.parse(criptografia.descriptografar(cifra)).metadados).not.toHaveProperty('tempoPreparoMinutos');
  });
  it('P2 legado DTO válido com nulls opcionais continua abrindo/listando/editando sem reescrever na leitura', async () => {
    const dto = plainToInstance(CriarReceitaNutricionalDto, { nome: 'Controle legado', origem: 'clinica', tipo: 'receita', categoria: 'Lanche', itens: [{
      descricao: 'Controle', quantidade: 1, unidade: 'g', porcaoGramas: 100, substituicoes: [], substituicoesVisiveisInicialmente: null,
      nutrientesPor100g: { energiaKcal: 100, proteinasG: 1, carboidratosG: 20, gordurasG: 1, fibrasG: null }
    }] });
    expect(validateSync(dto, { whitelist: true, forbidNonWhitelisted: true })).toEqual([]);
    const cipherLegado = criptografia.criptografar(JSON.stringify({ itens: dto.itens }));
    repositorios.get(ReceitaNutricionalOrm)!.registros.push({ id: RECEITA_ID, tenantId: TENANT_ID, origem: 'clinica', tipo: 'receita', categoria: 'Lanche', versaoAtual: 1,
      nomeCriptografado: criptografia.criptografar('Controle legado'), conteudoCriptografado: cipherLegado });
    const lido = await servico.obter(TENANT_ID, RECEITA_ID, usuarioProfissional());
    expect(lido.itens[0].nutrientesPor100g?.fibrasG).toBeUndefined();
    expect((await servico.listar(TENANT_ID, usuarioProfissional())).total).toBe(1);
    expect(repositorios.get(ReceitaNutricionalOrm)!.registros[0].conteudoCriptografado).toEqual(cipherLegado);
    await expect(servico.atualizar(TENANT_ID, RECEITA_ID, usuarioProfissional(), { ...dto, versaoEsperada: 1 })).resolves.toMatchObject({ versaoAtual: 2 });
  });

  it.each([{ etiquetas: null }, { schemaVersao: 2 }, { segredo: 'sintético' }])('T02 valida metadata também no serviço antes de gravar: %#', async metadados => {
    await expect(servico.criar(TENANT_ID, usuarioProfissional(), {
      nome: 'Controle', origem: 'pessoal', tipo: 'receita', categoria: 'Lanche', itens: itensExemplo(), metadados
    } as never)).rejects.toBeInstanceOf(BadRequestException);
    expect(repositorios.get(ReceitaNutricionalOrm)!.registros).toHaveLength(0);
  });

  it('T02 rejeita drift do índice ou ciphertext malformado sem reescrever registros', async () => {
    await servico.criar(TENANT_ID, usuarioProfissional(), {
      nome: 'Controle', origem: 'clinica', tipo: 'receita', categoria: 'Lanche', itens: itensExemplo(), metadados: { etiquetas: ['Lanche'] }
    } as never);
    const receita = repositorios.get(ReceitaNutricionalOrm)!.registros[0];
    const antes = Buffer.from(receita.conteudoCriptografado);
    receita.etiquetasHashes = ['incorreto'];
    await expect(servico.obter(TENANT_ID, RECEITA_ID, usuarioProfissional())).rejects.toBeInstanceOf(BadRequestException);
    expect(receita.conteudoCriptografado).toEqual(antes);
    receita.etiquetasHashes = [];
    receita.conteudoCriptografado = criptografia.criptografar('{"itens":"incorreto"}');
    await expect(servico.obter(TENANT_ID, RECEITA_ID, usuarioProfissional())).rejects.toBeInstanceOf(BadRequestException);
  });

  it('T02 consulta aplica igualdade de etiqueta antes do count/paginação e não expõe o índice', async () => {
    const receitaRepo = repositorios.get(ReceitaNutricionalOrm)!;
    for (let i = 0; i < 102; i++) {
      const etiqueta = i === 101 ? 'Café' : 'Lanche';
      receitaRepo.registros.push({ id: `10000000-0000-4000-8000-${String(i).padStart(12, '0')}`, tenantId: TENANT_ID,
        origem: 'clinica', tipo: 'receita', categoria: 'Lanche', totalItens: 1, versaoAtual: 1,
        nomeCriptografado: criptografia.criptografar('Controle'),
        conteudoCriptografado: criptografia.criptografar(JSON.stringify({ itens: itensExemplo(), metadados: { schemaVersao: 1, etiquetas: [etiqueta] } })),
        etiquetasHashes: [criptografia.gerarHashPerfilExato(TENANT_ID, 'tag', etiqueta)] });
    }
    const api = servico as unknown as { consultar: (t: string, u: UsuarioAutenticado, c: unknown) => Promise<{ itens: object[]; total: number }> };
    expect(api.consultar).toEqual(expect.any(Function));
    const resultado = await api.consultar(TENANT_ID, usuarioProfissional(), { etiqueta: ' cafe ', limite: 1, pagina: 1 });
    expect(resultado.total).toBe(1);
    expect(resultado.itens).toHaveLength(1);
    expect(resultado.itens[0]).not.toHaveProperty('etiquetasHashes');
    expect(receitaRepo.findAndCount).toHaveBeenCalledWith(expect.objectContaining({ skip: 0, take: 1,
      order: { atualizadoEm: 'DESC', id: 'DESC' }, where: [expect.objectContaining({ tenantId: TENANT_ID, etiquetasHashes: expect.objectContaining({ _type: 'arrayContains' }) }),
        expect.objectContaining({ origem: 'pessoal', profissionalId: PROFISSIONAL_ID })] }));
  });
  it.each([null, [], new Date(), Object.create({ pagina: 1 }), { tenantId: TENANT_ID },
    { pagina: '1' }, { limite: 101 }, { pagina: 0 }, { etiqueta: null }, { etiqueta: ['Lanche'] },
    JSON.parse('{"__proto__":{"pagina":1}}'), { constructor: 'invalido' }])('T02 consulta rejeita estrutura/controle desconhecido antes de consultar: %#', async entrada => {
    const api = servico as unknown as { consultar: (t: string, u: UsuarioAutenticado, c: unknown) => Promise<unknown> };
    await expect(api.consultar(TENANT_ID, usuarioProfissional(), entrada)).rejects.toBeInstanceOf(BadRequestException);
    expect(repositorios.get(ReceitaNutricionalOrm)!.findAndCount).not.toHaveBeenCalled();
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
    await servico.criar(TENANT_ID, usuarioProfissional(), { nome: 'Cafe rapido', origem: 'pessoal', tipo: 'receita', categoria: 'Café', itens: itensExemplo() as never });
    const salvo = repositorios.get(ReceitaNutricionalOrm)!.save.mock.calls[0][0];
    expect(criptografia.descriptografar(salvo.nomeCriptografado)).toBe('Cafe rapido');
    expect(JSON.parse(criptografia.descriptografar(salvo.conteudoCriptografado)).itens).toHaveLength(1);
    expect(salvo.profissionalId).toBe(PROFISSIONAL_ID);
    expect(repositorios.get(UserActionLogOrm)!.save).toHaveBeenCalled();
  });

  it('normaliza e persiste categoria livre da clínica', async () => {
    await servico.criar(TENANT_ID, usuarioProfissional(), {
      nome: 'Receita de teste', origem: 'clinica', tipo: 'receita', categoria: '  Lanche   da tarde  ',
      itens: itensExemplo() as never
    } as never);
    const salvo = repositorios.get(ReceitaNutricionalOrm)!.save.mock.calls[0][0];
    expect(salvo.categoria).toBe('Lanche da tarde');
    expect(salvo.versaoAtual).toBe(1);
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
      nome: 'Alterar', origem: 'pessoal', tipo: 'receita', categoria: 'Lanche', versaoEsperada: 1, itens: itensExemplo() as never
    })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('atualiza snapshot e arquiva sem tocar plano publicado', async () => {
    await servico.criar(TENANT_ID, usuarioProfissional(), { nome: 'Antes', origem: 'clinica', tipo: 'receita', categoria: 'Almoço', itens: itensExemplo() as never });
    await servico.atualizar(TENANT_ID, RECEITA_ID, usuarioProfissional(), {
      nome: 'Depois', origem: 'clinica', tipo: 'refeicao_pronta', categoria: 'Jantar', versaoEsperada: 1, instrucoes: 'Misture.', itens: itensExemplo() as never
    });
    const atual = repositorios.get(ReceitaNutricionalOrm)!.registros[0];
    expect(criptografia.descriptografar(atual.nomeCriptografado)).toBe('Depois');
    expect(atual.tipo).toBe('refeicao_pronta');
    expect(atual.versaoAtual).toBe(2);
    await servico.arquivar(TENANT_ID, RECEITA_ID, usuarioProfissional());
    expect(atual.arquivadoEm).toBeInstanceOf(Date);
  });

  it('recusa edição quando a versão esperada está desatualizada', async () => {
    await servico.criar(TENANT_ID, usuarioProfissional(), {
      nome: 'Antes', origem: 'clinica', tipo: 'receita', categoria: 'Almoço', itens: itensExemplo() as never
    });
    await expect(servico.atualizar(TENANT_ID, RECEITA_ID, usuarioProfissional(), {
      nome: 'Depois', origem: 'clinica', tipo: 'receita', categoria: 'Almoço', versaoEsperada: 2,
      itens: itensExemplo() as never
    })).rejects.toBeInstanceOf(ConflictException);
  });

  it('avisa item cuja fonte saiu do catalogo antes de aplicar', async () => {
    repositorios.get(FonteComposicaoAlimentoOrm)!.registros[0].situacao = 'suspensa';
    await servico.criar(TENANT_ID, usuarioProfissional(), { nome: 'Cafe', origem: 'clinica', tipo: 'receita', categoria: 'Café', itens: itensExemplo() as never });
    const receita = await servico.obter(TENANT_ID, RECEITA_ID, usuarioProfissional());
    expect(receita.alimentosIndisponiveis).toEqual([ALIMENTO_ID]);
  });

  it('exige permissao de gerenciar para escrita', async () => {
    const usuario = { ...usuarioProfissional(), permissoes: ['planos_alimentares.ler' as const] };
    await expect(servico.criar(TENANT_ID, usuario, { nome: 'X', origem: 'pessoal', tipo: 'receita', categoria: 'Lanche', itens: itensExemplo() as never })).rejects.toBeInstanceOf(ForbiddenException);
  });
});
