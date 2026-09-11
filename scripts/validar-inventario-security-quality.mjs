import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DISPOSICOES = new Set(['corrigir', 'investigar', 'falso_positivo', 'mitigado', 'aguardando_upstream']);
const SEVERIDADES = new Set(['critical', 'high', 'medium', 'low', 'informational', 'none']);
const ONDAS = new Set(['SQ-1A', 'SQ-1B', 'SQ-1C', 'SQ-2', 'SQ-3']);

/**
 * SLA de recadencia por severidade (Fase 261): teto de dias entre a captura
 * do snapshot e `revisarEm`, na ausencia de excecao formal. Ate esta fase
 * `revisarEm` era so uma data futura qualquer, escolhida caso a caso -- nada
 * impedia uma causa `critical` receber revisao daqui a um ano. Os numeros
 * espelham o teto de 180 dias ja em vigor para o ledger de excecoes
 * (`docs/governance/POLITICA_SUPPLY_CHAIN_DEPENDENCIAS.md`, secao 12): uma
 * causa so pode exceder o teto da propria severidade citando uma excecao
 * (`causa.excecao`), que carrega seu proprio prazo e justificativa la.
 */
const SLA_DIAS_POR_SEVERIDADE = {
  critical: 14,
  high: 30,
  medium: 90,
  low: 180,
  informational: 180,
  none: 180
};
const MS_POR_DIA = 24 * 60 * 60 * 1000;
const REF_ALERTA = /^(?:code-scanning|dependabot):\d+$/;
const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;
const ID_CAUSA = /^SQ-\d{4}-\d{3}$/;
const ID_EXCECAO = /^SC-\d{4}-\d{3}$/;
const SHA_COMPLETO = /^[0-9a-f]{40}$/;

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const CAMINHO_INVENTARIO_PADRAO = join(RAIZ, 'docs', 'governance', 'inventario-security-quality.json');

function falhar(mensagem) {
  throw new Error(`Inventario Security & Quality invalido: ${mensagem}`);
}

function exigirObjeto(valor, campo) {
  if (valor === null || typeof valor !== 'object' || Array.isArray(valor)) falhar(`${campo} precisa ser um objeto.`);
}

function exigirTexto(valor, campo) {
  if (typeof valor !== 'string' || valor.trim() === '') falhar(`${campo} precisa ser texto nao vazio.`);
}

function exigirTextoOuNulo(valor, campo) {
  if (valor !== null && (typeof valor !== 'string' || valor.trim() === '')) {
    falhar(`${campo} precisa ser texto nao vazio ou null.`);
  }
}

function exigirListaDeTextos(valor, campo) {
  if (!Array.isArray(valor) || valor.length === 0) falhar(`${campo} precisa ser uma lista nao vazia.`);
  for (const item of valor) exigirTexto(item, campo);
}

function lerData(valor, campo) {
  if (typeof valor !== 'string' || !DATA_ISO.test(valor)) falhar(`${campo} precisa estar no formato AAAA-MM-DD.`);
  const data = new Date(`${valor}T00:00:00.000Z`);
  if (Number.isNaN(data.getTime()) || data.toISOString().slice(0, 10) !== valor) {
    falhar(`${campo} contem data invalida: ${valor}.`);
  }
  return data;
}

function lerTimestamp(valor, campo) {
  if (typeof valor !== 'string' || valor.trim() === '') falhar(`${campo} precisa ser timestamp parseavel.`);
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) falhar(`${campo} contem timestamp invalido: ${valor}.`);
  return data;
}

function referenciasEsperadas(snapshot) {
  return [
    ...snapshot.codeScanning.alertas.map(({ numero }) => `code-scanning:${numero}`),
    ...snapshot.dependabot.alertas.map(({ numero }) => `dependabot:${numero}`),
  ].sort();
}

