import { tratarSeletorRestricoesPortal } from '@/lib/server/restricoes-portal-bff';

export async function POST(request: Request) {
  return tratarSeletorRestricoesPortal(request);
}
