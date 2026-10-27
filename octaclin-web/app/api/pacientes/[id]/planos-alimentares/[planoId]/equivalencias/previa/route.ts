import { encaminhar, lerCorpoBiblioteca } from '../../../../../../planos-alimentares/alimentos-personalizados/_proxy';
interface Params { params: Promise<{ id: string; planoId: string }> }
export async function POST(request: Request, props: Params): Promise<Response> {
  const leitura = await lerCorpoBiblioteca(request, 96 * 1024);
  if (leitura.resposta) return leitura.resposta;
  const { id, planoId } = await props.params;
  return encaminhar(`/pacientes/${encodeURIComponent(id)}/planos-alimentares/${encodeURIComponent(planoId)}/equivalencias/previa`,
    'planos_alimentares.gerenciar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: leitura.corpo, signal: request.signal }, 96 * 1024);
}
