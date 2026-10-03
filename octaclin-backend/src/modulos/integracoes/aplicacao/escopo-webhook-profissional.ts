import { EntityManager, IsNull } from 'typeorm';
import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';
import { ProfissionalOrm } from '../../profissionais/infraestrutura/profissional.orm';
import { UsuarioOrm } from '../../usuarios/infraestrutura/usuario.orm';
import type { EventoWebhook } from '../dominio/contratos-integracao';
import { PermissaoIntegracaoProfissionalOrm } from '../infraestrutura/permissao-integracao-profissional.orm';
import { WebhookAssinaturaOrm } from '../infraestrutura/webhook-assinatura.orm';

/** Reavalia a autorização antes da fila e antes do envio externo. */
export async function podeEntregarWebhook(
  gerenciador: EntityManager,
  tenantId: string,
  assinatura: WebhookAssinaturaOrm,
  evento: EventoWebhook,
  dados: unknown
): Promise<boolean> {
  if (!assinatura.profissionalUsuarioId) return true;
  const pacienteId = dados && typeof dados === 'object' && 'pacienteId' in dados
    ? (dados as { pacienteId: unknown }).pacienteId
    : undefined;
  if (typeof pacienteId !== 'string') return false;

  const usuario = await gerenciador.getRepository(UsuarioOrm).findOne({
    where: { id: assinatura.profissionalUsuarioId, tenantId, role: 'Professional', ativo: true }
  });
  if (!usuario) return false;

  const concessao = await gerenciador.getRepository(PermissaoIntegracaoProfissionalOrm).findOne({
    where: { tenantId, usuarioId: usuario.id, tipo: 'webhook', revogadaEm: IsNull() }
  });
  if (!concessao?.eventosWebhook.includes(evento)) return false;

  const profissional = await gerenciador.getRepository(ProfissionalOrm).findOne({
    where: { tenantId, usuarioId: usuario.id, arquivadoEm: IsNull() }
  });
  if (!profissional) return false;

  const paciente = await gerenciador.getRepository(PacienteOrm).findOne({
    where: { id: pacienteId, tenantId, profissionalResponsavelId: profissional.id, arquivadoEm: IsNull() }
  });
  return Boolean(paciente);
}
