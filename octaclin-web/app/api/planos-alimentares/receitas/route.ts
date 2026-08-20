import {
  executarProxyPlanoAlimentar,
  lerCorpo,
  montarConsultaPermitida
} from '../../pacientes/[id]/planos-alimentares/_proxy';

export async function GET(request: Request) {
  const consulta = montarConsultaPermitida(request, ['pagina', 'limite', 'origem', 'tipo']);
  return executarProxyPlanoAlimentar(`/planos-alimentares/receitas${consulta}`, 'planos_alimentares.ler');
}

export async function POST(request: Request) {
  return executarProxyPlanoAlimentar('/planos-alimentares/receitas', 'planos_alimentares.gerenciar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: await lerCorpo(request)
  });
}
