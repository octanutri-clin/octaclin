// Inventario executavel da matriz de acessibilidade.
//
// A matriz documental so vale se nao puder afirmar cobertura inexistente. Este
// script confronta docs/governance/matriz-acessibilidade.json com o que existe
// de fato: scripts do package.json, specs no disco, describes dentro do spec,
// rotas visitadas, projects do Playwright e steps do workflow de CI.
//
// Segue o formato de test-matriz-confiabilidade.mjs: sem dependencia nova,
// falha na primeira divergencia, mensagem que nomeia o item quebrado.
//
// O caminho da matriz e parametro para que test-matriz-acessibilidade.spec.mjs
// possa provar, com copias mutadas, que cada divergencia realmente reprova.

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const raiz = resolve(import.meta.dirname, '..');
export const MATRIZ_PADRAO = resolve(raiz, 'docs/governance/matriz-acessibilidade.json');

const RESULTADOS = new Set(['PASS', 'FAIL', 'SKIPPED', 'NA']);
const MECANISMOS = new Set(['automatizado', 'manual']);

// Superficies que dependem de hardware ou sistema operacional real. Nenhuma
// pode ser declarada PASS a partir de leitura de codigo ou de arvore renderizada.
const EXIGEM_DISPOSITIVO_REAL = [
  'TalkBack',
  'VoiceOver',
  'fonte ampliada do sistema operacional',
  'reducao de movimento do sistema operacional'
];

function falhar(mensagem) {
  throw new Error(mensagem);
}

function lerTexto(caminhoRelativo) {
  const absoluto = resolve(raiz, caminhoRelativo);
  if (!existsSync(absoluto)) falhar(`Arquivo referenciado pela matriz nao existe: ${caminhoRelativo}`);
  return readFileSync(absoluto, 'utf8');
}

function scriptsDoPacote(diretorio) {
  const caminho = diretorio === '.' ? 'package.json' : `${diretorio}/package.json`;
  return JSON.parse(lerTexto(caminho)).scripts ?? {};
}

// O ci.yml e lido como texto e fatiado por job. Evita dependencia de parser YAML
// para uma verificacao que so precisa saber em qual job cada `run:` aparece.
function jobsDoWorkflow(caminhoRelativo) {
  const linhas = lerTexto(caminhoRelativo).split(/\r?\n/);
  const jobs = new Map();
  let dentroDeJobs = false;
  let atual = null;

  for (const linha of linhas) {
    if (/^jobs:\s*$/.test(linha)) {
      dentroDeJobs = true;
      continue;
    }
    if (!dentroDeJobs) continue;
    if (/^\S/.test(linha)) break;

    const cabecalho = linha.match(/^ {2}([\w-]+):\s*$/);
    if (cabecalho) {
      atual = cabecalho[1];
      jobs.set(atual, []);
      continue;
    }
    if (atual) jobs.get(atual).push(linha);
  }

  return jobs;
}

function jobExecuta(linhasDoJob, comando) {
  return linhasDoJob.some((linha) => linha.trim().replace(/^-\s*/, '') === `run: ${comando}`);
}

