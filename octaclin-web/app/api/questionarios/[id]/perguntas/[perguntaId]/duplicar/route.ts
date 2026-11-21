import { atenderCopiaPergunta } from '@/lib/server/copia-pergunta-bff';

interface Params {
  params: Promise<{ id: string; perguntaId: string }>;
}

export async function POST(request: Request, props: Params) {
  const params = await props.params;
  return atenderCopiaPergunta(request, params, true);
}
