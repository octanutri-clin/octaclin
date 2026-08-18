import {
  executarProxyPlanoAlimentar,
  lerCorpo,
  montarConsultaPermitida
} from '../../pacientes/[id]/planos-alimentares/_proxy';

// Modelos nao sao escopados por paciente, entao a rota vive fora de
// `/pacientes/[id]`; o helper de proxy continua sendo o mesmo.
export async function GET(request: Request) {
  const consulta = montarConsultaPermitida(request, ['pagina', 'limite', 'origem']);
  return executarProxyPlanoAlimentar(`/planos-alimentares/modelos${consulta}`, 'planos_alimentares.ler');
}

export async function POST(request: Request) {
  return executarProxyPlanoAlimentar('/planos-alimentares/modelos', 'planos_alimentares.gerenciar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: await lerCorpo(request)
  });
}
