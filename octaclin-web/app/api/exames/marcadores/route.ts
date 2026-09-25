import { executarProxyCatalogoMarcadores, montarConsultaCatalogo } from './_proxy';

export async function GET(request: Request) {
  return executarProxyCatalogoMarcadores(`/exames/marcadores${montarConsultaCatalogo(request)}`, 'pacientes.ler');
}

export async function POST(request: Request) {
  return executarProxyCatalogoMarcadores('/exames/marcadores', 'pacientes.gerenciar', async () => ({
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: await request.text()
  }));
}
