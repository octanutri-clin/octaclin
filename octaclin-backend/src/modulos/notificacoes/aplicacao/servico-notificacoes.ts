import { ForbiddenException, Injectable } from '@nestjs/common';
import { EntityManager, In, IsNull } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { UsuarioOrm } from '../../usuarios/infraestrutura/usuario.orm';
import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';
import { NotificacaoOrm, TipoNotificacao } from '../infraestrutura/notificacao.orm';
import { PreferenciaNotificacaoUsuarioOrm } from '../infraestrutura/preferencia-notificacao-usuario.orm';
import { ResumoNotificacaoUsuarioOrm } from '../infraestrutura/resumo-notificacao-usuario.orm';

const LIMITE_PADRAO = 20;

export interface ItemNotificacao {
  id: string;
  tipo: TipoNotificacao;
  pacienteId?: string | null;
  pacienteNome?: string;
  recursoTipo: string;
  recursoId: string;
  lidoEm?: Date | null;
  criadoEm: Date;
}

export interface CentralNotificacoes {
  naoLidas: number;
  itens: ItemNotificacao[];
  resumos: ItemResumoNotificacao[];
}

export interface ItemResumoNotificacao {
  id: string;
  periodoInicioEm: Date;
  periodoFimEm: Date;
  geradoEm: Date;
  lidoEm?: Date | null;
  contagens: Record<string, number>;
  estadoEmail: string;
}

/**
 * Toda consulta filtra por `usuarioId` vindo do JWT, nunca por id de requisicao:
 * o isolamento entre usuarios (e entre profissionais) e a propria clausula, nao
 * uma verificacao a parte que alguem pode esquecer de chamar.
 */
@Injectable()
export class ServicoNotificacoes {
  constructor(
    private readonly executorTenant: ExecutorTenant,
    private readonly criptografia: CriptografiaDadosSensiveis
  ) {}

  async listar(usuario: UsuarioAutenticado, limite = LIMITE_PADRAO): Promise<CentralNotificacoes> {
    return this.executorTenant.executar(usuario.tenantId, async (gerenciador) => {
      const repositorio = gerenciador.getRepository(NotificacaoOrm);
      const escopoDoUsuario = { tenantId: usuario.tenantId, usuarioId: usuario.usuarioId };

      const [notificacoes, naoLidasNotificacoes, resumos, naoLidosResumos] = await Promise.all([
        repositorio.find({
          where: { ...escopoDoUsuario, modoEntrega: 'imediato' },
          order: { criadoEm: 'DESC' },
          take: limite
        }),
        repositorio.count({ where: { ...escopoDoUsuario, modoEntrega: 'imediato', lidoEm: IsNull() } }),
        gerenciador.getRepository(ResumoNotificacaoUsuarioOrm).find({
          where: escopoDoUsuario,
          order: { geradoEm: 'DESC', id: 'DESC' },
          take: 10
        }),
        gerenciador.getRepository(ResumoNotificacaoUsuarioOrm).count({ where: { ...escopoDoUsuario, lidoEm: IsNull() } })
      ]);

      const nomes = await this.nomesDosPacientes(gerenciador, usuario.tenantId, notificacoes);

      return {
        naoLidas: naoLidasNotificacoes + naoLidosResumos,
        itens: notificacoes.map((notificacao) => ({
          id: notificacao.id,
          tipo: notificacao.tipo,
          pacienteId: notificacao.pacienteId,
          ...(notificacao.pacienteId && nomes.has(notificacao.pacienteId)
            ? { pacienteNome: nomes.get(notificacao.pacienteId) }
            : {}),
          recursoTipo: notificacao.recursoTipo,
          recursoId: notificacao.recursoId,
          lidoEm: notificacao.lidoEm,
          criadoEm: notificacao.criadoEm
        })),
        resumos: resumos.map((resumo) => ({
          id: resumo.id,
          periodoInicioEm: resumo.periodoInicioEm,
          periodoFimEm: resumo.periodoFimEm,
          geradoEm: resumo.geradoEm,
          lidoEm: resumo.lidoEm,
          contagens: resumo.contagens,
          estadoEmail: resumo.estadoEmail
        }))
      };
    });
  }

  async marcarLidas(usuario: UsuarioAutenticado, ids?: string[], idsResumos?: string[]): Promise<{ marcadas: number; resumosMarcados: number }> {
    return this.executorTenant.executar(usuario.tenantId, async (gerenciador) => {
      const marcarTudo = ids === undefined && idsResumos === undefined;
      const notificacoesMarcadas = marcarTudo || ids !== undefined && ids.length > 0
        ? await gerenciador.getRepository(NotificacaoOrm).update({
          tenantId: usuario.tenantId,
          usuarioId: usuario.usuarioId,
          modoEntrega: 'imediato',
          lidoEm: IsNull(),
          ...(ids === undefined ? {} : { id: In(ids) })
        }, { lidoEm: new Date() })
        : { affected: 0 };
      const resumosMarcados = marcarTudo || idsResumos !== undefined && idsResumos.length > 0
        ? await gerenciador.getRepository(ResumoNotificacaoUsuarioOrm).update({
          tenantId: usuario.tenantId,
          usuarioId: usuario.usuarioId,
          lidoEm: IsNull(),
          ...(idsResumos === undefined ? {} : { id: In(idsResumos) })
        }, { lidoEm: new Date() })
        : { affected: 0 };

      return {
        marcadas: notificacoesMarcadas.affected ?? 0,
        resumosMarcados: resumosMarcados.affected ?? 0
      };
    });
  }

