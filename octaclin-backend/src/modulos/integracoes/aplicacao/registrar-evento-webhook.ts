import { ArrayContains, EntityManager } from 'typeorm';
import type { EventoWebhook } from '../dominio/contratos-integracao';
import { WebhookAssinaturaOrm } from '../infraestrutura/webhook-assinatura.orm';
import { WebhookEntregaOrm } from '../infraestrutura/webhook-entrega.orm';

export async function registrarEventoWebhook(
  gerenciador: EntityManager,
  tenantId: string,
  entrada: {
    evento: EventoWebhook;
    recursoTipo: string;
    recursoId: string;
    dados: Record<string, unknown>;
    ocorridoEm?: Date;
  }
): Promise<void> {
  const assinaturas = await gerenciador.getRepository(WebhookAssinaturaOrm).find({
    where: { tenantId, ativo: true, eventos: ArrayContains([entrada.evento]) }
  });
  if (!assinaturas.length) return;

  const ocorridoEm = (entrada.ocorridoEm ?? new Date()).toISOString();
  const repositorio = gerenciador.getRepository(WebhookEntregaOrm);
  await repositorio
    .createQueryBuilder()
    .insert()
    .values(
      assinaturas.map((assinatura) => ({
        tenantId,
        assinaturaId: assinatura.id,
        evento: entrada.evento,
        recursoTipo: entrada.recursoTipo,
        recursoId: entrada.recursoId,
        payload: {
          versao: '2026-08-01',
          evento: entrada.evento,
          ocorridoEm,
          dados: entrada.dados
        },
        status: 'pendente' as const,
        tentativas: 0,
        proximaTentativaEm: new Date()
      }))
    )
    .orIgnore()
    .execute();
}
