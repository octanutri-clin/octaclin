import { NextResponse } from 'next/server';
import { encaminhar, lerCorpoBiblioteca, LIMITE_CORPO_MEDIDA, privado, UUID } from '../../../_proxy';

type Contexto = { params: Promise<{ alimentoId: string; medidaId: string }> };

export async function PATCH(request: Request, { params }: Contexto) {
  const { alimentoId, medidaId } = await params;
  if (!UUID.test(alimentoId) || !UUID.test(medidaId)) return NextResponse.json({ mensagem: 'Identificador de medida inválido.' }, { status: 400, headers: privado });
  const leitura = await lerCorpoBiblioteca(request, LIMITE_CORPO_MEDIDA);
  if ('resposta' in leitura) return leitura.resposta;
  const caminho = `/planos-alimentares/alimentos-personalizados/${encodeURIComponent(alimentoId)}/medidas-caseiras/${encodeURIComponent(medidaId)}`;
  return encaminhar(caminho, 'planos_alimentares.gerenciar', {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: leitura.corpo
  }, LIMITE_CORPO_MEDIDA);
}