  async gerarResumoPendente(usuario: UsuarioAutenticado): Promise<{ gerado: boolean }> {
    return this.executorTenant.executar(usuario.tenantId, async (gerenciador) => {
      // Serializa também quando ainda não existe resumo/linha de digest para
      // travar. O advisory lock é por tenant+usuário e vive até o commit.
      await gerenciador.query(
        "select pg_advisory_xact_lock(hashtextextended($1::text || ':' || $2::text, 0))",
        [usuario.tenantId, usuario.usuarioId]
      );
      const usuarioAtual = await gerenciador.getRepository(UsuarioOrm).findOne({
        select: { id: true, ativo: true, role: true },
        where: { id: usuario.usuarioId, tenantId: usuario.tenantId },
        lock: { mode: 'pessimistic_write' }
      });
      if (!usuarioAtual?.ativo || usuarioAtual.role !== usuario.papel ||
          !['SuperAdmin', 'Professional', 'Collaborator'].includes(usuarioAtual.role) ||
          !usuario.permissoes.includes('console.acessar')) {
        throw new ForbiddenException('Usuario sem acesso a notificacoes.');
      }
      const preferencias = await gerenciador.getRepository(PreferenciaNotificacaoUsuarioOrm).findOne({
        where: { tenantId: usuario.tenantId, usuarioId: usuario.usuarioId }
      });
      const pendentes = await gerenciador.query(`
        select id, tipo, criado_em, email_resumo, email_cancelado_em
        from notificacoes
        where tenant_id = $1 and usuario_id = $2
          and modo_entrega in ('diario', 'semanal')
          and resumo_previsto_em <= transaction_timestamp()
          and resumo_id is null
        order by resumo_previsto_em, criado_em, id
        for update
      `, [usuario.tenantId, usuario.usuarioId]) as Array<{
        id: string;
        tipo: NotificacaoOrm['tipo'];
        criado_em: Date;
        email_resumo: boolean;
        email_cancelado_em: Date | null;
      }>;
      if (!pendentes.length) return { gerado: false };

      const resumos = await gerenciador.query(`
        insert into resumos_notificacao_usuario
          (tenant_id, usuario_id, periodo_inicio_em, periodo_fim_em)
        values ($1, $2, $3, $4)
        returning id
      `, [
        usuario.tenantId,
        usuario.usuarioId,
        pendentes.reduce((menor, notificacao) => notificacao.criado_em < menor ? notificacao.criado_em : menor, pendentes[0].criado_em),
        pendentes.reduce((maior, notificacao) => notificacao.criado_em > maior ? notificacao.criado_em : maior, pendentes[0].criado_em)
      ]) as Array<{ id: string }>;
      const resumoId = resumos[0]?.id;
      if (!resumoId) throw new Error('Não foi possível criar o resumo de notificações.');

      const resultadoVinculacao = await gerenciador.query(`
        update notificacoes
        set resumo_id = $3
        where tenant_id = $1 and usuario_id = $2 and resumo_id is null
          and id = any($4::uuid[])
        returning tipo, email_resumo, email_cancelado_em
      `, [usuario.tenantId, usuario.usuarioId, resumoId, pendentes.map(({ id }) => id)]) as [Array<{
        tipo: NotificacaoOrm['tipo'];
        email_resumo: boolean;
        email_cancelado_em: Date | null;
      }>, number];
      const vinculadas = resultadoVinculacao[0] ?? [];
      if (!vinculadas.length) {
        await gerenciador.query(
          'delete from resumos_notificacao_usuario where tenant_id = $1 and usuario_id = $2 and id = $3',
          [usuario.tenantId, usuario.usuarioId, resumoId]
        );
        return { gerado: false };
      }

      const tipos = ['formulario_respondido', 'tarefa_concluida', 'automacao_executada'] as const;
      const contagens = Object.fromEntries(tipos.map((tipo) => [tipo, vinculadas.filter((notificacao) => notificacao.tipo === tipo).length]));
      const contagensEmail = Object.fromEntries(tipos.map((tipo) => [
        tipo,
        vinculadas.filter((notificacao) => notificacao.tipo === tipo && notificacao.email_resumo && notificacao.email_cancelado_em === null).length
      ]));
      const totalEmail = Object.values(contagensEmail).reduce((total, quantidade) => total + quantidade, 0);
      const algumOptinEmail = vinculadas.some((notificacao) => notificacao.email_resumo);
      const estadoEmail = totalEmail > 0 && preferencias?.emailResumo === true
        ? 'pendente'
        : algumOptinEmail ? 'cancelado' : 'nao_solicitado';

      await gerenciador.query(`
        update resumos_notificacao_usuario
        set contagens = $4::jsonb, contagens_email = $5::jsonb, estado_email = $6
        where tenant_id = $1 and usuario_id = $2 and id = $3
      `, [usuario.tenantId, usuario.usuarioId, resumoId, JSON.stringify(contagens), JSON.stringify(contagensEmail), estadoEmail]);
      return { gerado: true };
    });
  }

  /**
   * O nome sai do cadastro na leitura, sob o escopo de quem le. A tabela de
   * notificacoes guarda so o id, entao ela nao vira uma segunda copia em claro
   * do nome do paciente.
   */
  private async nomesDosPacientes(
    gerenciador: EntityManager,
    tenantId: string,
    notificacoes: NotificacaoOrm[]
  ): Promise<Map<string, string>> {
    const ids = [...new Set(notificacoes.map((notificacao) => notificacao.pacienteId).filter((id): id is string => Boolean(id)))];
    if (!ids.length) return new Map();

    const pacientes = await gerenciador.getRepository(PacienteOrm).find({
      select: { id: true, nomeCriptografado: true },
      where: { tenantId, id: In(ids) }
    });

    return new Map(pacientes.map((paciente) => [paciente.id, this.criptografia.descriptografar(paciente.nomeCriptografado)]));
  }
}
