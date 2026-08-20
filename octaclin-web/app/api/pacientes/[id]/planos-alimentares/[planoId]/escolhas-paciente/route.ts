import { executarProxyPlanoAlimentar, montarConsultaPermitida } from '../../_proxy';

interface Params {
  params: Promise<{ id: string; planoId: string }>;
}

export async function GET(request: Request, props: Params) {
  const { id, planoId } = await props.params;
  const consulta = montarConsultaPermitida(request, ['pagina', 'limite']);
  return executarProxyPlanoAlimentar(
    `/pacientes/${encodeURIComponent(id)}/planos-alimentares/${encodeURIComponent(planoId)}/escolhas-paciente${consulta}`,
    'planos_alimentares.ler'
  );
}
