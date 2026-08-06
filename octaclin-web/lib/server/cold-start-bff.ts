/**
 * Tolerancia a cold start do backend.
 *
 * O backend hiberna quando fica ocioso e a primeira requisicao leva ~30s para
 * acorda-lo. Durante essa janela a borda devolve **pagina de erro HTML** (502/
 * 503/504), que nao e resposta da aplicacao. Sem tratamento isso vira 500 no
 * dashboard, na agenda e na conta do cliente, e vira "servico de acesso
 * indisponivel" no login — sintomas de indisponibilidade para um servico que
 * esta apenas subindo.
 *
 * Este modulo nao importa nada do Next de proposito: assim ele e testavel fora
 * do runtime de request.
 */

/** Status que a borda usa enquanto o servico hibernado sobe. */
export const STATUS_COLD_START = [502, 503, 504];

/** Somam ~30s, o suficiente para cobrir o cold start observado (32s). */
export const ESPERAS_COLD_START_MS = [2000, 4000, 8000, 16000];

/**
 * Repetir so e seguro em metodo idempotente.
 *
 * Um 502 da borda **nao prova** que a requisicao nao chegou ao backend. Repetir
 * um POST de pagamento ou de criacao de consulta poderia registrar o mesmo fato
 * duas vezes — pior que devolver erro. GET e HEAD nao tem esse risco.
 */
export function metodoIdempotente(init?: { method?: string }): boolean {
  const metodo = (init?.method ?? 'GET').toUpperCase();
  return metodo === 'GET' || metodo === 'HEAD';
}

export function ehStatusColdStart(status: number): boolean {
  return STATUS_COLD_START.includes(status);
}

const dormir = (ms: number) => new Promise((resolver) => setTimeout(resolver, ms));

/**
 * Executa e, enquanto a resposta for de cold start (ou a conexao falhar),
 * espera e tenta de novo — no maximo uma vez por espera configurada.
 *
 * `podeRepetir: false` executa uma unica vez e devolve o que vier: e o caminho
 * dos metodos que mudam estado.
 */
export async function comEsperaDeColdStart(
  executar: () => Promise<Response>,
  podeRepetir: boolean,
  esperas: number[] = ESPERAS_COLD_START_MS
): Promise<Response> {
  let ultimoErro: unknown;
  let resposta: Response | undefined;

  for (let tentativa = 0; ; tentativa += 1) {
    try {
      resposta = await executar();
      if (!ehStatusColdStart(resposta.status)) return resposta;
    } catch (erro) {
      // Conexao recusada tambem e sintoma de servico subindo.
      ultimoErro = erro;
      resposta = undefined;
    }

    if (!podeRepetir || tentativa >= esperas.length) break;
    await dormir(esperas[tentativa]);
  }

  if (resposta) return resposta;
  throw ultimoErro;
}
