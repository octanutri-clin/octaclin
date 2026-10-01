import { executarProxyPlanoAlimentar, montarConsultaPermitida } from '../../pacientes/[id]/planos-alimentares/_proxy';

export async function GET(request: Request) {
  const consulta = montarConsultaPermitida(request, [
    'busca', 'pagina', 'limite', 'fonteCodigo', 'versao', 'baseCodigo'
  ]);
  return executarProxyPlanoAlimentar(`/planos-alimentares/alimentos${consulta}`, 'planos_alimentares.ler');
}
