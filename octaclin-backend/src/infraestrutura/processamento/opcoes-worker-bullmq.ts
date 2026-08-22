import type { WorkerOptions } from 'bullmq';

/**
 * Opcoes compartilhadas dos workers BullMQ, calibradas para custo de comando.
 *
 * O padrao do BullMQ e `drainDelay: 5` e `stalledInterval: 30000`. Com fila
 * vazia isso faz cada worker mandar um comando a cada 5 segundos, para sempre:
 * 3 workers dao cerca de 52 mil comandos por dia, ou 1,5 milhao por mes, sem
 * nenhum job ter sido processado. Em 2026-08-22 isso estourou o teto de 500 mil
 * comandos do Redis gerenciado com o produto ainda sem cliente em producao.
 *
 * `drainDelay` e apenas o tempo maximo do bloqueio; quando um job entra na
 * fila o comando bloqueante acorda na hora. Aumentar nao adiciona latencia de
 * enfileiramento, so reduz quantas vezes o worker repergunta enquanto nada
 * chega.
 *
 * `stalledInterval` maior atrasa a deteccao de job travado ate 5 minutos, em
 * vez de 30 segundos. E a unica troca real aqui, e no volume atual e barata.
 *
 * Projecao com estes valores: cerca de 156 mil comandos por mes.
 */
export const OPCOES_WORKER_BULLMQ: Pick<WorkerOptions, 'drainDelay' | 'stalledInterval'> = {
  drainDelay: 60,
  stalledInterval: 300_000
};
