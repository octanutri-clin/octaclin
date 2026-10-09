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
      const filas = await gerenciador.query(`
        with pendentes as materialized (
          select id, tenant_id, usuario_id, tipo, criado_em, email_resumo, email_cancelado_em
          from notificacoes
          where tenant_id = $1 and usuario_id = $2
            and modo_entrega in ('diario', 'semanal')
            and resumo_previsto_em <= transaction_timestamp()
            and resumo_id is null
          order by resumo_previsto_em, criado_em, id
          for update
        ),
        resumo_novo as (
          insert into resumos_notificacao_usuario
            (tenant_id, usuario_id, periodo_inicio_em, periodo_fim_em)
          select $1, $2, min(criado_em), max(criado_em)
          from pendentes
          having count(*) > 0
          returning id
        ),
        vinculadas as (
          update notificacoes n
          set resumo_id = (select id from resumo_novo)
          from pendentes p
          where n.id = p.id and n.tenant_id = $1 and n.usuario_id = $2
          returning n.tipo, n.criado_em, n.email_resumo, n.email_cancelado_em
        ),
        agregado as (
          select
            (select id from resumo_novo) as resumo_id,
            jsonb_build_object(
              'formulario_respondido', count(*) filter (where tipo = 'formulario_respondido'),
              'tarefa_concluida', count(*) filter (where tipo = 'tarefa_concluida'),
              'automacao_executada', count(*) filter (where tipo = 'automacao_executada')
            ) as contagens,
            jsonb_build_object(
              'formulario_respondido', count(*) filter (where tipo = 'formulario_respondido' and email_resumo and email_cancelado_em is null),
              'tarefa_concluida', count(*) filter (where tipo = 'tarefa_concluida' and email_resumo and email_cancelado_em is null),
              'automacao_executada', count(*) filter (where tipo = 'automacao_executada' and email_resumo and email_cancelado_em is null)
            ) as contagens_email,
            bool_or(email_resumo) as algum_optin_email
          from vinculadas
        )
        update resumos_notificacao_usuario r
        set contagens = a.contagens,
            contagens_email = a.contagens_email,
            estado_email = case
              when (a.contagens_email->>'formulario_respondido')::numeric
                 + (a.contagens_email->>'tarefa_concluida')::numeric
                 + (a.contagens_email->>'automacao_executada')::numeric > 0 and $3::boolean then 'pendente'
              when a.algum_optin_email then 'cancelado'
              else 'nao_solicitado'
            end
        from agregado a
        where a.resumo_id is not null and r.id = a.resumo_id
          and r.tenant_id = $1 and r.usuario_id = $2
        returning r.id
      `, [usuario.tenantId, usuario.usuarioId, preferencias?.emailResumo === true]);
      return { gerado: filas.length > 0 };
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
