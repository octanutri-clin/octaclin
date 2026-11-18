import { tratarCancelarPedidoPortal } from '@/lib/server/restricoes-portal-bff';

export async function POST(request: Request, props: { params: Promise<{ pacienteId: string; solicitacaoId: string }> }) {
  const { pacienteId, solicitacaoId } = await props.params;
  return tratarCancelarPedidoPortal(request, pacienteId, solicitacaoId);
}
