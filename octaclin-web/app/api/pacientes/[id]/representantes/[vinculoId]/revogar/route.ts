import { tratarRevogarRepresentante } from '@/lib/server/restricoes-equipe-bff';

export async function POST(request: Request, props: { params: Promise<{ id: string; vinculoId: string }> }) {
  const { id, vinculoId } = await props.params;
  return tratarRevogarRepresentante(request, id, vinculoId);
}
