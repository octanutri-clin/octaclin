import { executarProxyPlanoAlimentar } from '../../../../_proxy';

interface Params { params: Promise<{ id: string; planoId: string }> }
const LIMITE_CORPO_PREVIA = 8 * 1024;

// A permissão é exigida antes de ler o corpo; o proxy lê o corpo com limite e
// responde 400/413 sem expor detalhes (revisão R4 da #455).
export async function POST(request: Request, props: Params) {
  const { id, planoId } = await props.params;
  return executarProxyPlanoAlimentar(
    `/pacientes/${encodeURIComponent(id)}/planos-alimentares/${encodeURIComponent(planoId)}/rascunho/previa-micronutrientes/confirmar`,
    'planos_alimentares.gerenciar',
    { method: 'POST' },
    LIMITE_CORPO_PREVIA,
    request
  );
}
