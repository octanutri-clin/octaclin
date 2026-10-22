import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, IsNull } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { AlimentoComposicaoOrm } from '../infraestrutura/alimento-composicao.orm';
import { AlimentoPersonalizadoOrm } from '../infraestrutura/alimento-personalizado.orm';
import { FavoritoAlimentoOrm } from '../infraestrutura/favorito-alimento.orm';
import { FonteComposicaoAlimentoOrm } from '../infraestrutura/fonte-composicao-alimento.orm';
import { identidadeBiblioteca } from './identidade-biblioteca-alimentos';
import { OrigemFavoritoAlimento } from '../dominio/favoritos-alimentos';

@Injectable()
export class ServicoFavoritosAlimentos {
  constructor(private readonly executor: ExecutorTenant) {}

  async listar(tenantId: string, usuario: UsuarioAutenticado) {
    return this.executor.executar(tenantId, async (g) => {
      const profissionalId = await identidadeBiblioteca(g, tenantId, usuario, false);
      const rows = await g.createQueryBuilder(FavoritoAlimentoOrm, 'f')
        .leftJoin(AlimentoComposicaoOrm, 'a', 'a.id=f.alimento_composicao_id')
        .leftJoin(FonteComposicaoAlimentoOrm, 'fonte', 'fonte.id=a.fonte_id AND fonte.situacao=\'ativa\'')
        .leftJoin(AlimentoPersonalizadoOrm, 'c', 'c.id=f.alimento_personalizado_id AND c.tenant_id=f.tenant_id AND c.ativo=true AND (c.escopo=\'clinica\' OR c.profissional_id=f.profissional_id)')
        .select('f.alimento_composicao_id', 'alimentoComposicaoId')
        .addSelect('f.alimento_personalizado_id', 'alimentoPersonalizadoId')
        .where('f.tenant_id=:tenantId AND f.profissional_id=:profissionalId', { tenantId, profissionalId })
        .andWhere('(fonte.id IS NOT NULL OR c.id IS NOT NULL)')
        .getRawMany<{ alimentoComposicaoId: string | null; alimentoPersonalizadoId: string | null }>();
      return { itens: rows.map((r) => ({ origem: r.alimentoComposicaoId ? 'catalogo' as const : 'custom' as const, alimentoId: r.alimentoComposicaoId ?? r.alimentoPersonalizadoId! })) };
    });
  }

  async favoritar(tenantId: string, usuario: UsuarioAutenticado, origem: OrigemFavoritoAlimento, alimentoId: string) {
    if (!['catalogo', 'custom'].includes(origem)) throw new BadRequestException('Origem de alimento inválida.');
    return this.executor.executar(tenantId, async (g) => {
      const profissionalId = await identidadeBiblioteca(g, tenantId, usuario, true);
      await this.validarAlimento(g, tenantId, profissionalId, origem, alimentoId);
      const custom = origem === 'custom' ? alimentoId : null;
      const catalogo = origem === 'catalogo' ? alimentoId : null;
      await g.query(`insert into favoritos_alimentos_profissional (tenant_id,profissional_id,alimento_composicao_id,alimento_personalizado_id)
        values ($1,$2,$3,$4) on conflict do nothing`, [tenantId, profissionalId, catalogo, custom]);
      return { origem, alimentoId, favorito: true };
    });
  }

  async desfavoritar(tenantId: string, usuario: UsuarioAutenticado, origem: OrigemFavoritoAlimento, alimentoId: string) {
    if (!['catalogo', 'custom'].includes(origem)) throw new BadRequestException('Origem de alimento inválida.');
    return this.executor.executar(tenantId, async (g) => {
      const profissionalId = await identidadeBiblioteca(g, tenantId, usuario, true);
      await g.getRepository(FavoritoAlimentoOrm).delete({ tenantId, profissionalId,
        alimentoComposicaoId: origem === 'catalogo' ? alimentoId : IsNull(),
        alimentoPersonalizadoId: origem === 'custom' ? alimentoId : IsNull() });
      return { origem, alimentoId, favorito: false };
    });
  }

  private async validarAlimento(g: EntityManager, tenantId: string, profissionalId: string, origem: OrigemFavoritoAlimento, id: string) {
    if (origem === 'catalogo') {
      const a = await g.getRepository(AlimentoComposicaoOrm).findOne({ where: { id } });
      if (!a) throw new NotFoundException('Alimento não encontrado.');
      const fonte = await g.getRepository(FonteComposicaoAlimentoOrm).findOne({ where: { id: a.fonteId, situacao: 'ativa' } });
      if (!fonte) throw new ConflictException('Alimento indisponível no catálogo.');
      return;
    }
    const c = await g.getRepository(AlimentoPersonalizadoOrm).findOne({ where: { id, tenantId, ativo: true } });
    if (!c || (c.escopo !== 'clinica' && c.profissionalId !== profissionalId)) throw new NotFoundException('Alimento personalizado não encontrado.');
  }
}
