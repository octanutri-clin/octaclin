import { executarProxyPlanoAlimentar, lerCorpo } from '../../../pacientes/[id]/planos-alimentares/_proxy';

export async function POST(request: Request) {
  return executarProxyPlanoAlimentar('/planos-alimentares/receitas/compartilhamentos', 'planos_alimentares.gerenciar', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: await lerCorpo(request)
  });
}
