import { executarProxyCatalogoMarcadores } from '../_proxy';

interface Params {
  params: Promise<{ itemId: string }>;
}

export async function DELETE(_request: Request, props: Params) {
  const { itemId } = await props.params;
  return executarProxyCatalogoMarcadores(`/exames/marcadores/${encodeURIComponent(itemId)}`, 'pacientes.gerenciar', {
    method: 'DELETE'
  });
}
