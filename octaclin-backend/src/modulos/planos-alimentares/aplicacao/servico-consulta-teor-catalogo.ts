import { ForbiddenException, Injectable } from '@nestjs/common';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { AlimentoComposicaoOrm } from '../infraestrutura/alimento-composicao.orm';
import { FonteComposicaoAlimentoOrm } from '../infraestrutura/fonte-composicao-alimento.orm';
import { ConsultaTeorCatalogoDto, validarConsultaTeorCatalogo } from './dto-consulta-teor-catalogo';
import { identidadeBiblioteca } from './identidade-biblioteca-alimentos';
import { prepararConsultaTeorCatalogo } from './consulta-teor-catalogo';

interface LinhaCatalogo {
  id: string; nome: string; preparacao: string | null; baseGramas: string;
  micronutrientes: unknown; fonteId: string; fonteCodigo: string; fonteVersao: string;
  baseCodigo: string; esquemaVersao: string; situacao: string; direitoUsoStatus: string;
}

@Injectable()
export class ServicoConsultaTeorCatalogo {
  constructor(private readonly executor: ExecutorTenant) {}

  async consultar(tenantId: string, usuario: UsuarioAutenticado, entrada: ConsultaTeorCatalogoDto) {
    if (usuario.tenantId !== tenantId || usuario.papel !== 'Professional' || !usuario.permissoes.includes('planos_alimentares.ler'))
      throw new ForbiddenException('Consulta ao catálogo não permitida.');
    const consulta = validarConsultaTeorCatalogo(entrada);
    return this.executor.executar(tenantId, async g => {
      await identidadeBiblioteca(g, tenantId, usuario, false);
      // Fonte e composição resolvidas no mesmo SELECT: não existe uma janela entre
      // carregar a lista de fontes e ler o alimento com status possivelmente antigo.
      const qb = g.createQueryBuilder(AlimentoComposicaoOrm, 'alimento')
        .innerJoin(FonteComposicaoAlimentoOrm, 'fonte', 'fonte.id = alimento.fonte_id')
        .select('alimento.id', 'id').addSelect('alimento.nome', 'nome')
        .addSelect('alimento.preparacao', 'preparacao').addSelect('alimento.base_gramas', 'baseGramas')
        .addSelect('alimento.micronutrientes', 'micronutrientes').addSelect('fonte.id', 'fonteId')
        .addSelect('fonte.codigo', 'fonteCodigo').addSelect('fonte.versao', 'fonteVersao')
        .addSelect('fonte.base_codigo', 'baseCodigo').addSelect('fonte.esquema_versao', 'esquemaVersao')
        .addSelect('fonte.situacao', 'situacao').addSelect('fonte.direito_uso_status', 'direitoUsoStatus')
        .where("lower(alimento.nome) LIKE lower(:busca) ESCAPE '\\'", { busca: `%${consulta.busca.trim().replace(/[\\%_]/g, '\\$&')}%` })
        .andWhere('fonte.situacao = :situacao AND fonte.direito_uso_status = :direito', { situacao: 'ativa', direito: 'aprovado' });
      for (const [campo, coluna] of [['fonteCodigo', 'codigo'], ['versao', 'versao'], ['baseCodigo', 'base_codigo']] as const) {
        if (consulta[campo] !== undefined) qb.andWhere(`fonte.${coluna} = :${campo}`, { [campo]: consulta[campo] });
      }
      // getRawMany com JOIN não aplica skip/take no TypeORM; este join não expande alimentos.
      const linhas = await qb.orderBy('alimento.nome', 'ASC').addOrderBy('alimento.id', 'ASC')
        .offset((consulta.pagina - 1) * consulta.limite).limit(consulta.limite + 1).getRawMany<LinhaCatalogo>();
      const resultado = prepararConsultaTeorCatalogo({ codigo: consulta.codigo, porcaoGramas: consulta.porcaoGramas },
        linhas.slice(0, consulta.limite).map(linha => ({ id: linha.id, nome: linha.nome,
          ...(linha.preparacao === null ? {} : { preparacao: linha.preparacao }),
          baseGramas: linha.baseGramas, micronutrientes: linha.micronutrientes,
          fonte: { id: linha.fonteId, codigo: linha.fonteCodigo, versao: linha.fonteVersao,
            baseCodigo: linha.baseCodigo, esquemaVersao: linha.esquemaVersao,
            situacao: linha.situacao, direitoUsoStatus: linha.direitoUsoStatus } })));
      return { ...resultado, paginacao: { pagina: consulta.pagina, limite: consulta.limite,
        temProxima: linhas.length > consulta.limite, ordemSelecao: 'nome_identificador' as const,
        ordenacaoTeor: 'somente_pagina' as const, visao: 'catalogo_atual_sem_snapshot' as const } };
    });
  }
}
