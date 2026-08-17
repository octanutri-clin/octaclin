import { executarProxyPlanoAlimentar } from '../../../_proxy';

interface Params {
  params: Promise<{ id: string; planoId: string; numero: string }>;
}

export async function GET(_request: Request, props: Params) {
  const { id, planoId, numero } = await props.params;
  return executarProxyPlanoAlimentar(
    `/pacientes/${encodeURIComponent(id)}/planos-alimentares/${encodeURIComponent(planoId)}/versoes/${encodeURIComponent(numero)}`,
    'planos_alimentares.ler'
  );
}