function referenciasObservadas(causas) {
  const vistas = new Set();
  for (const causa of causas) {
    if (!Array.isArray(causa.alertas)) falhar(`causa ${causa.id ?? '(sem id)'} precisa de alertas em lista.`);
    for (const referencia of causa.alertas) {
      if (typeof referencia !== 'string' || !REF_ALERTA.test(referencia)) falhar(`referencia invalida: ${referencia}`);
      if (vistas.has(referencia)) falhar(`alerta em mais de uma causa: ${referencia}`);
      vistas.add(referencia);
    }
  }
  return [...vistas].sort();
}

function validarAlertas(alertas, fonte) {
  if (!Array.isArray(alertas)) falhar(`${fonte}.alertas precisa ser uma lista.`);
  const numeros = new Set();
  for (const alerta of alertas) {
    exigirObjeto(alerta, `alerta de ${fonte}`);
    if (!Number.isInteger(alerta.numero) || alerta.numero < 0) falhar(`alerta de ${fonte} tem numero invalido.`);
    if (numeros.has(alerta.numero)) falhar(`numero de alerta duplicado em ${fonte}: ${alerta.numero}.`);
    numeros.add(alerta.numero);
    if (!SEVERIDADES.has(alerta.severidade)) falhar(`alerta ${fonte}:${alerta.numero} tem severidade invalida.`);
  }
}

function validarAlertaCodeScanning(alerta) {
  const campo = `alerta snapshot.codeScanning:${alerta.numero}`;
  exigirTexto(alerta.ferramenta, `${campo}.ferramenta`);
  exigirTexto(alerta.regra, `${campo}.regra`);
  exigirTexto(alerta.categoria, `${campo}.categoria`);
  exigirTexto(alerta.caminho, `${campo}.caminho`);
  exigirTextoOuNulo(alerta.pacote, `${campo}.pacote`);
  exigirTextoOuNulo(alerta.versaoInstalada, `${campo}.versaoInstalada`);
  exigirTextoOuNulo(alerta.versaoCorrigida, `${campo}.versaoCorrigida`);
}

function validarAlertaDependabot(alerta) {
  const campo = `alerta snapshot.dependabot:${alerta.numero}`;
  exigirTexto(alerta.advisory, `${campo}.advisory`);
  exigirTexto(alerta.ecossistema, `${campo}.ecossistema`);
  exigirTexto(alerta.pacote, `${campo}.pacote`);
  exigirTexto(alerta.manifesto, `${campo}.manifesto`);
  exigirTextoOuNulo(alerta.versaoCorrigida, `${campo}.versaoCorrigida`);
}

function validarFonte(snapshot, nome, exigePorFerramenta = false) {
  const fonte = snapshot[nome];
  exigirObjeto(fonte, `snapshot.${nome}`);
  validarAlertas(fonte.alertas, `snapshot.${nome}`);
  if (nome === 'codeScanning') {
    for (const alerta of fonte.alertas) validarAlertaCodeScanning(alerta);
  }
  if (nome === 'dependabot') {
    for (const alerta of fonte.alertas) validarAlertaDependabot(alerta);
  }
  if (!Number.isInteger(fonte.total) || fonte.total !== fonte.alertas.length) {
    falhar(`snapshot.${nome}.total precisa ser igual ao comprimento de alertas.`);
  }
  if (!exigePorFerramenta) return;
  exigirObjeto(fonte.porFerramenta, `snapshot.${nome}.porFerramenta`);
  const calculado = {};
  for (const alerta of fonte.alertas) {
    calculado[alerta.ferramenta] = (calculado[alerta.ferramenta] ?? 0) + 1;
  }
  const declaradas = fonte.porFerramenta;
  if (Object.keys(declaradas).length !== Object.keys(calculado).length) falhar('snapshot.codeScanning.porFerramenta nao corresponde aos alertas.');
  for (const [ferramenta, total] of Object.entries(calculado)) {
    if (declaradas[ferramenta] !== total) falhar('snapshot.codeScanning.porFerramenta nao corresponde aos alertas.');
  }
}

