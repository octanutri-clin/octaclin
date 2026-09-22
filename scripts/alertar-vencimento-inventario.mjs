#!/usr/bin/env node
/**
 * Aviso antecipado de vencimento do inventario Security & Quality.
 *
 * Por que existe: em 2026-09-20 a causa SQ-2026-004 venceu por data e o check
 * `Governanca de repositorio` passou de verde a vermelho de um dia para o
 * outro, travando `main` e 15 PRs. O vencimento estava correto -- o que faltou
 * foi aviso. `validarInventario` so fala depois que ja e tarde, porque a
 * reprovacao e o proprio sintoma.
 *
 * O que ele NAO faz, deliberadamente: nao renova `revisarEm`, nao altera
 * disposicao e nao escreve no inventario. Renovar sozinho seria a maquina de
 * falso verde que o inventario existe para impedir -- a data avancaria sem que
 * ninguem tivesse olhado um alerta sequer. Recapturar e triar continua sendo
 * trabalho humano (ou de agente), com evidencia.
 *
 * Onde roda: workflow proprio, agendado, fora do caminho dos PRs. Ele reprova
 * (exit 1) dentro da janela justamente para o run agendado ficar vermelho e
 * notificar; como nao e required check de PR, esse vermelho nao bloqueia a
 * fila -- so chama atencao enquanto ainda ha folga para agir.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CAMINHO_INVENTARIO_PADRAO } from './validar-inventario-security-quality.mjs';

const MS_POR_DIA = 24 * 60 * 60 * 1000;
export const DIAS_AVISO_PADRAO = 7;

function inicioDoDiaUtc(data) {
  return Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate());
}

/**
 * Conta em dias de calendario UTC, nao em intervalo bruto: o validador decide
 * por data (`revisarEm` vence no primeiro instante do dia seguinte), entao o
 * aviso precisa contar do mesmo jeito para nao divergir dele por horas.
 */
function diasAte(revisarEm, hoje) {
  return Math.round((inicioDoDiaUtc(revisarEm) - inicioDoDiaUtc(hoje)) / MS_POR_DIA);
}

export function causasPorVencer(inventario, { hoje = new Date(), dias = DIAS_AVISO_PADRAO } = {}) {
  const causas = inventario?.causas;
  if (!Array.isArray(causas)) {
    throw new Error('inventario invalido: `causas` ausente ou nao e lista.');
  }

  return causas
    .map((causa) => {
      const revisarEm = new Date(`${causa?.revisarEm}T00:00:00.000Z`);
      if (Number.isNaN(revisarEm.getTime())) {
        throw new Error(`causa ${causa?.id ?? '(sem id)'} tem revisarEm ilegivel: ${causa?.revisarEm}`);
      }
      const diasRestantes = diasAte(revisarEm, hoje);
      return {
        id: causa.id,
        revisarEm: causa.revisarEm,
        severidadeContextual: causa.severidadeContextual,
        diasRestantes,
        vencida: diasRestantes < 0,
      };
    })
    .filter((achado) => achado.diasRestantes <= dias)
    .sort((a, b) => a.diasRestantes - b.diasRestantes);
}

export function formatarAviso(achados) {
  const linhas = achados.map((a) => {
    const prazo = a.vencida
      ? `VENCIDA ha ${Math.abs(a.diasRestantes)} dia(s)`
      : `vence em ${a.diasRestantes} dia(s)`;
    return `  - ${a.id} (${a.severidadeContextual}): revisarEm ${a.revisarEm} -- ${prazo}`;
  });

  return [
    'Inventario Security & Quality: causa(s) proximas do vencimento.',
    ...linhas,
    '',
    'Vencida, a causa reprova o check `Governanca de repositorio` em `main` e',
    'em todo PR aberto. Renovar a data sem recapturar nao resolve: o SLA limita',
    '`revisarEm` a um teto contado a partir de `capturadoEm`.',
    '',
    'Para resolver, recapture o snapshot e triage os alertas em causas:',
    '  node scripts/capturar-inventario-security-quality.mjs > docs/governance/inventario-security-quality.json',
    '  pnpm test:inventario-security-quality',
  ].join('\n');
}

function lerDias(argv) {
  const indice = argv.indexOf('--dias');
  if (indice === -1) return DIAS_AVISO_PADRAO;
  const valor = Number(argv[indice + 1]);
  if (!Number.isInteger(valor) || valor < 0) {
    throw new Error('--dias exige um inteiro nao negativo.');
  }
  return valor;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dias = lerDias(process.argv);
  const inventario = JSON.parse(readFileSync(CAMINHO_INVENTARIO_PADRAO, 'utf8'));
  const achados = causasPorVencer(inventario, { dias });

  if (achados.length === 0) {
    console.log(`Inventario Security & Quality: nenhuma causa vence nos proximos ${dias} dia(s).`);
    process.exit(0);
  }

  console.error(formatarAviso(achados));
  process.exit(1);
}
