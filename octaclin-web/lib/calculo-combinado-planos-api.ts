import { lerPaginaContribuicoes, type PedidoContribuicoes } from './contribuicoes-micronutrientes';
import { lerAnaliseMicronutrientesFactual, type AnaliseMicronutrientesFactual } from './micronutrientes-factuais';
import { lerPaginaHistoricoMicronutrientesFactual, type CursorHistoricoMicronutrientesFactual, type PaginaHistoricoMicronutrientesFactual } from './historico-micronutrientes-factuais';
import { copiarConfirmacoesContexto, type ConfirmacoesContextoFactual } from './registro-analise-factual';
import { ErroApiPlanoAlimentar, type CalcularCombinadoEntradaApi, type ResultadoCalculoCombinadoApi, type SelecaoCalculoPlanoApi } from './plano-alimentar-api';

async function lerJson<T>(resposta: Response): Promise<T> {
  if (!resposta.ok) {
    const texto = await resposta.text();
    let mensagem = `Falha HTTP ${resposta.status}`;
    try {
      const corpo = JSON.parse(texto) as { mensagem?: string; message?: string | string[] };
      mensagem = corpo.mensagem ?? (Array.isArray(corpo.message) ? corpo.message.join(' ') : corpo.message ?? mensagem);
    } catch { if (texto) mensagem = texto; }
    throw new ErroApiPlanoAlimentar(resposta.status, mensagem);
  }
  return resposta.json() as Promise<T>;
}

export function obterSelecaoCalculoPlano(pacienteId: string, planoId: string, signal?: AbortSignal) {
  return fetch(`/api/pacientes/${encodeURIComponent(pacienteId)}/planos-alimentares/${encodeURIComponent(planoId)}/selecao-calculo`, {
    cache: 'no-store', signal
  }).then(lerJson<SelecaoCalculoPlanoApi>);
}

export function calcularPlanosCombinados(pacienteId: string, entrada: CalcularCombinadoEntradaApi, signal?: AbortSignal) {
  return fetch(`/api/pacientes/${encodeURIComponent(pacienteId)}/planos-alimentares/calculo-combinado`, {
    method: 'POST',
    cache: 'no-store',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entrada)
  }).then(lerJson<ResultadoCalculoCombinadoApi>);
}

/**
 * Sem `confirmacoes`, o pedido e a leitura são os de sempre. Com elas, pede a comparação com a DRI:
 * só as 7 confirmações do profissional vão no corpo; nascimento, data, idade e elegibilidade são do servidor.
 */
export async function analisarMicronutrientesPlanejados(pacienteId: string, entrada: CalcularCombinadoEntradaApi, signal?: AbortSignal, confirmacoes?: ConfirmacoesContextoFactual): Promise<AnaliseMicronutrientesFactual> {
  const corpo = confirmacoes ? { ...entrada, incluirReferencias: true, confirmacoes: copiarConfirmacoesContexto(confirmacoes) } : entrada;
  const resposta = await fetch(`/api/pacientes/${encodeURIComponent(pacienteId)}/planos-alimentares/analise-micronutrientes`, {
    method: 'POST', cache: 'no-store', signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo)
  });
  return lerAnaliseMicronutrientesFactual(await lerJson<unknown>(resposta), entrada, confirmacoes ? { referencias: true } : undefined);
}

export async function obterContribuicoesMicronutrientes(pacienteId:string,pedido:PedidoContribuicoes,signal?:AbortSignal) {
  const resposta=await fetch(`/api/pacientes/${encodeURIComponent(pacienteId)}/planos-alimentares/analise-micronutrientes/contribuicoes`,{
    method:'POST',cache:'no-store',signal,headers:{'Content-Type':'application/json'},body:JSON.stringify(pedido)
  });
  return lerPaginaContribuicoes(await lerJson<unknown>(resposta),pedido);
}

export async function obterHistoricoMicronutrientesFactual(pacienteId:string,cursor?:CursorHistoricoMicronutrientesFactual,signal?:AbortSignal,incluirContexto=false,incluirOrigem=false):Promise<PaginaHistoricoMicronutrientesFactual>{
  const resposta=await fetch(`/api/pacientes/${encodeURIComponent(pacienteId)}/planos-alimentares/analises-factuais/historico`,{
    method:'POST',cache:'no-store',signal,headers:{'Content-Type':'application/json'},
    body:JSON.stringify({limite:10,...(incluirContexto?{incluirContexto:true}:{}),...(incluirOrigem?{incluirOrigem:true}:{}),...(cursor?{cursorId:cursor.id,cursorCriadoEm:cursor.criadoEm}:{})})
  });
  return lerPaginaHistoricoMicronutrientesFactual(await lerJson<unknown>(resposta),incluirContexto,incluirOrigem);
}
