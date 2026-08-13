import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const CAMPOS = new Set([
  'healthStatus',
  'totalRequisicoes',
  'errosServidor',
  'duracaoP95Ms',
  'filasFalhas',
  'filasPendentes'
]);

export function validarSnapshotRollout(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) throw new Error('Snapshot de rollout invalido.');
  for (const chave of Object.keys(snapshot)) {
    if (!CAMPOS.has(chave)) throw new Error(`Campo nao permitido no snapshot: ${chave}.`);
  }
  if (!['ok', 'degradado', 'falha'].includes(snapshot.healthStatus)) throw new Error('healthStatus invalido.');
  for (const campo of ['totalRequisicoes', 'errosServidor', 'duracaoP95Ms', 'filasFalhas', 'filasPendentes']) {
    if (!Number.isFinite(snapshot[campo]) || snapshot[campo] < 0) throw new Error(`${campo} invalido.`);
  }
  return true;
}

export function avaliarRollout(snapshot) {
  validarSnapshotRollout(snapshot);
  const taxaErro5xx = snapshot.totalRequisicoes ? snapshot.errosServidor / snapshot.totalRequisicoes : 0;
  const motivos = [];
  if (snapshot.healthStatus === 'falha') motivos.push('health_falha');
  if (taxaErro5xx >= 0.05) motivos.push('taxa_5xx_critica');
  if (motivos.length) return { decisao: 'rollback', taxaErro5xx: Number(taxaErro5xx.toFixed(4)), motivos };

  if (snapshot.totalRequisicoes < 50) motivos.push('amostra_insuficiente');
  if (snapshot.healthStatus === 'degradado') motivos.push('health_degradado');
  if (taxaErro5xx >= 0.01) motivos.push('taxa_5xx_atencao');
  if (snapshot.duracaoP95Ms > 1500) motivos.push('latencia_p95_alta');
  if (snapshot.filasPendentes > 100) motivos.push('fila_acumulada');
  if (snapshot.filasFalhas > 0) motivos.push('fila_com_falha_historica');
  return {
    decisao: motivos.length ? 'observar' : 'promover',
    taxaErro5xx: Number(taxaErro5xx.toFixed(4)),
    motivos
  };
}

async function executarCli() {
  const caminho = process.argv[2];
  if (!caminho) throw new Error('Informe o caminho de um snapshot JSON sanitizado.');
  const snapshot = JSON.parse(await readFile(caminho, 'utf8'));
  console.log(JSON.stringify(avaliarRollout(snapshot)));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  executarCli().catch((erro) => {
    console.error(erro instanceof Error ? erro.message : String(erro));
    process.exitCode = 1;
  });
}
