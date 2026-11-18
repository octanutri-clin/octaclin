import { tratarCriarPedidoPortal } from '@/lib/server/restricoes-portal-bff';

export async function POST(request: Request, props: { params: Promise<{ pacienteId: string }> }) {
  const { pacienteId } = await props.params;
  return tratarCriarPedidoPortal(request, pacienteId);
}
