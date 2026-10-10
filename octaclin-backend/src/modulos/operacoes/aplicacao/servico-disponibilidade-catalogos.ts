import { ForbiddenException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { possuiPermissao } from '../../auth/dominio/permissoes';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { UsuarioOrm } from '../../usuarios/infraestrutura/usuario.orm';

const BASES_ESPERADAS = [
  { codigo: 'taco_nepa_unicamp', baseCodigo: 'cmvcol_taco3', rotulo: 'TACO' },
  { codigo: 'usda_fdc_foundation', baseCodigo: 'foundation-foods', rotulo: 'USDA Foundation Foods' },
  { codigo: 'usda_fdc_sr_legacy', baseCodigo: 'sr-legacy', rotulo: 'USDA SR Legacy' },
  { codigo: 'ibge_pof_2008_2009', baseCodigo: 'pof-2008-2009-composicao', rotulo: 'IBGE POF 2008–2009' }
] as const;

interface LinhaDisponibilidadeCatalogo {
  codigo: string;
  base_codigo: string;
  rotulo: string;
  fonte_id: string | null;
  versao: string | null;
  situacao: string | null;
  direito_uso_status: string | null;
  importada_em: Date | string | null;
  importacao_status: string | null;
  importacao_concluida_em: Date | string | null;
  total_registros: number | null;
  total_alimentos: number | string | null;
  alimentos_importados: number | string | null;
  alimentos_utilizaveis: number | string | null;
  disponivel: boolean;
  ultima_tentativa_status: string | null;
  ultima_tentativa_em: Date | string | null;
}

const SQL_DISPONIBILIDADE = `
  with esperadas(codigo, base_codigo, rotulo) as (
    values
      ('taco_nepa_unicamp', 'cmvcol_taco3', 'TACO'),
      ('usda_fdc_foundation', 'foundation-foods', 'USDA Foundation Foods'),
      ('usda_fdc_sr_legacy', 'sr-legacy', 'USDA SR Legacy'),
      ('ibge_pof_2008_2009', 'pof-2008-2009-composicao', 'IBGE POF 2008–2009')
  )
  select
    esperada.codigo,
    esperada.base_codigo,
    esperada.rotulo,
    fonte.id as fonte_id,
    fonte.versao,
    fonte.situacao,
    fonte.direito_uso_status,
    fonte.importada_em,
    importacao.status as importacao_status,
    importacao.concluida_em as importacao_concluida_em,
    importacao.total_registros,
    coalesce(alimentos.total_alimentos, 0)::integer as total_alimentos,
    coalesce(alimentos.alimentos_importados, 0)::integer as alimentos_importados,
    coalesce(alimentos.alimentos_utilizaveis, 0)::integer as alimentos_utilizaveis,
    (
      fonte.situacao = 'ativa'
      and fonte.direito_uso_status = 'aprovado'
      and importacao.status = 'concluida'
      and importacao.concluida_em is not null
      and importacao.total_registros > 0
      and importacao.total_registros = coalesce(alimentos.alimentos_importados, 0)
      and coalesce(alimentos.alimentos_utilizaveis, 0) > 0
    ) as disponivel,
    tentativa.status as ultima_tentativa_status,
    tentativa.iniciada_em as ultima_tentativa_em
  from esperadas esperada
  left join catalogos_composicao_alimentos catalogo on catalogo.codigo = esperada.codigo
  left join fontes_composicao_alimentos fonte
    on fonte.catalogo_id = catalogo.id and fonte.base_codigo = esperada.base_codigo
  left join lateral (
    select i.id, i.status, i.total_registros, i.concluida_em
      from importacoes_catalogo_composicao i
     where i.fonte_versao_id = fonte.id
       and i.checksum_arquivo = fonte.checksum_arquivo
       and i.hash_conteudo = fonte.hash_conteudo
     order by i.concluida_em desc nulls last, i.id desc
     limit 1
  ) importacao on true
  left join lateral (
    select
      count(*) as total_alimentos,
      count(*) filter (where alimento.importacao_id = importacao.id) as alimentos_importados,
      count(*) filter (
        where alimento.importacao_id = importacao.id
          and alimento.base_gramas > 0
          and alimento.base_gramas::text not in ('NaN', 'Infinity', '-Infinity')
          and alimento.energia_kcal is not null and alimento.energia_kcal >= 0
          and alimento.energia_kcal::text not in ('NaN', 'Infinity', '-Infinity')
          and alimento.proteinas_g is not null and alimento.proteinas_g >= 0
          and alimento.proteinas_g::text not in ('NaN', 'Infinity', '-Infinity')
          and alimento.carboidratos_g is not null and alimento.carboidratos_g >= 0
          and alimento.carboidratos_g::text not in ('NaN', 'Infinity', '-Infinity')
          and alimento.lipidios_g is not null and alimento.lipidios_g >= 0
          and alimento.lipidios_g::text not in ('NaN', 'Infinity', '-Infinity')
      ) as alimentos_utilizaveis
    from alimentos_composicao alimento
    where alimento.fonte_id = fonte.id
  ) alimentos on true
  left join lateral (
    select t.status, t.iniciada_em
      from tentativas_importacao_catalogo t
     where t.catalogo_codigo = esperada.codigo and t.base_codigo = esperada.base_codigo
     order by t.iniciada_em desc, t.id desc
     limit 1
  ) tentativa on true
  order by esperada.codigo, fonte.importada_em desc nulls last, fonte.id desc
`;

@Injectable()
export class ServicoDisponibilidadeCatalogos {
  constructor(
    private readonly executorTenant: ExecutorTenant,
    private readonly fonteDados: DataSource
  ) {}

  async obter(usuario: UsuarioAutenticado) {
    if (usuario.papel !== 'SuperAdmin' ||
      !usuario.permissoes.includes('operacoes.tenants.gerenciar') ||
      !possuiPermissao(usuario.papel, 'operacoes.tenants.gerenciar')) {
      throw new ForbiddenException('Sem permissão para consultar catálogos globais.');
    }

    await this.executorTenant.executar(usuario.tenantId, async (gerenciador) => {
      const ator = await gerenciador.getRepository(UsuarioOrm).findOne({
        where: { id: usuario.usuarioId, tenantId: usuario.tenantId }
      });
      if (!ator || !ator.ativo || ator.role !== 'SuperAdmin') {
        throw new ForbiddenException('A sessão não corresponde a um SuperAdmin ativo.');
      }
    });

    let linhas: LinhaDisponibilidadeCatalogo[];
    try {
      linhas = await this.fonteDados.query(SQL_DISPONIBILIDADE) as LinhaDisponibilidadeCatalogo[];
    } catch {
      throw new ServiceUnavailableException('Não foi possível verificar os catálogos alimentares.');
    }

    const itens = BASES_ESPERADAS.map((base) => {
      const edicoesBase = linhas.filter((linha) => linha.codigo === base.codigo && linha.base_codigo === base.baseCodigo);
      const totalEdicoes = edicoesBase.filter((linha) => linha.fonte_id !== null).length;
      const edicoesComFonte = edicoesBase.filter((linha) => linha.fonte_id !== null);
      const disponivel = edicoesComFonte.some((linha) => linha.disponivel === true);
      const ultimaTentativa = edicoesBase.find((linha) => linha.ultima_tentativa_status !== null);
      const edicoes = edicoesComFonte.slice(0, 10).map((linha) => ({
        versao: linha.versao,
        situacao: linha.situacao,
        direitoUsoStatus: linha.direito_uso_status,
        importadaEm: linha.importada_em,
        importacaoStatus: linha.importacao_status,
        totalDeclarado: linha.total_registros === null ? null : Number(linha.total_registros),
        totalAlimentos: Number(linha.alimentos_importados ?? 0),
        alimentosUtilizaveis: Number(linha.alimentos_utilizaveis ?? 0),
        disponivel: linha.disponivel === true,
        motivos: this.motivos(linha)
      }));
      return {
        codigo: base.codigo,
        baseCodigo: base.baseCodigo,
        rotulo: base.rotulo,
        estado: totalEdicoes === 0 ? 'ausente' : disponivel ? 'disponivel' : 'indisponivel',
        totalEdicoes,
        edicoesLimitadas: totalEdicoes > 10,
        edicoes,
        ...(ultimaTentativa && ['falhou', 'em_execucao'].includes(ultimaTentativa.ultima_tentativa_status ?? '')
          ? { ultimaTentativa: { status: ultimaTentativa.ultima_tentativa_status, iniciadaEm: ultimaTentativa.ultima_tentativa_em } }
          : {})
      };
    });
    return {
      verificadoEm: new Date().toISOString(),
      completo: itens.every((item) => item.estado === 'disponivel'),
      itens
    };
  }

  private motivos(linha: LinhaDisponibilidadeCatalogo): string[] {
    const motivos: string[] = [];
    if (linha.situacao !== 'ativa') motivos.push('fonte_inativa');
    if (linha.direito_uso_status !== 'aprovado') motivos.push('direito_nao_aprovado');
    if (linha.importacao_status !== 'concluida' || !linha.importacao_concluida_em) motivos.push('importacao_nao_concluida');
    const totalDeclarado = Number(linha.total_registros ?? 0);
    const totalImportado = Number(linha.alimentos_importados ?? 0);
    const totalUtilizavel = Number(linha.alimentos_utilizaveis ?? 0);
    if (!Number.isSafeInteger(totalDeclarado) || totalDeclarado <= 0 || totalDeclarado !== totalImportado) motivos.push('carga_inconsistente');
    if (!Number.isSafeInteger(totalImportado) || totalImportado <= 0) motivos.push('sem_alimentos');
    if (!Number.isSafeInteger(totalUtilizavel) || totalUtilizavel <= 0) motivos.push('sem_composicao_utilizavel');
    return [...new Set(motivos)];
  }
}

export const CONSULTA_DISPONIBILIDADE_CATALOGOS = SQL_DISPONIBILIDADE;
