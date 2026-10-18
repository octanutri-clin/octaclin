import { NextResponse } from 'next/server';
import { encaminhar, lerCorpoBiblioteca, LIMITE_CORPO_BIBLIOTECA, privado, UUID } from '../_proxy';

type Contexto = { params: Promise<{ alimentoId: string }> };
const caminho = (id: string) => `/planos-alimentares/alimentos-personalizados/${encodeURIComponent(id)}`;

export async function GET(_request: Request, { params }: Contexto) {
  const { alimentoId } = await params;
  if (!UUID.test(alimentoId)) return NextResponse.json({ mensagem: 'Identificador de alimento inválido.' }, { status: 400, headers: privado });
  return encaminhar(caminho(alimentoId), 'planos_alimentares.ler');
}

export async function PATCH(request: Request, { params }: Contexto) {
  const { alimentoId } = await params;
  if (!UUID.test(alimentoId)) return NextResponse.json({ mensagem: 'Identificador de alimento inválido.' }, { status: 400, headers: privado });
  const leitura = await lerCorpoBiblioteca(request, LIMITE_CORPO_BIBLIOTECA);
  if ('resposta' in leitura) return leitura.resposta;
  return encaminhar(caminho(alimentoId), 'planos_alimentares.gerenciar', {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: leitura.corpo
  }, LIMITE_CORPO_BIBLIOTECA);
}
