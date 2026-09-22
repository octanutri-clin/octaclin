import { executarProxyModelosEvolucao, lerCorpo, montarConsultaPermitida } from './_proxy';

export async function GET(request: Request) {
  const consulta = montarConsultaPermitida(request, ['pagina', 'limite', 'origem']);
  return executarProxyModelosEvolucao(`/evolucoes/modelos${consulta}`, 'pacientes.ler');
}

export async function POST(request: Request) {
  return executarProxyModelosEvolucao('/evolucoes/modelos', 'pacientes.gerenciar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: await lerCorpo(request)
  });
}
