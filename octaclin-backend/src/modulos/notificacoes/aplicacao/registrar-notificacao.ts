import { EntityManager, IsNull } from 'typeorm';
import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';
import { ProfissionalOrm } from '../../profissionais/infraestrutura/profissional.orm';
import { UsuarioOrm } from '../../usuarios/infraestrutura/usuario.orm';
import { destinatariosDaNotificacao } from '../dominio/destinatarios-notificacao';
import { NotificacaoOrm, TipoNotificacao } from '../infraestrutura/notificacao.orm';

export interface EventoNotificavel {
  tipo: TipoNotificacao;
  recursoTipo: string;
  recursoId: string;
  /** Pointer, nao conteudo: o nome sai do cadastro na leitura, sob o escopo de quem le. */
  pacienteId?: string | null;
  /** Dono explicito do evento. Quando ausente, e derivado do paciente. */
  profissionalId?: string | null;
}

/**
 * Grava o evento no centro de notificacoes de cada destinatario.
 *
 * Recebe o `EntityManager` do chamador de proposito: assim a notificacao entra
 * na mesma transacao do fato que a originou. Um envio que deu rollback nao deixa
 * um sino aceso apontando para nada, e um fato gravado sempre tem seu aviso.
 *
 * O erro propaga em vez de ser engolido. Notificacao perdida em silencio e
 * exatamente a falha que esta fase existe para corrigir — o sino que o usuario
 * confia e que nao avisa —, e o unico modo de falha realista aqui (banco fora)
 * ja derrubaria a escrita de origem de qualquer forma. Conflito de reentrega,
 * que e o caso comum, o `orIgnore` abaixo resolve sem erro.
 */
export async function registrarNotificacao(
  gerenciador: EntityManager,
  tenantId: string,
  evento: EventoNotificavel
): Promise<number> {
  const usuarioIdResponsavel = await resolverUsuarioResponsavel(gerenciador, tenantId, evento);

  const usuarios = await gerenciador.getRepository(UsuarioOrm).find({
    select: { id: true, role: true },
    where: { tenantId, ativo: true }
  });

  const destinatarios = destinatariosDaNotificacao(usuarios, usuarioIdResponsavel);
  if (!destinatarios.length) return 0;

  // `orIgnore` casa com o indice unico (tenant, usuario, tipo, recurso): webhook
  // reentregue ou outbox reprocessado nao vira contador inflado.
  const resultado = await gerenciador
    .createQueryBuilder()
    .insert()
    .into(NotificacaoOrm)
    .values(
      destinatarios.map((usuarioId) => ({
        tenantId,
        usuarioId,
        tipo: evento.tipo,
        pacienteId: evento.pacienteId ?? null,
        recursoTipo: evento.recursoTipo,
        recursoId: evento.recursoId
      }))
    )
    .orIgnore()
    .execute();

  return resultado.identifiers.filter(Boolean).length;
}

async function resolverUsuarioResponsavel(
  gerenciador: EntityManager,
  tenantId: string,
  evento: EventoNotificavel
): Promise<string | undefined> {
  const profissionalId = evento.profissionalId ?? (await resolverProfissionalDoPaciente(gerenciador, tenantId, evento.pacienteId));
  if (!profissionalId) return undefined;

  const profissional = await gerenciador.getRepository(ProfissionalOrm).findOne({
    select: { usuarioId: true },
    where: { id: profissionalId, tenantId, arquivadoEm: IsNull() }
  });

  return profissional?.usuarioId;
}

async function resolverProfissionalDoPaciente(
  gerenciador: EntityManager,
  tenantId: string,
  pacienteId?: string | null
): Promise<string | undefined> {
  if (!pacienteId) return undefined;

  const paciente = await gerenciador.getRepository(PacienteOrm).findOne({
    select: { profissionalResponsavelId: true },
    where: { id: pacienteId, tenantId }
  });

  return paciente?.profissionalResponsavelId;
}