function validarSlaRevisao(causa, capturadoEm, revisarEm) {
  const dias = SLA_DIAS_POR_SEVERIDADE[causa.severidadeContextual];
  const limite = new Date(capturadoEm.getTime() + dias * MS_POR_DIA);
  if (revisarEm.getTime() <= limite.getTime()) return;
  if (causa.excecao !== undefined) return;
  falhar(
    `causa ${causa.id} tem revisarEm alem do SLA de ${dias} dia(s) para severidade ${causa.severidadeContextual}; ` +
      'antecipe revisarEm ou registre uma excecao rastreavel em causa.excecao.'
  );
}

function validarCausa(causa, alertasPorReferencia, hoje, capturadoEm) {
  exigirObjeto(causa, 'causa');
  if (typeof causa.id !== 'string' || !ID_CAUSA.test(causa.id)) falhar(`id invalido: ${causa.id}`);
  exigirTexto(causa.titulo, `causa ${causa.id}.titulo`);
  exigirTexto(causa.owner, `causa ${causa.id}.owner`);
  exigirTexto(causa.ondaDestino, `causa ${causa.id}.ondaDestino`);
  if (!ONDAS.has(causa.ondaDestino)) falhar(`causa ${causa.id}.ondaDestino invalida.`);
  if (!DISPOSICOES.has(causa.disposicao)) falhar(`causa ${causa.id}.disposicao invalida.`);
  if (!SEVERIDADES.has(causa.severidadeContextual)) falhar(`causa ${causa.id}.severidadeContextual invalida.`);
  exigirListaDeTextos(causa.evidencia, `causa ${causa.id}.evidencia`);
  exigirListaDeTextos(causa.preCondicoes, `causa ${causa.id}.preCondicoes`);
  exigirListaDeTextos(causa.mitigacoes, `causa ${causa.id}.mitigacoes`);
  exigirTexto(causa.impacto, `causa ${causa.id}.impacto`);
  exigirTexto(causa.condicaoSaida, `causa ${causa.id}.condicaoSaida`);
  if (causa.excecao !== undefined && (typeof causa.excecao !== 'string' || !ID_EXCECAO.test(causa.excecao))) {
    falhar(`causa ${causa.id}.excecao invalida.`);
  }
  const revisarEm = lerData(causa.revisarEm, `causa ${causa.id}.revisarEm`);
  if (revisarEm.getTime() < hoje.getTime()) falhar(`causa ${causa.id} esta com revisao vencida.`);
  validarSlaRevisao(causa, capturadoEm, revisarEm);

  const alertas = causa.alertas.map((referencia) => alertasPorReferencia.get(referencia));
  const temVersaoCorrigida = alertas.some(
    (alerta) => typeof alerta.versaoCorrigida === 'string' && alerta.versaoCorrigida.trim() !== ''
  );
  if (causa.disposicao === 'aguardando_upstream' && temVersaoCorrigida) {
    exigirTexto(causa.bloqueioUpstream, `causa ${causa.id}.bloqueioUpstream`);
  }
  if (
    causa.disposicao === 'corrigir' &&
    !temVersaoCorrigida &&
    (typeof causa.correcaoSemBump !== 'string' || causa.correcaoSemBump.trim() === '')
  ) {
    falhar(`causa ${causa.id} corrigir exige versao corrigida ou justificativa correcaoSemBump.`);
  }
}

