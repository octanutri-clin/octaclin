import { tratarListarRepresentantes } from '@/lib/server/restricoes-equipe-bff';

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  return tratarListarRepresentantes(request, id);
}
