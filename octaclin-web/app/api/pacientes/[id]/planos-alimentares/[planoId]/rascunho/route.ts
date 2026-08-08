import { executarProxyPlanoAlimentar, lerCorpo } from '../../_proxy';

interface Params {
  params: Promise<{ id: string; planoId: string }>;
}

function caminho(id: string, planoId: string) {
  return `/pacientes/${encodeURIComponent(id)}/planos-alimentares/${encodeURIComponent(planoId)}/rascunho`;
}

export async function GET(_request: Request, props: Params) {
  const { id, planoId } = await props.params;
  return executarProxyPlanoAlimentar(caminho(id, planoId), 'planos_alimentares.ler');
}

export async function PUT(request: Request, props: Params) {
  const { id, planoId } = await props.params;
  return executarProxyPlanoAlimentar(caminho(id, planoId), 'planos_alimentares.gerenciar', {
    method: 'PUT',
    body: await lerCorpo(request)
  });
}
