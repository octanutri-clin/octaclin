import { executarProxyPlanoAlimentar, montarConsultaPermitida } from '../_proxy';

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, props: Params) {
  await props.params;
  const consulta = montarConsultaPermitida(request, [
    'busca',
    'pagina',
    'limite',
    'fonteCodigo',
    'versao',
    'baseCodigo'
  ]);
  return executarProxyPlanoAlimentar(
    `/planos-alimentares/alimentos${consulta}`,
    'planos_alimentares.ler'
  );
}
