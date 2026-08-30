import { createHmac } from 'crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, IsNull } from 'typeorm';
import { ServicoAuditoria } from '../../../infraestrutura/auditoria/servico-auditoria';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { obterSegredoAcesso } from '../infraestrutura/configuracao-jwt';
import { RefreshTokenOrm } from '../infraestrutura/refresh-token.orm';
import { MotivoRevogacaoSessao, SessaoUsuarioOrm } from '../infraestrutura/sessao-usuario.orm';

const ROTULO_REFERENCIA_SESSAO = 'octaclin-referencia-sessao-v1';

export type EstadoSessao = 'ativa' | 'revogada' | 'expirada';

/** Projecao devolvida pela API. Nao carrega id de sessao, familia, token ou hash. */
export interface SessaoPublica {
  referencia: string;
  criadaEm: string;
  ultimaAtividadeEm: string;
  expiraEm: string;
  estado: EstadoSessao;
  atual: boolean;
}

export interface PaginaSessoesPublicas {
  itens: SessaoPublica[];
  pagina: number;
  limite: number;
  total: number;
  totalPaginas: number;
}

const LIMITE_SESSOES_POR_PAGINA = 5;

function estadoDaSessao(sessao: SessaoUsuarioOrm, agora: Date): EstadoSessao {
  if (sessao.revogadoEm) return 'revogada';
  if (sessao.expiraEm.getTime() <= agora.getTime()) return 'expirada';
  return 'ativa';
}

@Injectable()
export class ServicoSessoes {
  constructor(
    private readonly executorTenant: ExecutorTenant,
    private readonly auditoria: ServicoAuditoria
  ) {}

  /**
   * Identificador opaco de uma sessao para uso na interface. E imagem de um MAC
   * sobre o id da sessao com rotulo de finalidade: identifica a linha sem
   * revelar o `sid` que viaja dentro do token.
   */
  referenciaPublica(sessaoId: string): string {
    return createHmac('sha256', obterSegredoAcesso())
      .update(`${ROTULO_REFERENCIA_SESSAO}:${sessaoId}`)
      .digest('hex')
      .slice(0, 32);
  }

  async criar(
    gerenciador: EntityManager,
    entrada: { tenantId: string; usuarioId: string; expiraEm: Date; mfaVerificadoEm?: Date | null }
  ): Promise<SessaoUsuarioOrm> {
    const repositorio = gerenciador.getRepository(SessaoUsuarioOrm);
    const agora = new Date();

    return repositorio.save(
      repositorio.create({
        tenantId: entrada.tenantId,
        usuarioId: entrada.usuarioId,
        ultimaAtividadeEm: agora,
        expiraEm: entrada.expiraEm,
        revogadoEm: null,
        motivoRevogacao: null,
        mfaVerificadoEm: entrada.mfaVerificadoEm ?? null
      })
    );
  }

  /**
   * Fonte compartilhada de verdade consultada pelo guarda a cada requisicao
   * autenticada. E o que faz uma revogacao feita por outra instancia derrubar
   * access tokens que ainda nao expiraram.
   */
  async estaAtiva(tenantId: string, usuarioId: string, sessaoId: string): Promise<boolean> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const sessao = await gerenciador.getRepository(SessaoUsuarioOrm).findOne({
        where: { tenantId, usuarioId, id: sessaoId }
      });

