import { tratarListarRestricoesProntuario } from '@/lib/server/restricoes-prontuario-bff';

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  return tratarListarRestricoesProntuario(request, id);
}
