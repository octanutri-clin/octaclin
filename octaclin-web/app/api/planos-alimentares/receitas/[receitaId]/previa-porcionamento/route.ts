import { encaminharReceitaFood07 } from '../../_food07-proxy';
export async function POST(request: Request, props: { params: Promise<{ receitaId: string }> }) {
  const { receitaId } = await props.params;
  return encaminharReceitaFood07(request, 'previa', receitaId);
}
