import { encaminhar, lerCorpoBiblioteca, LIMITE_CORPO_BIBLIOTECA } from '../_proxy';

export async function POST(request: Request) {
  const leitura = await lerCorpoBiblioteca(request, LIMITE_CORPO_BIBLIOTECA);
  if ('resposta' in leitura) return leitura.resposta;
  return encaminhar('/planos-alimentares/alimentos-personalizados/busca', 'planos_alimentares.ler', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: leitura.corpo
  }, LIMITE_CORPO_BIBLIOTECA);
}
