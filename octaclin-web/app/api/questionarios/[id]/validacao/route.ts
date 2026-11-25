import { NextResponse } from 'next/server';
import { ErroPermissaoAusente, ErroSessaoAusente, exigirPermissaoBff, requisitarBackendAutenticado } from '@/lib/server/sessao-bff';
import { origemMutacaoPermitida } from '@/lib/server/seguranca-bff';
import { lerTextoLimitado } from '@/lib/server/restricoes-bff-comum';

interface Params { params: Promise<{ id: string }> }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const privados = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' };
const objeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const falhar = (status: number) => NextResponse.json({ mensagem: 'Não foi possível conferir o questionário. Suas edições locais foram preservadas.' }, { status, headers: privados });
const campos = ['titulo', 'enunciado', 'peso', 'categoriaId', 'tipo', 'configuracao', 'opcoes', 'dados'];
const codigos = ['titulo_ausente', 'enunciado_ausente', 'dados_invalidos', 'configuracao_invalida', 'opcoes_insuficientes'];
async function atender(request: Request, props: Params, conferir: boolean) {
  try {
    await exigirPermissaoBff('questionarios.gerenciar');
    if (conferir && !origemMutacaoPermitida(request)) return falhar(403);
    const { id } = await props.params; if (!uuid.test(id)) return falhar(400);
    let body: string | undefined;
    if (conferir) {
      const raw = await lerTextoLimitado(request, 512 * 1024); if (raw === null) return falhar(413);
      let d: unknown; try { d = JSON.parse(raw); } catch { return falhar(400); }
      if (!objeto(d) || Object.keys(d).some(k => !['versaoEsperada', 'titulo', 'perguntas'].includes(k)) || !Number.isSafeInteger(d.versaoEsperada) || (d.versaoEsperada as number) < 1 || typeof d.titulo !== 'string' || d.titulo.length > 180 || !Array.isArray(d.perguntas) || d.perguntas.length > 1000) return falhar(400);
      if (d.perguntas.some(p => !objeto(p) || Object.keys(p).some(k => !['id', 'dados'].includes(k)) || typeof p.id !== 'string' || !uuid.test(p.id) || !objeto(p.dados))) return falhar(400);
      body = JSON.stringify(d);
    }
    const r = await requisitarBackendAutenticado(`/questionarios/${id}/validacao`, { method: conferir ? 'POST' : 'GET', ...(body ? { body, headers: { 'Content-Type': 'application/json' } } : {}) });
    if (!r.ok) return falhar([400,401,403,404,409,413,429].includes(r.status) ? r.status : 502);
    const raw = await lerTextoLimitado(r, 512 * 1024); if (raw === null) return falhar(502);
    let d: unknown; try { d = JSON.parse(raw); } catch { return falhar(502); }
    if (!objeto(d) || !Number.isSafeInteger(d.versao) || (d.versao as number) < 1) return falhar(502);
    if (!conferir) return NextResponse.json({ versao: d.versao }, { headers: privados });
    if (!Array.isArray(d.problemas) || d.problemas.length > 10000) return falhar(502);
    const problemas = [];
    for (const p of d.problemas) {
      if (!objeto(p) || typeof p.campo !== 'string' || !campos.includes(p.campo) || typeof p.codigo !== 'string' || !codigos.includes(p.codigo) || (p.perguntaId !== undefined && (typeof p.perguntaId !== 'string' || !uuid.test(p.perguntaId)))) return falhar(502);
      problemas.push({ ...(p.perguntaId !== undefined ? { perguntaId: p.perguntaId } : {}), campo: p.campo, codigo: p.codigo });
    }
    return NextResponse.json({ versao: d.versao, problemas }, { headers: privados });
  } catch (e) { return falhar(e instanceof ErroSessaoAusente ? 401 : e instanceof ErroPermissaoAusente ? 403 : 502); }
}
export const GET = (request: Request, props: Params) => atender(request, props, false);
export const POST = (request: Request, props: Params) => atender(request, props, true);
