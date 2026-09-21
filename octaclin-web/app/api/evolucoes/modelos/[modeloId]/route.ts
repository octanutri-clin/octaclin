import { executarProxyModelosEvolucao } from '../_proxy';

interface Params {
  params: Promise<{ modeloId: string }>;
}

export async function GET(_request: Request, props: Params) {
  const { modeloId } = await props.params;
  return executarProxyModelosEvolucao(`/evolucoes/modelos/${encodeURIComponent(modeloId)}`, 'pacientes.ler');
}

export async function DELETE(_request: Request, props: Params) {
  const { modeloId } = await props.params;
  return executarProxyModelosEvolucao(`/evolucoes/modelos/${encodeURIComponent(modeloId)}`, 'pacientes.gerenciar', {
    method: 'DELETE'
  });
}
