import { executarProxyBibliotecaCondutas, lerCorpo, montarConsultaPermitida } from './_proxy';

export async function GET(request: Request) {
  const consulta = montarConsultaPermitida(request, ['pagina', 'limite', 'tipo']);
  return executarProxyBibliotecaCondutas(`/biblioteca-condutas${consulta}`, 'pacientes.ler');
}

export async function POST(request: Request) {
  return executarProxyBibliotecaCondutas('/biblioteca-condutas', 'pacientes.gerenciar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: await lerCorpo(request)
  });
}
