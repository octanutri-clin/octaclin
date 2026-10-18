import { NextResponse } from 'next/server';
import { encaminhar, lerCorpoBiblioteca, LIMITE_CORPO_MEDIDA, privado, UUID } from '../../_proxy';
import { montarConsultaPermitida } from '../../../../pacientes/[id]/planos-alimentares/_proxy';

type Contexto = { params: Promise<{ alimentoId: string }> };
const caminho = (id: string) => `/planos-alimentares/alimentos-personalizados/${encodeURIComponent(id)}/medidas-caseiras`;

export async function GET(request: Request, { params }: Contexto) {
  const { alimentoId } = await params;
  if (!UUID.test(alimentoId)) return NextResponse.json({ mensagem: 'Identificador de alimento inválido.' }, { status: 400, headers: privado });
  const consulta = montarConsultaPermitida(request, ['pagina', 'limite']);
  return encaminhar(`${caminho(alimentoId)}${consulta}`, 'planos_alimentares.ler');
}

export async function POST(request: Request, { params }: Contexto) {
  const { alimentoId } = await params;
  if (!UUID.test(alimentoId)) return NextResponse.json({ mensagem: 'Identificador de alimento inválido.' }, { status: 400, headers: privado });
  const leitura = await lerCorpoBiblioteca(request, LIMITE_CORPO_MEDIDA);
  if ('resposta' in leitura) return leitura.resposta;
  return encaminhar(caminho(alimentoId), 'planos_alimentares.gerenciar', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: leitura.corpo
  }, LIMITE_CORPO_MEDIDA);
}
