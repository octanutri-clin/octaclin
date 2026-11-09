import { executarProxyPlanoAlimentar } from '../_proxy';

interface Params { params: Promise<{ id: string }> }
const LIMITE_CORPO_CALCULO = 64 * 1024;

// A permissão é exigida antes de ler o corpo; o proxy lê o corpo com limite e
// responde 400/413 sem expor detalhes (revisão R4 da #455).
export async function POST(request: Request, props: Params) {
  const { id } = await props.params;
  return executarProxyPlanoAlimentar(
    `/pacientes/${encodeURIComponent(id)}/planos-alimentares/analise-micronutrientes`,
    'planos_alimentares.ler',
    { method: 'POST' },
    LIMITE_CORPO_CALCULO,
    request
  );
}
