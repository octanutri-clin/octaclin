import { NextRequest } from 'next/server';
import { tratarOperacaoPiloto } from '@/lib/server/gamificacao-piloto-bff';

export function POST(request: NextRequest) {
  return tratarOperacaoPiloto(request, false);
}
