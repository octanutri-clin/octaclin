import { NextResponse } from 'next/server';
import { encaminhar, privado, UUID } from '../../../alimentos-personalizados/_proxy';

type Contexto = { params: Promise<{ origem: string; alimentoId: string }> };

export async function DELETE(_request: Request, { params }: Contexto) {
  const { origem, alimentoId } = await params;
  if (!['catalogo', 'custom'].includes(origem) || !UUID.test(alimentoId)) {
    return NextResponse.json({ mensagem: 'Identificador de favorito inválido.' }, { status: 400, headers: privado });
  }
  return encaminhar(`/planos-alimentares/favoritos/${origem}/${encodeURIComponent(alimentoId)}`, 'planos_alimentares.gerenciar', { method: 'DELETE' });
}
