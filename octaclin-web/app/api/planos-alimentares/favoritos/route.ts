import { executarProxyPlanoAlimentar } from '../../pacientes/[id]/planos-alimentares/_proxy';
import { encaminhar, lerCorpoBiblioteca, LIMITE_CORPO_BIBLIOTECA } from '../alimentos-personalizados/_proxy';

export async function GET() {
  return executarProxyPlanoAlimentar('/planos-alimentares/favoritos', 'planos_alimentares.ler');
}

export async function POST(request: Request) {
  const leitura = await lerCorpoBiblioteca(request, LIMITE_CORPO_BIBLIOTECA);
  if ('resposta' in leitura) return leitura.resposta;
  return encaminhar('/planos-alimentares/favoritos', 'planos_alimentares.gerenciar', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: leitura.corpo
  }, LIMITE_CORPO_BIBLIOTECA);
}