export function validarMatriz(caminhoMatriz = MATRIZ_PADRAO) {
  const matriz = JSON.parse(readFileSync(caminhoMatriz, 'utf8'));

  // -------------------------------------------------------------------------
  // 1. Gates: comando existe, spec existe, e o gate bloqueante roda no CI.
  // -------------------------------------------------------------------------

  const gatesPorId = new Map();
  for (const gate of matriz.gates) {
    if (gatesPorId.has(gate.id)) falhar(`Gate duplicado na matriz: ${gate.id}`);
    gatesPorId.set(gate.id, gate);
  }

  const workflows = new Map();
  const jobsDe = (caminho) => {
    if (!workflows.has(caminho)) workflows.set(caminho, jobsDoWorkflow(caminho));
    return workflows.get(caminho);
  };

  for (const gate of matriz.gates) {
    const scripts = scriptsDoPacote(gate.diretorio);
    if (!scripts[gate.comando]) {
      falhar(`Gate ${gate.id}: o comando "${gate.comando}" nao existe em ${gate.diretorio}/package.json`);
    }
    if (gate.especificacao && !existsSync(resolve(raiz, gate.especificacao))) {
      falhar(`Gate ${gate.id}: a especificacao ${gate.especificacao} nao existe`);
    }

    if (gate.duplicaDe) {
      const original = gatesPorId.get(gate.duplicaDe);
      if (!original) falhar(`Gate ${gate.id}: duplicaDe aponta para gate inexistente ${gate.duplicaDe}`);
      if (!gate.motivoDaCobertura) falhar(`Gate ${gate.id}: declara duplicaDe sem motivoDaCobertura`);
      // Executar duas vezes a mesma auditoria custa tempo de CI sem cobertura nova.
      for (const [nomeDoJob, linhasDoJob] of jobsDe(original.ci.workflow)) {
        if (jobExecuta(linhasDoJob, `pnpm ${gate.comando}`)) {
          falhar(`Gate ${gate.id} duplica ${gate.duplicaDe} e mesmo assim roda no job ${nomeDoJob}`);
        }
      }
      continue;
    }

    if (!gate.bloqueante) continue;

    if (gate.cobertoPor) {
      const cobertura = gatesPorId.get(gate.cobertoPor);
      if (!cobertura) falhar(`Gate ${gate.id}: cobertoPor aponta para gate inexistente ${gate.cobertoPor}`);
      if (!gate.motivoDaCobertura) falhar(`Gate ${gate.id}: declara cobertoPor sem motivoDaCobertura`);
      if (!gate.especificacao) falhar(`Gate ${gate.id}: cobertura por suite exige declarar a especificacao coberta`);
      if (!cobertura.ci) falhar(`Gate ${gate.id}: o gate de cobertura ${cobertura.id} nao esta ligado ao CI`);
      continue;
    }

    if (!gate.ci) falhar(`Gate bloqueante ${gate.id} nao declara em que job do CI roda`);
    const linhasDoJob = jobsDe(gate.ci.workflow).get(gate.ci.job);
    if (!linhasDoJob) falhar(`Gate ${gate.id}: o job ${gate.ci.job} nao existe em ${gate.ci.workflow}`);
    if (!jobExecuta(linhasDoJob, gate.ci.run)) {
      falhar(`Gate ${gate.id}: o job ${gate.ci.job} nao executa "${gate.ci.run}"`);
    }
  }

  // -------------------------------------------------------------------------
  // 2. O CI nao pode mascarar falha de gate.
  // -------------------------------------------------------------------------

  for (const caminho of new Set(matriz.gates.filter((g) => g.ci).map((g) => g.ci.workflow))) {
    const texto = lerTexto(caminho);
    if (texto.includes('continue-on-error')) {
      falhar(`${caminho} usa continue-on-error: falha de gate deixaria de bloquear o job`);
    }
    for (const linha of texto.split(/\r?\n/)) {
      if (!linha.includes('run:')) continue;
      const mascarada = /\|\|\s*(true|exit 0|:)\s*$/.test(linha.trim());
      if (mascarada && matriz.gates.some((g) => linha.includes(g.comando))) {
        falhar(`${caminho} mascara a falha de um gate: ${linha.trim()}`);
      }
    }
  }

  // -------------------------------------------------------------------------
  // 3. Politica de flakes: a configuracao do Playwright precisa sustenta-la.
  // -------------------------------------------------------------------------

  const configPlaywright = lerTexto(matriz.configuracaoPlaywright);
  const politica = matriz.politicaDeFlakes;

  const numeroDaConfig = (rotulo, expressao) => {
    const encontrado = configPlaywright.match(expressao);
    if (!encontrado) falhar(`Nao foi possivel ler ${rotulo} em ${matriz.configuracaoPlaywright}`);
    return Number(encontrado[1].replace(/_/g, ''));
  };

  const retries = numeroDaConfig('retries do CI', /retries:\s*process\.env\.CI\s*\?\s*([\d_]+)/);
  if (retries > politica.retriesMaximoCi) {
    falhar(`retries do CI e ${retries}, acima do maximo ${politica.retriesMaximoCi} da politica de flakes`);
  }

  const timeoutTeste = numeroDaConfig('timeout de teste', /^\s*timeout:\s*([\d_]+)/m);
  if (timeoutTeste > politica.timeoutTesteMaximoMs) {
    falhar(`timeout de teste e ${timeoutTeste}ms, acima do maximo ${politica.timeoutTesteMaximoMs}ms da politica de flakes`);
  }

  const timeoutExpect = numeroDaConfig('timeout de expect', /expect:\s*\{[^}]*timeout:\s*([\d_]+)/);
  if (timeoutExpect > politica.timeoutExpectMaximoMs) {
    falhar(`timeout de expect e ${timeoutExpect}ms, acima do maximo ${politica.timeoutExpectMaximoMs}ms da politica de flakes`);
  }

  for (const [chave, esperado] of [['trace', politica.traceEsperado], ['screenshot', politica.screenshotEsperado]]) {
    if (!configPlaywright.includes(`${chave}: '${esperado}'`)) {
      falhar(`Playwright nao preserva artefato: ${chave} deveria ser '${esperado}'`);
    }
  }

  if (/testMatch|testIgnore/.test(configPlaywright)) {
    falhar('playwright.config declara testMatch/testIgnore: a suite completa deixa de cobrir todo o testDir e a matriz passa a mentir');
  }

  const projectsDeclarados = new Set([...configPlaywright.matchAll(/name:\s*'([^']+)'/g)].map((m) => m[1]));

  // -------------------------------------------------------------------------
  // 4. Quarentena: so existe com dono, motivo, prazo e a linha como SKIPPED.
  // -------------------------------------------------------------------------

  const quarentena = matriz.quarentena ?? [];
  for (const item of quarentena) {
    for (const campo of ['teste', 'responsavel', 'justificativa', 'prazo']) {
      if (!item[campo]) falhar(`Item de quarentena sem ${campo}: ${JSON.stringify(item)}`);
    }
    if (item.resultado !== 'SKIPPED') {
      falhar(`Item de quarentena "${item.teste}" precisa ser SKIPPED, nunca PASS`);
    }
  }

  // Um teste desligado no codigo sem entrada de quarentena e cobertura perdida
  // em silencio: a matriz continuaria dizendo PASS.
  const testesQuarentenados = new Set(quarentena.map((item) => item.teste));
  for (const gate of matriz.gates) {
    if (!gate.especificacao || !gate.especificacao.endsWith('.spec.mjs')) continue;
    const fonte = lerTexto(gate.especificacao);
    for (const [, titulo] of fonte.matchAll(/test\.(?:skip|fixme)\(\s*'([^']+)'/g)) {
      if (!testesQuarentenados.has(titulo)) {
        falhar(`Teste desligado em ${gate.especificacao} sem entrada de quarentena: "${titulo}"`);
      }
    }
  }

  // -------------------------------------------------------------------------
  // 5. Linhas da matriz.
  // -------------------------------------------------------------------------

  const fontesDosGates = new Map();
  const fonteDoGate = (gate) => {
    if (!fontesDosGates.has(gate.id)) fontesDosGates.set(gate.id, lerTexto(gate.especificacao));
    return fontesDosGates.get(gate.id);
  };

  const gatesUsados = new Set();

  for (const linha of matriz.linhas) {
    const identificacao = `${linha.superficie} / ${linha.rota}`;

    for (const campo of ['superficie', 'rota', 'estado', 'interacao', 'mecanismo', 'resultado', 'risco']) {
      if (!linha[campo]) falhar(`Linha sem ${campo}: ${identificacao}`);
    }
    if (!Array.isArray(linha.plataforma) || linha.plataforma.length === 0) {
      falhar(`Linha sem viewport ou plataforma: ${identificacao}`);
    }
    if (!RESULTADOS.has(linha.resultado)) falhar(`Resultado invalido em ${identificacao}: ${linha.resultado}`);
    if (!MECANISMOS.has(linha.mecanismo)) falhar(`Mecanismo invalido em ${identificacao}: ${linha.mecanismo}`);

    if ((linha.resultado === 'SKIPPED' || linha.resultado === 'NA') && !linha.justificativa) {
      falhar(`Linha ${linha.resultado} sem justificativa: ${identificacao}`);
    }
    if (linha.resultado === 'SKIPPED' && !linha.condicaoDeFechamento) {
      falhar(`Linha SKIPPED sem condicao de fechamento: ${identificacao}`);
    }

    // A regra central desta matriz: leitor de tela nativo, fonte ampliada e
    // reducao de movimento do sistema nunca podem ser declarados PASS sem
    // hardware ou emulador. Auditoria estatica e arvore web nao provam isso.
    const dependeDeDispositivo = EXIGEM_DISPOSITIVO_REAL.some(
      (alvo) => linha.superficie.includes(alvo) || linha.estado.includes(alvo)
    );
    if (dependeDeDispositivo && linha.resultado !== 'SKIPPED') {
      falhar(`${identificacao} depende de dispositivo real e nao pode ser ${linha.resultado}; use SKIPPED`);
    }

    if (!linha.evidencia) falhar(`Linha sem evidencia: ${identificacao}`);

    if (linha.mecanismo === 'manual') {
      if (linha.evidencia.gate) {
        falhar(`${identificacao} e manual, mas aponta para o gate automatizado ${linha.evidencia.gate}`);
      }
      if (!linha.evidencia.relatorio) falhar(`Linha manual sem relatorio de evidencia: ${identificacao}`);
      lerTexto(linha.evidencia.relatorio);
      continue;
    }

    if (linha.evidencia.relatorio) lerTexto(linha.evidencia.relatorio);

    if (!linha.evidencia.gate) {
      if (linha.resultado !== 'NA') falhar(`Linha automatizada sem gate de evidencia: ${identificacao}`);
      continue;
    }

    const gate = gatesPorId.get(linha.evidencia.gate);
    if (!gate) falhar(`${identificacao} aponta para gate inexistente: ${linha.evidencia.gate}`);
    gatesUsados.add(gate.id);

    if (!gate.especificacao) {
      if (linha.evidencia.blocos) falhar(`${identificacao} cita blocos, mas o gate ${gate.id} nao tem especificacao`);
      continue;
    }

    const fonte = fonteDoGate(gate);
    for (const bloco of linha.evidencia.blocos ?? []) {
      if (!fonte.includes(`test.describe('${bloco}'`)) {
        falhar(`${identificacao}: o bloco "${bloco}" nao existe em ${gate.especificacao}`);
      }
    }
    // Dois idiomas de navegacao convivem nas suites: goto direto no teste e
    // tabela de rotas percorrida por laco (`caminho:`). Ambos contam como visita.
    for (const rota of linha.rotas ?? []) {
      const visitada = fonte.includes(`page.goto('${rota}'`) || fonte.includes(`caminho: '${rota}'`);
      if (!visitada) {
        falhar(`${identificacao}: a rota ${rota} nao e visitada por ${gate.especificacao}`);
      }
    }
    for (const projeto of linha.plataforma) {
      if ((projeto.startsWith('desktop-') || projeto.startsWith('mobile-')) && !projectsDeclarados.has(projeto)) {
        falhar(`${identificacao}: o project Playwright "${projeto}" nao existe em ${matriz.configuracaoPlaywright}`);
      }
    }
  }

  // Gate automatizado sem nenhuma linha e cobertura que ninguem esta declarando
  // — ou uma linha removida da matriz sem remover o gate.
  for (const gate of matriz.gates) {
    if (gate.especificacao && !gatesUsados.has(gate.id)) {
      falhar(`O gate ${gate.id} tem especificacao mas nenhuma linha da matriz o usa como evidencia`);
    }
  }

  const porResultado = matriz.linhas.reduce((acumulado, linha) => {
    acumulado[linha.resultado] = (acumulado[linha.resultado] ?? 0) + 1;
    return acumulado;
  }, {});

  return (
    `Matriz de acessibilidade valida: ${matriz.gates.length} gates e ${matriz.linhas.length} linhas ` +
    `(${Object.entries(porResultado).map(([chave, valor]) => `${chave} ${valor}`).join(', ')}), ` +
    `${quarentena.length} testes em quarentena.`
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(validarMatriz());
}
