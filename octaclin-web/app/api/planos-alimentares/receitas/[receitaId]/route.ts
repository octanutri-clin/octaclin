import { executarProxyPlanoAlimentar, lerCorpo } from '../../../pacientes/[id]/planos-alimentares/_proxy';

interface Params {
  params: Promise<{ receitaId: string }>;
}

export async function GET(_request: Request, props: Params) {
  const { receitaId } = await props.params;
  return executarProxyPlanoAlimentar(
    `/planos-alimentares/receitas/${encodeURIComponent(receitaId)}`,
    'planos_alimentares.ler'
  );
}

export async function PUT(request: Request, props: Params) {
  const { receitaId } = await props.params;
  return executarProxyPlanoAlimentar(
    `/planos-alimentares/receitas/${encodeURIComponent(receitaId)}`,
    'planos_alimentares.gerenciar',
    { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: await lerCorpo(request) }
  );
}

export async function DELETE(_request: Request, props: Params) {
  const { receitaId } = await props.params;
  return executarProxyPlanoAlimentar(
    `/planos-alimentares/receitas/${encodeURIComponent(receitaId)}`,
    'planos_alimentares.gerenciar',
    { method: 'DELETE' }
  );
}
