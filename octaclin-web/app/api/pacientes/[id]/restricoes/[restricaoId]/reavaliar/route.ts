import { tratarReavaliarRestricao } from '@/lib/server/restricoes-prontuario-bff';

export async function POST(request: Request, props: { params: Promise<{ id: string; restricaoId: string }> }) {
  const { id, restricaoId } = await props.params;
  return tratarReavaliarRestricao(request, id, restricaoId);
}
