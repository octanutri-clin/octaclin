#!/usr/bin/env node
/**
 * Resume e ecoa uma captura do inventario Security & Quality.
 *
 * O resumo responde "a recaptura mudou alguma coisa?" sem obrigar ninguem a ler
 * 200 alertas: totais, quebra por ferramenta e severidade, e o delta contra o
 * inventario vigente.
 *
 * O eco resolve um problema de canal. A saida natural da captura no CI e o
 * artefato, mas em ambientes de agente com egresso restrito o download do
 * artefato cai (o blob storage do Actions fica fora da allowlist) -- e ai a
 * captura existe no CI sem chegar a quem precisa reconciliar. O log do job
 * atravessa. Para o log virar canal confiavel e nao aposta, cada bloco leva
 * indice e o conjunto leva um sha256: remontagem incompleta ou fora de ordem
 * reprova em vez de devolver JSON truncado com cara de inteiro.
 *
 * Nada aqui escreve no inventario. Triagem de alerta em causa e julgamento.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CAMINHO_INVENTARIO_PADRAO } from './validar-inventario-security-quality.mjs';

export const LARGURA_BLOCO_PADRAO = 3000;
const MARCA_INICIO = '===INVENTARIO-ECO-INICIO===';
const MARCA_FIM = '===INVENTARIO-ECO-FIM===';

function alertasCodeScanning(capturado) {
  const alertas = capturado?.snapshot?.codeScanning?.alertas;
  if (!Array.isArray(alertas)) {
    throw new Error('captura invalida: `snapshot.codeScanning.alertas` ausente ou nao e lista.');
  }
  return alertas;
}

function contar(valores) {
  return valores.reduce((acumulado, valor) => {
    const chave = valor ?? 'desconhecido';
    acumulado[chave] = (acumulado[chave] ?? 0) + 1;
    return acumulado;
  }, {});
}

export function resumirSnapshot(capturado) {
  const alertas = alertasCodeScanning(capturado);
  return {
    capturadoEm: capturado.capturadoEm,
    commitBase: capturado.commitBase,
    codeScanning: {
      total: alertas.length,
      porSeveridade: contar(alertas.map((a) => a.severidade)),
      porFerramenta: contar(alertas.map((a) => a.ferramenta)),
    },
    dependabot: { total: capturado?.snapshot?.dependabot?.total ?? 0 },
    secretScanning: { total: capturado?.snapshot?.secretScanning?.total ?? 0 },
  };
}

export function delta(capturado, vigente) {
  const numerosNovos = new Set(alertasCodeScanning(capturado).map((a) => a.numero));
  const numerosVigentes = new Set(vigente ? alertasCodeScanning(vigente).map((a) => a.numero) : []);

  const ordenar = (conjunto) => [...conjunto].sort((a, b) => a - b);
  return {
    novos: ordenar([...numerosNovos].filter((n) => !numerosVigentes.has(n))),
    fechados: ordenar([...numerosVigentes].filter((n) => !numerosNovos.has(n))),
    mantidos: ordenar([...numerosNovos].filter((n) => numerosVigentes.has(n))),
  };
}

export function blocosDoEco(texto, { largura = LARGURA_BLOCO_PADRAO } = {}) {
  const codificado = Buffer.from(texto, 'utf8').toString('base64');
  const blocos = [];
  for (let inicio = 0; inicio < codificado.length; inicio += largura) {
    blocos.push({ indice: blocos.length, dados: codificado.slice(inicio, inicio + largura) });
  }
  if (blocos.length === 0) blocos.push({ indice: 0, dados: '' });

  return {
    blocos,
    total: blocos.length,
    sha256: createHash('sha256').update(texto, 'utf8').digest('hex'),
  };
}

export function remontarEco(blocos) {
  const porIndice = new Map();
  for (const bloco of blocos) {
    if (porIndice.has(bloco.indice)) {
      throw new Error(`eco invalido: bloco ${bloco.indice} veio repetido.`);
    }
    porIndice.set(bloco.indice, bloco.dados);
  }

  const ordenados = [];
  for (let i = 0; i < porIndice.size; i += 1) {
    if (!porIndice.has(i)) {
      throw new Error(`eco incompleto: falta o bloco ${i}.`);
    }
    ordenados.push(porIndice.get(i));
  }

  return Buffer.from(ordenados.join(''), 'base64').toString('utf8');
}

function lerVigente() {
  try {
    return JSON.parse(readFileSync(CAMINHO_INVENTARIO_PADRAO, 'utf8'));
  } catch {
    return null;
  }
}

function imprimirResumo(capturado) {
  const resumo = resumirSnapshot(capturado);
  const vigente = lerVigente();
  const d = delta(capturado, vigente);

  console.log('Captura do inventario Security & Quality');
  console.log(`  capturadoEm: ${resumo.capturadoEm}`);
  console.log(`  commitBase:  ${resumo.commitBase}`);
  console.log(`  code scanning: ${resumo.codeScanning.total} alerta(s) aberto(s)`);
  for (const [chave, valor] of Object.entries(resumo.codeScanning.porSeveridade).sort()) {
    console.log(`    severidade ${chave}: ${valor}`);
  }
  for (const [chave, valor] of Object.entries(resumo.codeScanning.porFerramenta).sort()) {
    console.log(`    ferramenta ${chave}: ${valor}`);
  }
  console.log(`  dependabot: ${resumo.dependabot.total}`);
  console.log(`  secret scanning: ${resumo.secretScanning.total}`);

  console.log('');
  if (!vigente) {
    console.log('  (nao ha inventario vigente legivel para comparar)');
    return;
  }
  console.log(`Delta contra o inventario vigente (capturadoEm ${vigente.capturadoEm})`);
  console.log(`  alertas novos:    ${d.novos.length}${d.novos.length ? ` -> ${d.novos.join(', ')}` : ''}`);
  console.log(`  alertas fechados: ${d.fechados.length}${d.fechados.length ? ` -> ${d.fechados.join(', ')}` : ''}`);
  console.log(`  alertas mantidos: ${d.mantidos.length}`);
  console.log('');
  console.log('Cobertura bijetiva e obrigatoria: todo alerta novo precisa entrar');
  console.log('numa causa, e toda referencia a alerta fechado precisa sair dela.');
}

function imprimirEco(texto) {
  const { blocos, total, sha256 } = blocosDoEco(texto);
  console.log(`${MARCA_INICIO} partes=${total} sha256=${sha256} bytes=${Buffer.byteLength(texto, 'utf8')}`);
  for (const bloco of blocos) {
    console.log(`${bloco.indice}:${bloco.dados}`);
  }
  console.log(MARCA_FIM);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argumentos = process.argv.slice(2);
  const caminho = argumentos.find((a) => !a.startsWith('--'));
  if (!caminho) {
    console.error('uso: node scripts/resumir-captura-inventario.mjs <captura.json> [--eco]');
    process.exit(2);
  }

  const texto = readFileSync(caminho, 'utf8');
  const capturado = JSON.parse(texto);

  if (argumentos.includes('--eco')) {
    imprimirEco(JSON.stringify(capturado));
  } else {
    imprimirResumo(capturado);
  }
}
