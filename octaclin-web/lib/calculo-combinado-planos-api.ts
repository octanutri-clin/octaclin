import { lerAnaliseMicronutrientesFactual, type AnaliseMicronutrientesFactual } from './micronutrientes-factuais';
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

export async function analisarMicronutrientesPlanejados(pacienteId: string, entrada: CalcularCombinadoEntradaApi, signal?: AbortSignal): Promise<AnaliseMicronutrientesFactual> {
  const resposta = await fetch(`/api/pacientes/${encodeURIComponent(pacienteId)}/planos-alimentares/analise-micronutrientes`, {
    method: 'POST', cache: 'no-store', signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entrada)
  });
  return lerAnaliseMicronutrientesFactual(await lerJson<unknown>(resposta), entrada);
}
