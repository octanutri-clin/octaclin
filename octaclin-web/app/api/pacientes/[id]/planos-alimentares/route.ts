import { lerCorpo, executarProxyPlanoAlimentar } from './_proxy';

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, props: Params) {
  const { id } = await props.params;
  return executarProxyPlanoAlimentar(
    `/pacientes/${encodeURIComponent(id)}/planos-alimentares`,
    'planos_alimentares.ler'
  );
}

export async function POST(request: Request, props: Params) {
  const { id } = await props.params;
  return executarProxyPlanoAlimentar(
    `/pacientes/${encodeURIComponent(id)}/planos-alimentares`,
    'planos_alimentares.gerenciar',
    { method: 'POST', body: await lerCorpo(request) }
  );
}