function validarGateEncerramentoSq4(inventario) {
  if (inventario.gateEncerramentoSq4 === undefined) return;
  if (inventario.gateEncerramentoSq4 !== true) {
    falhar('gateEncerramentoSq4, quando declarado, precisa ser true.');
  }

  const investigacoes = inventario.causas.filter(({ disposicao }) => disposicao === 'investigar');
  if (investigacoes.length > 0) {
    falhar(`gate SQ-4 tem investigacao pendente: ${investigacoes.map(({ id }) => id).join(', ')}.`);
  }

  const severidadesPorReferencia = new Map([
    ...inventario.snapshot.codeScanning.alertas.map((alerta) => [`code-scanning:${alerta.numero}`, alerta.severidade]),
    ...inventario.snapshot.dependabot.alertas.map((alerta) => [`dependabot:${alerta.numero}`, alerta.severidade]),
  ]);
  const corrigiveisBloqueadores = inventario.causas.filter((causa) =>
    causa.disposicao === 'corrigir' && causa.alertas.some((referencia) =>
      ['critical', 'high'].includes(severidadesPorReferencia.get(referencia))
    )
  );
  if (corrigiveisBloqueadores.length > 0) {
    falhar(`gate SQ-4 tem critico ou alto corrigivel: ${corrigiveisBloqueadores.map(({ id }) => id).join(', ')}.`);
  }
}

export function validarInventario(inventario, { hoje = new Date() } = {}) {
  exigirObjeto(inventario, 'inventario');
  if (inventario.schemaVersion !== 1) falhar('schemaVersion precisa ser 1.');
  if (inventario.repositorio !== 'octanutri-clin/octaclin') falhar('repositorio precisa ser octanutri-clin/octaclin.');
  if (typeof inventario.commitBase !== 'string' || !SHA_COMPLETO.test(inventario.commitBase)) falhar('commitBase precisa ser SHA completo de 40 caracteres hexadecimais.');
  const capturadoEm = lerTimestamp(inventario.capturadoEm, 'capturadoEm');
  if (!(hoje instanceof Date) || Number.isNaN(hoje.getTime())) falhar('hoje precisa ser uma data valida.');
  const hojeNoInicio = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate()));

  exigirObjeto(inventario.snapshot, 'snapshot');
  validarFonte(inventario.snapshot, 'codeScanning', true);
  validarFonte(inventario.snapshot, 'dependabot');
  exigirObjeto(inventario.snapshot.secretScanning, 'snapshot.secretScanning');
  if (!Number.isInteger(inventario.snapshot.secretScanning.total) || inventario.snapshot.secretScanning.total < 0) falhar('snapshot.secretScanning.total invalido.');
  if (inventario.snapshot.secretScanning.total !== 0) falhar('Secret Scanning ativo exige resposta a incidente fora deste inventario.');
  if (!Array.isArray(inventario.causas)) falhar('causas precisa ser uma lista.');

  const esperadas = referenciasEsperadas(inventario.snapshot);
  const observadas = referenciasObservadas(inventario.causas);
  if (JSON.stringify(esperadas) !== JSON.stringify(observadas)) falhar('cobertura de alertas precisa ser exata entre snapshot e causas.');

  const alertasPorReferencia = new Map([
    ...inventario.snapshot.codeScanning.alertas.map((alerta) => [`code-scanning:${alerta.numero}`, alerta]),
    ...inventario.snapshot.dependabot.alertas.map((alerta) => [`dependabot:${alerta.numero}`, alerta]),
  ]);
  const ids = new Set();
  for (const causa of inventario.causas) {
    if (ids.has(causa?.id)) falhar(`id duplicado: ${causa?.id}.`);
    validarCausa(causa, alertasPorReferencia, hojeNoInicio, capturadoEm);
    ids.add(causa.id);
  }
  validarGateEncerramentoSq4(inventario);
  return `Inventario Security & Quality valido: ${esperadas.length} alertas cobertos.`;
}

export function carregarEValidarInventario(caminho = CAMINHO_INVENTARIO_PADRAO, { hoje = new Date() } = {}) {
  let inventario;
  try {
    inventario = JSON.parse(readFileSync(caminho, 'utf8'));
  } catch (erro) {
    falhar(`nao foi possivel ler ou interpretar ${caminho}: ${erro.message}`);
  }
  return validarInventario(inventario, { hoje });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(carregarEValidarInventario());
}
