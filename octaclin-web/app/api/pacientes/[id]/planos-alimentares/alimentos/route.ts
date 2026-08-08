import { executarProxyPlanoAlimentar } from '../_proxy';

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, props: Params) {
  await props.params;
  const busca = new URL(request.url).searchParams.get('busca') ?? '';
  return executarProxyPlanoAlimentar(
    `/planos-alimentares/alimentos?busca=${encodeURIComponent(busca)}`,
    'planos_alimentares.ler'
  );
}
