import { NextResponse } from 'next/server';
import { ErroPermissaoAusente, ErroSessaoAusente, exigirPermissaoBff, requisitarBackendAutenticado } from '@/lib/server/sessao-bff';
import { lerTextoLimitado } from '@/lib/server/restricoes-bff-comum';

const privados = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const objeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const falhar = (status: number) => NextResponse.json({ mensagem: 'Não foi possível consultar o preenchimento deste envio.' }, { status, headers: privados });
export async function GET(_request: Request, props: { params: Promise<{ id: string; respostaId: string }> }) {
  try {
    await exigirPermissaoBff('questionarios.ler');
    const recebidos = await props.params; if (!uuid.test(recebidos.id) || !uuid.test(recebidos.respostaId)) return falhar(400);
    const id = recebidos.id.toLowerCase(), respostaId = recebidos.respostaId.toLowerCase();
    const r = await requisitarBackendAutenticado(`/questionarios/${id}/respostas/${respostaId}/completude`);
    if (!r.ok) return falhar([400,401,403,404,429].includes(r.status) ? r.status : 502);
    const raw = await lerTextoLimitado(r, 16 * 1024); if (raw === null) return falhar(502);
    let d: unknown; try { d = JSON.parse(raw); } catch { return falhar(502); }
    if (!objeto(d) || d.respostaId !== respostaId || !objeto(d.completude)) return falhar(502);
    const c = d.completude, campos = ['versaoQuestionario','totalPerguntas','respondidas','obrigatorias','obrigatoriasRespondidas'] as const;
    if (c.estado === 'desconhecido') {
      if (typeof c.motivo !== 'string' || !['snapshot_ausente','snapshot_invalido','respostas_incompativeis'].includes(c.motivo) || campos.some(k => c[k] !== null)) return falhar(502);
      return NextResponse.json({ respostaId, completude: { estado: c.estado, motivo: c.motivo, versaoQuestionario: null, totalPerguntas: null, respondidas: null, obrigatorias: null, obrigatoriasRespondidas: null } }, { headers: privados });
    }
    if (c.estado !== 'disponivel' || campos.some(k => !Number.isSafeInteger(c[k]) || (c[k] as number) < (k === 'versaoQuestionario' ? 1 : 0))) return falhar(502);
    if ((c.respondidas as number) > (c.totalPerguntas as number) || (c.obrigatorias as number) > (c.totalPerguntas as number) || (c.obrigatoriasRespondidas as number) > (c.obrigatorias as number) || (c.obrigatoriasRespondidas as number) > (c.respondidas as number)) return falhar(502);
    return NextResponse.json({ respostaId, completude: { estado: c.estado, versaoQuestionario: c.versaoQuestionario, totalPerguntas: c.totalPerguntas, respondidas: c.respondidas, obrigatorias: c.obrigatorias, obrigatoriasRespondidas: c.obrigatoriasRespondidas } }, { headers: privados });
  } catch (e) { return falhar(e instanceof ErroSessaoAusente ? 401 : e instanceof ErroPermissaoAusente ? 403 : 502); }
}
