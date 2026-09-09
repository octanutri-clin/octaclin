import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import {
  resumirRelatorioZap,
  validarAutorizacaoStaging,
} from './seguranca-dinamica-staging.mjs';

function lerJson(caminho, rotulo) {
  try {
    return JSON.parse(readFileSync(resolve(caminho), 'utf8'));
  } catch {
    throw new Error(`${rotulo} ausente, ilegivel ou malformado.`);
  }
}

function escreverJson(caminho, valor) {
  const absoluto = resolve(caminho);
  mkdirSync(dirname(absoluto), { recursive: true });
  writeFileSync(absoluto, `${JSON.stringify(valor, null, 2)}\n`, 'utf8');
}

function preflight() {
  validarAutorizacaoStaging({
    webUrl: process.env.E2E_WEB_URL,
    apiUrl: process.env.E2E_API_URL,
    confirmacao: process.env.DAST_FUZZ_CONFIRMAR_EXECUCAO,
    confirmarRemoto: process.env.E2E_CONFIRMAR_REMOTO,
    eventoGithub: process.env.GITHUB_EVENT_NAME,
  });
  console.log('Preflight PR54 PASS: execucao manual e alvos loopback descartaveis confirmados.');
}

function avaliarZap([relatorioPath, ledgerPath, resumoPath]) {
  if (!relatorioPath || !ledgerPath || !resumoPath) {
    throw new Error('Uso: avaliar-zap <relatorio.json> <ledger.json> <resumo.json>.');
  }
  const resumo = resumirRelatorioZap(
    lerJson(relatorioPath, 'Relatorio ZAP'),
    lerJson(ledgerPath, 'Ledger de falsos positivos'),
  );
  escreverJson(resumoPath, resumo);
  if (!resumo.aprovado) {
    throw new Error(`ZAP bloqueou o gate: ${resumo.bloqueios.length} alerta(s) high sem decisao valida.`);
  }
  console.log(
    `ZAP Baseline PASS: ${resumo.totais.alto} high, ${resumo.totais.medio} medium, `
      + `${resumo.totais.baixo} low; evidencia sanitizada gravada.`,
  );
}

try {
  const [comando, ...argumentos] = process.argv.slice(2);
  if (comando === 'preflight') preflight();
  else if (comando === 'avaliar-zap') avaliarZap(argumentos);
  else throw new Error('Comando esperado: preflight ou avaliar-zap.');
} catch (erro) {
  console.error(erro instanceof Error ? erro.message : 'Falha desconhecida no gate de seguranca dinamica.');
  process.exitCode = 1;
}
