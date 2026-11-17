import { tratarDisponibilidadeRestricoes } from '@/lib/server/restricoes-portal-bff';

export async function GET() {
  return tratarDisponibilidadeRestricoes();
}
