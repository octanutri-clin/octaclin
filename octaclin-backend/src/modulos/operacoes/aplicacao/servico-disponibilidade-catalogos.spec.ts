import { ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { UsuarioOrm } from '../../usuarios/infraestrutura/usuario.orm';
import { CONSULTA_DISPONIBILIDADE_CATALOGOS, ServicoDisponibilidadeCatalogos } from './servico-disponibilidade-catalogos';

const TENANT_ID = '10000000-0000-4000-8000-000000000001';
const USUARIO_ID = '10000000-0000-4000-8000-000000000002';
const CODIGO_TACO = 'taco_nepa_unicamp';
const BASE_TACO = 'cmvcol_taco3';

function usuario(permissoes = ['operacoes.tenants.gerenciar']): UsuarioAutenticado {
  return { usuarioId: USUARIO_ID, tenantId: TENANT_ID, papel: 'SuperAdmin', emailHash: 'hash', permissoes: permissoes as never };
}

function preparar(linhas: unknown[] = [], ator: any = { id: USUARIO_ID, tenantId: TENANT_ID, role: 'SuperAdmin', ativo: true }) {
  const repositorio = { findOne: jest.fn(async () => ator) };
  const manager = { getRepository: jest.fn((entity: Function) => entity === UsuarioOrm ? repositorio : undefined) } as unknown as EntityManager;
  const executor = { executar: jest.fn(async (_tenantId: string, acao: (m: EntityManager) => Promise<unknown>) => acao(manager)) };
  const fonteDados = { query: jest.fn(async () => linhas) };
  return {
    servico: new ServicoDisponibilidadeCatalogos(executor as unknown as ExecutorTenant, fonteDados as unknown as DataSource),
    executor,
    fonteDados
  };
}

function linhaTaco(overrides: Record<string, unknown> = {}) {
  return {
    codigo: CODIGO_TACO,
    base_codigo: BASE_TACO,
    rotulo: 'TACO',
    fonte_id: 'fonte-1',
    versao: 'taco-4a-cmvcol-taco3-v1',
    situacao: 'ativa',
    direito_uso_status: 'aprovado',
    importada_em: '2026-01-01T00:00:00.000Z',
    importacao_status: 'concluida',
    importacao_concluida_em: '2026-01-01T00:00:00.000Z',
    total_registros: 2,
    total_alimentos: 2,
    alimentos_importados: 2,
    alimentos_utilizaveis: 1,
    disponivel: true,
    ultima_tentativa_status: null,
    ultima_tentativa_em: null,
    ...overrides
  };
}

describe('ServicoDisponibilidadeCatalogos', () => {
  it('sempre devolve as quatro bases esperadas como ausentes quando não há fontes', async () => {
    const { servico } = preparar();
    const resultado = await servico.obter(usuario());
    expect(resultado.itens).toHaveLength(4);
    expect(resultado.itens.map((item) => item.codigo)).toEqual([
      'taco_nepa_unicamp', 'usda_fdc_foundation', 'usda_fdc_sr_legacy', 'ibge_pof_2008_2009'
    ]);
    expect(resultado.itens.every((item) => item.estado === 'ausente')).toBe(true);
    expect(resultado.completo).toBe(false);
  });

  it('considera todas as edições para o estado mesmo quando a projeção limita dez', async () => {
    const linhas = Array.from({ length: 11 }, (_, indice) => linhaTaco({
      fonte_id: `fonte-${indice}`,
      versao: `versao-opaca-${indice}`,
      disponivel: indice === 10,
      importada_em: new Date(Date.UTC(2026, 0, 11 - indice)).toISOString()
    }));
    const { servico } = preparar(linhas);
    const resultado = await servico.obter(usuario());
    const taco = resultado.itens[0];
    expect(taco.estado).toBe('disponivel');
    expect(taco.totalEdicoes).toBe(11);
    expect(taco.edicoesLimitadas).toBe(true);
    expect(taco.edicoes).toHaveLength(10);
  });

  it('separa tentativa recente com falha de uma edição ativa e utilizável', async () => {
    const { servico } = preparar([linhaTaco({
      ultima_tentativa_status: 'falhou',
      ultima_tentativa_em: '2026-02-01T00:00:00.000Z'
    })]);
    const resultado = await servico.obter(usuario());
    expect(resultado.itens[0].estado).toBe('disponivel');
    expect(resultado.itens[0].ultimaTentativa).toEqual({
      status: 'falhou',
      iniciadaEm: '2026-02-01T00:00:00.000Z'
    });
  });

  it('normaliza contagens bigint do PostgreSQL sem inventar divergência', async () => {
    const { servico } = preparar([linhaTaco({
      total_alimentos: '2',
      alimentos_importados: '2',
      alimentos_utilizaveis: '1'
    })]);
    const resultado = await servico.obter(usuario());
    expect(resultado.itens[0].estado).toBe('disponivel');
    expect(resultado.itens[0].edicoes[0]).toEqual(expect.objectContaining({
      totalAlimentos: 2,
      alimentosUtilizaveis: 1,
      motivos: []
    }));
  });

  it('expõe somente motivos enumerados para fonte incompleta e não detalhes privados', async () => {
    const { servico } = preparar([linhaTaco({
      situacao: 'suspensa',
      direito_uso_status: 'pendente',
      importacao_status: 'falhou',
      importacao_concluida_em: null,
      total_registros: 99,
      alimentos_importados: 2,
      alimentos_utilizaveis: 0,
      disponivel: false,
      erro_sanitizado: 'nao retornar isto',
      executor: 'nao retornar executor'
    })]);
    const resultado = await servico.obter(usuario());
    const taco = resultado.itens[0];
    expect(taco.estado).toBe('indisponivel');
    expect(taco.edicoes[0].motivos).toEqual(expect.arrayContaining([
      'fonte_inativa', 'direito_nao_aprovado', 'importacao_nao_concluida', 'carga_inconsistente', 'sem_composicao_utilizavel'
    ]));
    expect(JSON.stringify(resultado)).not.toContain('nao retornar');
  });

  it('falha fechado para papel, permissão ou ator inativo', async () => {
    const semPermissao = preparar();
    await expect(semPermissao.servico.obter(usuario([]))).rejects.toBeInstanceOf(ForbiddenException);
    const inativo = preparar([], { id: USUARIO_ID, tenantId: TENANT_ID, role: 'SuperAdmin', ativo: false });
    await expect(inativo.servico.obter(usuario())).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('transforma falha SQL em indisponibilidade sanitizada, sem sucesso vazio', async () => {
    const { servico, fonteDados } = preparar();
    (fonteDados.query as jest.Mock).mockRejectedValue(new Error('connection secret must not escape'));
    await expect(servico.obter(usuario())).rejects.toEqual(
      expect.objectContaining({
        constructor: ServiceUnavailableException,
        message: 'Não foi possível verificar os catálogos alimentares.'
      })
    );
  });

  it('consulta somente as quatro identidades e exclui valores numéricos especiais', () => {
    expect(CONSULTA_DISPONIBILIDADE_CATALOGOS).toContain("'usda_fdc_foundation', 'foundation-foods'");
    expect(CONSULTA_DISPONIBILIDADE_CATALOGOS).toContain("'usda_fdc_sr_legacy', 'sr-legacy'");
    expect(CONSULTA_DISPONIBILIDADE_CATALOGOS).toContain("'ibge_pof_2008_2009', 'pof-2008-2009-composicao'");
    expect(CONSULTA_DISPONIBILIDADE_CATALOGOS).toContain("not in ('NaN', 'Infinity', '-Infinity')");
    expect(CONSULTA_DISPONIBILIDADE_CATALOGOS.toLowerCase()).not.toMatch(/\b(insert|update|delete|truncate)\b/);
  });
});
