import { executarProxyPlanoAlimentar } from '../../../../pacientes/[id]/planos-alimentares/_proxy';

interface Params { params: Promise<{ compartilhamentoId: string }> }

export async function DELETE(_request: Request, props: Params) {
  const { compartilhamentoId } = await props.params;
  return executarProxyPlanoAlimentar(
    `/planos-alimentares/receitas/compartilhamentos/${encodeURIComponent(compartilhamentoId)}`,
    'planos_alimentares.gerenciar',
    { method: 'DELETE' }
  );
}
