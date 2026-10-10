import { executarProxyPlanoAlimentar } from '../../../../../../pacientes/[id]/planos-alimentares/_proxy';

interface Params { params: Promise<{ pacienteId: string }> }

export async function GET(_request: Request, props: Params) {
  const { pacienteId } = await props.params;
  return executarProxyPlanoAlimentar(
    `/planos-alimentares/receitas/compartilhamentos/pacientes/${encodeURIComponent(pacienteId)}/preferencias`,
    'planos_alimentares.ler'
  );
}
