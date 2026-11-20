import { tratarDisponibilidadeEquipe } from '@/lib/server/restricoes-equipe-bff';

export async function GET() {
  return tratarDisponibilidadeEquipe();
}
