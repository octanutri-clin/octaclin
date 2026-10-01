import { executarProxyPlanoAlimentar } from '../../../../../pacientes/[id]/planos-alimentares/_proxy';

interface Params {
  params: Promise<{ modeloId: string; numero: string }>;
}

export async function GET(_request: Request, props: Params) {
  const { modeloId, numero } = await props.params;
  return executarProxyPlanoAlimentar(
    `/planos-alimentares/modelos/${encodeURIComponent(modeloId)}/versoes/${encodeURIComponent(numero)}`,
    'planos_alimentares.ler'
  );
}
