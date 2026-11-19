import { tratarConcederDelegacao } from '@/lib/server/restricoes-equipe-bff';

export async function POST(request: Request) {
  return tratarConcederDelegacao(request);
}
