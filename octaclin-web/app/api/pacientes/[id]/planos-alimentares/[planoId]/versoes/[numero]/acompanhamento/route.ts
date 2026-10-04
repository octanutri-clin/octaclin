import { executarProxyPlanoAlimentar, montarConsultaPermitida } from '../../../../_proxy';

interface Params {
  params: Promise<{ id: string; planoId: string; numero: string }>;
}

export async function GET(request: Request, props: Params) {
  const { id, planoId, numero } = await props.params;
  const consulta = montarConsultaPermitida(request, [
    'paginaCheckins',
    'paginaQuestionarios',
    'paginaEscolhas',
    'limite'
  ]);
  return executarProxyPlanoAlimentar(
    `/pacientes/${encodeURIComponent(id)}/planos-alimentares/${encodeURIComponent(planoId)}/versoes/${encodeURIComponent(numero)}/acompanhamento${consulta}`,
    'planos_alimentares.ler'
  );
}
