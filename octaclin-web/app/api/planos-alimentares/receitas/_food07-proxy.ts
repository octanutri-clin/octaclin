import { CAMPOS_MICRONUTRIENTES_PLANO } from '@/lib/micronutrientes-plano';
import { NextResponse } from 'next/server';
import { ErroPermissaoAusente, ErroSessaoAusente, exigirPermissaoBff, requisitarBackendAutenticado } from '@/lib/server/sessao-bff';
import { ErroCorpoAcimaDoLimite, lerCorpoLimitado } from '../../pacientes/[id]/planos-alimentares/_proxy';

const PRIVADO = { 'Cache-Control': 'private, no-store' };
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const HASH = /^[a-f0-9]{64}$/;
type Operacao = 'consulta' | 'previa' | 'compartilhar';
function objeto(v: unknown, campos?: readonly string[]): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v) || (campos && Object.keys(v).some(k => !campos.includes(k)))) throw new Error('Objeto inválido.');
  return v as Record<string, unknown>;
}
function texto(v: unknown, max: number, vazio = false): v is string { return typeof v === 'string' && Array.from(v).length <= max && (vazio || Boolean(v.trim())); }
function inteiro(v: unknown, max = 2147483647, min = 1): v is number { return typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max; }
function porcao(v: unknown, max = 10000): v is number { return typeof v === 'number' && Number.isFinite(v) && v >= 0.001 && v <= max && Number(v.toFixed(3)) === v; }
function id(v: unknown): v is string { return typeof v === 'string' && UUID.test(v); }
function hash(v: unknown): v is string { return typeof v === 'string' && HASH.test(v); }
function escolher(o: Record<string, unknown>, campos: readonly string[]) { return Object.fromEntries(campos.filter(k => o[k] !== undefined).map(k => [k, o[k]])); }
function validarBody(op: Operacao, v: unknown) {
  const campos = op === 'consulta' ? ['pagina', 'limite', 'origem', 'tipo', 'categoria', 'etiqueta'] : op === 'previa' ? ['versaoEsperada', 'porcoesDesejadas'] : ['pacienteId', 'chaveIdempotencia', 'receitaIds', 'versoesEsperadas', 'canais', 'agendadoPara', 'confirmacaoRevisaoManual', 'porcionamentos'];
  const o = objeto(v, campos);
  if (op === 'consulta') {
    if ((o.pagina !== undefined && !inteiro(o.pagina, 10000)) || (o.limite !== undefined && !inteiro(o.limite, 100)) ||
      (o.origem !== undefined && !['pessoal', 'clinica'].includes(String(o.origem))) || (o.tipo !== undefined && !['receita', 'refeicao_pronta'].includes(String(o.tipo))) ||
      (o.categoria !== undefined && !texto(o.categoria, 80)) || (o.etiqueta !== undefined && !texto(o.etiqueta, 40))) throw new Error();
  } else if (op === 'previa') {
    if (!inteiro(o.versaoEsperada) || !porcao(o.porcoesDesejadas, 1000)) throw new Error();
  } else {
    if (!id(o.pacienteId) || !id(o.chaveIdempotencia) || !Array.isArray(o.receitaIds) || !o.receitaIds.length || o.receitaIds.length > 10 || o.receitaIds.some(x => !id(x)) || new Set(o.receitaIds).size !== o.receitaIds.length ||
      !Array.isArray(o.versoesEsperadas) || o.versoesEsperadas.length !== o.receitaIds.length || !Array.isArray(o.canais) || !o.canais.length || o.canais.length > 4 || new Set(o.canais).size !== o.canais.length || o.canais.some(c => !['portal', 'email', 'whatsapp', 'push'].includes(String(c))) ||
      (o.agendadoPara !== undefined && o.agendadoPara !== null && (typeof o.agendadoPara !== 'string' || !Number.isFinite(Date.parse(o.agendadoPara)))) ||
      (o.confirmacaoRevisaoManual !== undefined && o.confirmacaoRevisaoManual !== null && typeof o.confirmacaoRevisaoManual !== 'boolean')) throw new Error();
    const ids = o.receitaIds;
    const versoes = o.versoesEsperadas.map(x => { const r = objeto(x, ['receitaId', 'versao']); if (!id(r.receitaId) || !ids.includes(r.receitaId) || !inteiro(r.versao)) throw new Error(); return r.receitaId; });
    if (new Set(versoes).size !== ids.length) throw new Error();
    if (o.porcionamentos !== undefined) {
      if (!Array.isArray(o.porcionamentos) || o.porcionamentos.length > 10) throw new Error();
      const ps = o.porcionamentos.map(x => {
        const p = objeto(x, ['receitaId', 'porcoesDesejadas', 'fingerprintPrevia', 'instrucoesPersonalizadas', 'confirmacaoConferenciaInstrucoes']);
        if (!id(p.receitaId) || !ids.includes(p.receitaId) || !porcao(p.porcoesDesejadas, 1000) || !hash(p.fingerprintPrevia) || p.confirmacaoConferenciaInstrucoes !== true ||
          (p.instrucoesPersonalizadas !== undefined && !texto(p.instrucoesPersonalizadas, 4000, true))) throw new Error();
        return p.receitaId;
      });
      if (new Set(ps).size !== ps.length) throw new Error();
    }
  }
  return o;
}
function metadados(v: unknown) {
  const m = objeto(v);
  if (m.schemaVersao !== 1 || !Array.isArray(m.etiquetas) || m.etiquetas.length > 10 || m.etiquetas.some(t => !texto(t, 40)) ||
    (m.baseQuantidades !== undefined && !['receita_inteira', 'por_porcao'].includes(String(m.baseQuantidades))) ||
    (m.rendimentoPorcoes !== undefined && !inteiro(m.rendimentoPorcoes, 1000)) || (m.tempoPreparoMinutos !== undefined && !inteiro(m.tempoPreparoMinutos, 10080))) throw new Error();
  return escolher(m, ['schemaVersao', 'etiquetas', 'baseQuantidades', 'rendimentoPorcoes', 'tempoPreparoMinutos']);
}
function nutrientes(v: unknown) {
  const n = objeto(v), publico = escolher(n, ['energiaKcal', 'proteinasG', 'carboidratosG', 'gordurasG', 'fibrasG', 'sodioMg']);
  if (Object.values(publico).some(x => typeof x !== 'number' || !Number.isFinite(x) || x < 0)) throw new Error();
  return publico;
}
function ingrediente(v: unknown, alternativa = false): Record<string, unknown> {
  const i = objeto(v);
  if (!porcao(i.quantidade) || !porcao(i.porcaoGramas) || !texto(i.unidade, 40) || (i.alimentoComposicaoId !== undefined && !id(i.alimentoComposicaoId)) ||
    (i.descricao !== undefined && !texto(i.descricao, 240)) || (!i.alimentoComposicaoId && !i.descricao)) throw new Error();
  const r = escolher(i, ['alimentoComposicaoId', 'descricao', 'quantidade', 'unidade', 'porcaoGramas']);
  if (i.nutrientesPor100g !== undefined) r.nutrientesPor100g = nutrientes(i.nutrientesPor100g);
  // Não aceitar contexto/capability clínica. Micros manuais já validados pelo
  // backend continuam no contrato atual; a prévia de catálogo não os sobrescreve.
  if (!i.alimentoComposicaoId && i.micronutrientesPor100g !== undefined) {
    const m = objeto(i.micronutrientesPor100g);

    r.micronutrientesPor100g = escolher(m, CAMPOS_MICRONUTRIENTES_PLANO.map(c => c.codigo));
    if (Object.values(r.micronutrientesPor100g as object).some(x => typeof x !== 'number' || !Number.isFinite(x) || x < 0)) throw new Error();
  }
  for (const k of ['liberadaParaPaciente', 'preferida']) if (i[k] !== undefined) { if (typeof i[k] !== 'boolean') throw new Error(); r[k] = i[k]; }
  if (!alternativa && i.substituicoes !== undefined) {
    if (!Array.isArray(i.substituicoes) || i.substituicoes.length > 20) throw new Error();
    r.substituicoes = i.substituicoes.map(x => ingrediente(x, true));
  }
  if (!alternativa && i.substituicoesVisiveisInicialmente !== undefined) { if (!inteiro(i.substituicoesVisiveisInicialmente, 20)) throw new Error(); r.substituicoesVisiveisInicialmente = i.substituicoesVisiveisInicialmente; }
  return r;
}
function resumo(v: unknown) {
  const o = objeto(v);
  if (!id(o.id) || !texto(o.nome, 180) || !['pessoal', 'clinica'].includes(String(o.origem)) || !['receita', 'refeicao_pronta'].includes(String(o.tipo)) ||
    (o.categoria !== null && !texto(o.categoria, 80)) || !inteiro(o.versaoAtual) || !inteiro(o.totalItens, 100) || !texto(o.atualizadoEm, 80)) throw new Error();
  return { ...escolher(o, ['id', 'nome', 'origem', 'tipo', 'categoria', 'versaoAtual', 'totalItens', 'atualizadoEm']), ...(o.metadados === undefined ? {} : { metadados: metadados(o.metadados) }) };
}
function previa(v: unknown) {
  const o = objeto(v);
  if (!id(o.receitaId) || !inteiro(o.versao) || !hash(o.fingerprint)) throw new Error();
  const base = escolher(o, ['receitaId', 'versao', 'estado', 'fingerprint']);
  function local(v: unknown, aviso = false) {
    const a = objeto(v);
    if ((a.item !== undefined && !inteiro(a.item, 99, 0)) || (a.substituicao !== undefined && !inteiro(a.substituicao, 19, 0))) throw new Error();
    if (aviso ? a.codigo !== 'ARREDONDAMENTO' || !['quantidade', 'porcaoGramas'].includes(String(a.campo)) : !['CONTEUDO_INVALIDO', 'PORCOES_INVALIDAS', 'BASE_NAO_INFORMADA', 'RENDIMENTO_NAO_INFORMADO', 'QUANTIDADE_FORA_DO_LIMITE'].includes(String(a.codigo))) throw new Error();
    return escolher(a, aviso ? ['codigo', 'campo', 'item', 'substituicao'] : ['codigo', 'item', 'substituicao']);
  }
  if (o.estado === 'indisponivel') {
    if (!Array.isArray(o.motivos) || !o.motivos.length || o.motivos.length > 4200) throw new Error();
    return { ...base, motivos: o.motivos.map(x => local(x)) };
  }
  if (o.estado !== 'calculavel' || !porcao(o.porcoesDesejadas, 1000) || !['receita_inteira', 'por_porcao'].includes(String(o.baseQuantidades)) ||
    !Array.isArray(o.itens) || !o.itens.length || o.itens.length > 100 || !Array.isArray(o.avisos) || o.avisos.length > 4200 ||
    (o.rendimentoOriginalPorcoes !== undefined && !inteiro(o.rendimentoOriginalPorcoes, 1000))) throw new Error();
  const f = objeto(o.fatorExato);
  if (!['numerador', 'denominador'].every(k => typeof f[k] === 'string' && /^[1-9]\d{0,12}$/.test(f[k] as string))) throw new Error();
  const ts = objeto(o.totais), totais: Record<string, unknown> = {};
  for (const campo of ['energiaKcal', 'proteinasG', 'carboidratosG', 'gordurasG']) {
    const n = objeto(ts[campo]);
    if (n.unidade !== (campo === 'energiaKcal' ? 'kcal' : 'g') || (n.estado !== 'ausente' && n.estado !== 'conhecido') ||
      (n.estado === 'conhecido' && (typeof n.valor !== 'number' || !Number.isFinite(n.valor) || n.valor < 0)) || (n.estado === 'ausente' && n.valor !== undefined)) throw new Error();
    totais[campo] = escolher(n, ['estado', 'unidade', 'valor']);
  }
  const d = objeto(o.denominador); if (d.porcoes !== o.porcoesDesejadas || !texto(d.descricao, 100)) throw new Error();
  if (!Array.isArray(o.fontes) || o.fontes.length > 2100) throw new Error();
  const fontes = o.fontes.map(x => { const a = objeto(x), f = objeto(a.fonte); if (!id(a.alimentoComposicaoId) || !texto(a.descricao, 240) || (a.preparacao !== null && !texto(a.preparacao, 180)) || !texto(f.codigo, 80) || !texto(f.versao, 80)) throw new Error(); return { ...escolher(a, ['alimentoComposicaoId', 'descricao', 'preparacao']), fonte: escolher(f, ['codigo', 'versao']) }; });
  return { ...base, ...escolher(o, ['porcoesDesejadas', 'baseQuantidades', 'rendimentoOriginalPorcoes']), fatorExato: escolher(f, ['numerador', 'denominador']), itens: o.itens.map(x => ingrediente(x)), avisos: o.avisos.map(x => local(x, true)), totais, denominador: escolher(d, ['porcoes', 'descricao']), fontes };
}
export async function encaminharReceitaFood07(request: Request, op: Operacao, receitaId?: string) {
  try {
    await exigirPermissaoBff(op === 'compartilhar' ? 'planos_alimentares.gerenciar' : 'planos_alimentares.ler');
    if (new URL(request.url).search || (op === 'previa' && !id(receitaId))) return NextResponse.json({ mensagem: 'Solicitação de receita inválida.' }, { status: 400, headers: PRIVADO });
    // 10 textos de4000 caracteres suplementares, mesmo escapados em JSON,
    // cabem em512KiB. Consulta/prévia não carregam texto clínico e ficam em8KiB.
    const bruto = await lerCorpoLimitado(request, op === 'compartilhar' ? 512 * 1024 : 8 * 1024);
    let dados: Record<string, unknown>;
    try { dados = validarBody(op, JSON.parse(bruto)); } catch { return NextResponse.json({ mensagem: 'Solicitação de receita inválida.' }, { status: 400, headers: PRIVADO }); }
    const caminho = '/planos-alimentares/receitas' + (op === 'consulta' ? '/consulta' : op === 'compartilhar' ? '/compartilhamentos' : `/${encodeURIComponent(receitaId!)}/previa-porcionamento`);
    const resposta = await requisitarBackendAutenticado(caminho, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados) });
    if (!resposta.ok) return NextResponse.json({ mensagem: resposta.status === 409 ? 'A receita ou a prévia mudou. Confira novamente.' : 'Não foi possível concluir a operação de receita.' }, { status: resposta.status, headers: PRIVADO });
    let valor: unknown;
    try { valor = JSON.parse(await lerCorpoLimitado(resposta, op === 'previa' ? 16 * 1024 * 1024 : 512 * 1024)); } catch { throw new Error('Resposta indisponível.'); }
    const o = objeto(valor); let publico: unknown;
    if (op === 'previa') publico = previa(o);
    else if (op === 'consulta') { if (!Array.isArray(o.itens) || o.itens.length > 100 || !inteiro(o.total, Number.MAX_SAFE_INTEGER, 0) || !inteiro(o.pagina, 10000) || !inteiro(o.limite, 100)) throw new Error(); publico = { itens: o.itens.map(resumo), ...escolher(o, ['total', 'pagina', 'limite']) }; }
    else { if (!inteiro(o.quantidade, 10) || !Array.isArray(o.itens) || o.itens.length !== o.quantidade || (o.agendadoPara !== null && !texto(o.agendadoPara, 80))) throw new Error(); publico = { ...escolher(o, ['quantidade', 'agendadoPara']), itens: o.itens.map(x => { const a = objeto(x); if (!id(a.id) || !id(a.receitaId) || !['agendado', 'ativo', 'substituido', 'retirado'].includes(String(a.status))) throw new Error(); return escolher(a, ['id', 'receitaId', 'status']); }) }; }
    return NextResponse.json(publico, { status: resposta.status, headers: PRIVADO });
  } catch (erro) {
    const status = erro instanceof ErroSessaoAusente ? 401 : erro instanceof ErroPermissaoAusente ? 403 : erro instanceof ErroCorpoAcimaDoLimite ? 413 : 503;
    return NextResponse.json({ mensagem: status === 413 ? 'Solicitação acima do limite.' : 'Operação de receitas indisponível.' }, { status, headers: PRIVADO });
  }
}
