import { executarProxyPlanoAlimentar, lerCorpo } from '../../../../../../pacientes/[id]/planos-alimentares/_proxy';

interface Params {
  params: Promise<{ modeloId: string; numero: string }>;
}

export async function POST(request: Request, props: Params) {
  const { modeloId, numero } = await props.params;
  return executarProxyPlanoAlimentar(
    `/planos-alimentares/modelos/${encodeURIComponent(modeloId)}/versoes/${encodeURIComponent(numero)}/restaurar`,
    'planos_alimentares.gerenciar',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: await lerCorpo(request) }
  );
}
