import { tratarRevogarDelegacao } from '@/lib/server/restricoes-equipe-bff';

export async function POST(request: Request, props: { params: Promise<{ delegacaoId: string }> }) {
  const { delegacaoId } = await props.params;
  return tratarRevogarDelegacao(request, delegacaoId);
}