      return Boolean(sessao) && estadoDaSessao(sessao as SessaoUsuarioOrm, new Date()) === 'ativa';
    });
  }

  async listar(
    tenantId: string,
    usuarioId: string,
    sessaoAtualId: string,
    pagina = 1
  ): Promise<PaginaSessoesPublicas> {
    const [sessoes, total] = await this.executorTenant.executar(tenantId, (gerenciador) =>
      gerenciador.getRepository(SessaoUsuarioOrm).findAndCount({
        where: { tenantId, usuarioId },
        order: { ultimaAtividadeEm: 'DESC' },
        skip: (pagina - 1) * LIMITE_SESSOES_POR_PAGINA,
        take: LIMITE_SESSOES_POR_PAGINA
      })
    );

    const agora = new Date();
    return {
      itens: sessoes.map((sessao) => ({
        referencia: this.referenciaPublica(sessao.id),
        criadaEm: sessao.criadoEm.toISOString(),
        ultimaAtividadeEm: sessao.ultimaAtividadeEm.toISOString(),
        expiraEm: sessao.expiraEm.toISOString(),
        estado: estadoDaSessao(sessao, agora),
        atual: sessao.id === sessaoAtualId
      })),
      pagina,
      limite: LIMITE_SESSOES_POR_PAGINA,
      total,
      totalPaginas: Math.max(1, Math.ceil(total / LIMITE_SESSOES_POR_PAGINA))
    };
  }

  async limparHistorico(tenantId: string, usuarioId: string): Promise<number> {
    const agora = new Date();
    const removidos = await this.executorTenant.executar(tenantId, async (gerenciador) => {
      const resultado = await gerenciador
        .getRepository(SessaoUsuarioOrm)
        .createQueryBuilder()
        .delete()
        .from(SessaoUsuarioOrm)
        .where('tenant_id = :tenantId', { tenantId })
        .andWhere('usuario_id = :usuarioId', { usuarioId })
        .andWhere('(revogado_em is not null OR expira_em <= :agora)', { agora })
        .execute();

      return resultado.affected ?? 0;
    });

    await this.auditoria.registrar({
      tenantId,
      usuarioId,
      acao: 'auth.sessao.historico_limpo',
      recursoTipo: 'sessao_usuario',
      metadados: { removidos }
    });

    return removidos;
  }

  async encerrarPorReferencia(tenantId: string, usuarioId: string, referencia: string): Promise<void> {
    const sessoes = await this.executorTenant.executar(tenantId, (gerenciador) =>
      gerenciador.getRepository(SessaoUsuarioOrm).find({ where: { tenantId, usuarioId } })
    );

    const alvo = sessoes.find((sessao) => this.referenciaPublica(sessao.id) === referencia);
    if (!alvo) throw new NotFoundException('Sessão não encontrada.');

    await this.revogar(tenantId, usuarioId, alvo.id, 'encerrada_pelo_usuario');
  }

  async encerrarOutras(tenantId: string, usuarioId: string, sessaoAtualId: string): Promise<number> {
    const sessoes = await this.executorTenant.executar(tenantId, (gerenciador) =>
      gerenciador.getRepository(SessaoUsuarioOrm).find({
        where: { tenantId, usuarioId, revogadoEm: IsNull() }
      })
    );

    let encerradas = 0;
    for (const sessao of sessoes) {
      if (sessao.id === sessaoAtualId) continue;
      if (await this.revogar(tenantId, usuarioId, sessao.id, 'encerrada_outras')) encerradas += 1;
    }

    return encerradas;
  }

  /**
   * Encerra todas as sessoes vivas do usuario. Usado quando a credencial deixa
   * de valer para o parque inteiro, como na redefinicao de senha: sem isto, uma
   * sessao roubada sobrevive a troca de senha da vitima.
   */
  async revogarTodas(tenantId: string, usuarioId: string, motivo: MotivoRevogacaoSessao): Promise<number> {
    const sessoes = await this.executorTenant.executar(tenantId, (gerenciador) =>
      gerenciador.getRepository(SessaoUsuarioOrm).find({
        where: { tenantId, usuarioId, revogadoEm: IsNull() }
      })
    );

    let encerradas = 0;
    for (const sessao of sessoes) {
      if (await this.revogar(tenantId, usuarioId, sessao.id, motivo)) encerradas += 1;
    }

    return encerradas;
  }

  /**
   * Reuso de refresh token consumido, substituido ou revogado: a familia
   * inteira cai, incluindo os descendentes emitidos depois do roubo.
   */
  async revogarPorReuso(tenantId: string, usuarioId: string, sessaoId: string): Promise<void> {
    await this.revogar(tenantId, usuarioId, sessaoId, 'reuso_detectado');
    await this.auditoria.registrar({
      tenantId,
      usuarioId,
      acao: 'auth.sessao.reuso_detectado',
      recursoTipo: 'sessao_usuario',
      recursoId: sessaoId,
      metadados: { deteccao: 'refresh_token_reutilizado', familiaRevogada: true }
    });
  }

  async revogar(
    tenantId: string,
    usuarioId: string,
    sessaoId: string,
    motivo: MotivoRevogacaoSessao
  ): Promise<boolean> {
    const agora = new Date();

    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const resultado = await gerenciador.getRepository(SessaoUsuarioOrm).update(
        { tenantId, usuarioId, id: sessaoId, revogadoEm: IsNull() },
        { revogadoEm: agora, motivoRevogacao: motivo }
      );

      await gerenciador.getRepository(RefreshTokenOrm).update(
        { tenantId, usuarioId, sessaoId, revogadoEm: IsNull() },
        { revogadoEm: agora }
      );

      return (resultado.affected ?? 0) > 0;
    });
  }
}
