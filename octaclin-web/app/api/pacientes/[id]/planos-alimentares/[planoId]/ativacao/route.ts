import { executarProxyPlanoAlimentar, lerCorpo } from '../../_proxy';

interface Params { params: Promise<{ id: string; planoId: string }> }

export async function PUT(request: Request, props: Params) {
  const { id, planoId } = await props.params;
  return executarProxyPlanoAlimentar(
    `/pacientes/${encodeURIComponent(id)}/planos-alimentares/${encodeURIComponent(planoId)}/ativacao`,
    'planos_alimentares.gerenciar',
    { method: 'PUT', body: await lerCorpo(request) },
    2048
  );
}
