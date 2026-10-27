import { encaminhar, lerCorpoBiblioteca } from '../../../planos-alimentares/alimentos-personalizados/_proxy';
export async function GET(request: Request): Promise<Response> {
  return encaminhar('/profissionais/me/preferencias-equivalencia', 'planos_alimentares.ler', { signal: request.signal });
}
export async function PUT(request: Request): Promise<Response> {
  const leitura = await lerCorpoBiblioteca(request, 4 * 1024);
  if (leitura.resposta) return leitura.resposta;
  return encaminhar('/profissionais/me/preferencias-equivalencia', 'planos_alimentares.gerenciar', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: leitura.corpo, signal: request.signal
  }, 4 * 1024);
}
