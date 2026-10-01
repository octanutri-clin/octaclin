import { executarProxyPlanoAlimentar, lerCorpo } from '../../../pacientes/[id]/planos-alimentares/_proxy';

interface Params {
  params: Promise<{ modeloId: string }>;
}

export async function GET(_request: Request, props: Params) {
  const { modeloId } = await props.params;
  return executarProxyPlanoAlimentar(
    `/planos-alimentares/modelos/${encodeURIComponent(modeloId)}`,
    'planos_alimentares.ler'
  );
}

export async function DELETE(_request: Request, props: Params) {
  const { modeloId } = await props.params;
  return executarProxyPlanoAlimentar(
    `/planos-alimentares/modelos/${encodeURIComponent(modeloId)}`,
    'planos_alimentares.gerenciar',
    { method: 'DELETE' }
  );
}

export async function PUT(request: Request, props: Params) {
  const { modeloId } = await props.params;
  return executarProxyPlanoAlimentar(
    `/planos-alimentares/modelos/${encodeURIComponent(modeloId)}`,
    'planos_alimentares.gerenciar',
    { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: await lerCorpo(request) }
  );
}
