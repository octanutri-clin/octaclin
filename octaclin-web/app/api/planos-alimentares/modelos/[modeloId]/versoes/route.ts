import { executarProxyPlanoAlimentar, montarConsultaPermitida } from '../../../../pacientes/[id]/planos-alimentares/_proxy';

interface Params {
  params: Promise<{ modeloId: string }>;
}

export async function GET(request: Request, props: Params) {
  const { modeloId } = await props.params;
  const consulta = montarConsultaPermitida(request, ['pagina', 'limite']);
  return executarProxyPlanoAlimentar(
    `/planos-alimentares/modelos/${encodeURIComponent(modeloId)}/versoes${consulta}`,
    'planos_alimentares.ler'
  );
}
