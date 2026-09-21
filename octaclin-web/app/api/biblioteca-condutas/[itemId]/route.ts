import { executarProxyBibliotecaCondutas } from '../_proxy';

interface Params {
  params: Promise<{ itemId: string }>;
}

export async function GET(_request: Request, props: Params) {
  const { itemId } = await props.params;
  return executarProxyBibliotecaCondutas(`/biblioteca-condutas/${encodeURIComponent(itemId)}`, 'pacientes.ler');
}

export async function DELETE(_request: Request, props: Params) {
  const { itemId } = await props.params;
  return executarProxyBibliotecaCondutas(`/biblioteca-condutas/${encodeURIComponent(itemId)}`, 'pacientes.gerenciar', {
    method: 'DELETE'
  });
}
