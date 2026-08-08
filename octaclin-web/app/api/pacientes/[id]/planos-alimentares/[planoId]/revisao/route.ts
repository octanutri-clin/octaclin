import { executarProxyPlanoAlimentar } from '../../_proxy';

interface Params { params: Promise<{ id: string; planoId: string }> }

export async function POST(_request: Request, props: Params) {
  const { id, planoId } = await props.params;
  return executarProxyPlanoAlimentar(
    `/pacientes/${encodeURIComponent(id)}/planos-alimentares/${encodeURIComponent(planoId)}/revisao`,
    'planos_alimentares.gerenciar',
    { method: 'POST', body: '{}' }
  );
}
