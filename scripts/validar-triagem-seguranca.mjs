import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const CAMINHO_TRIAGEM_PADRAO = resolve(
  import.meta.dirname,
  '..',
  'docs',
  'governance',
  'triagem-seguranca-pr37.json',
);

const DISPOSICOES = new Set(['confirmado', 'refutado', 'mitigado', 'nao_verificado']);
const PAPEIS_ALERTA = new Set(['primario', 'associado', 'duplicado']);
const SEVERIDADES = new Set(['critical', 'high', 'medium', 'low', 'informational']);

function exigir(condicao, mensagem) {
  if (!condicao) throw new Error(mensagem);
}

function exigirTexto(valor, campo) {
  exigir(typeof valor === 'string' && valor.trim().length > 0, `${campo} deve ser texto nao vazio`);
}

function exigirListaTexto(valor, campo) {
  exigir(Array.isArray(valor) && valor.length > 0, `${campo} deve ser uma lista nao vazia`);
  valor.forEach((item, indice) => exigirTexto(item, `${campo}[${indice}]`));
}

function ordenarReferencias(referencias) {
  return [...referencias].sort((a, b) => a.localeCompare(b, 'en'));
}

function referenciasEsperadas(snapshot) {
  const codeScanning = snapshot?.codeScanning?.alertas ?? [];
  const dependabot = snapshot?.dependabot?.alertas ?? [];
  return [
    ...codeScanning.map((numero) => `code-scanning:${numero}`),
    ...dependabot.map((numero) => `dependabot:${numero}`),
  ];
}

export function validarTriagem(triagem) {
  exigir(triagem?.schemaVersion === 1, 'schemaVersion deve ser 1');
  exigirTexto(triagem?.repositorio, 'repositorio');
  exigirTexto(triagem?.commitBase, 'commitBase');
  exigir(/^[0-9a-f]{40}$/.test(triagem.commitBase), 'commitBase deve ser SHA completo');
  exigirTexto(triagem?.capturadoEm, 'capturadoEm');
  exigir(Array.isArray(triagem?.casos) && triagem.casos.length > 0, 'casos deve ser uma lista nao vazia');

  const ids = new Set();
  const referencias = new Map();

  for (const caso of triagem.casos) {
    exigirTexto(caso.id, 'caso.id');
    exigir(!ids.has(caso.id), `caso duplicado: ${caso.id}`);
    ids.add(caso.id);
    exigirTexto(caso.titulo, `${caso.id}.titulo`);
    exigir(DISPOSICOES.has(caso.disposicao), `${caso.id}.disposicao invalida`);
    exigir(SEVERIDADES.has(caso.severidade), `${caso.id}.severidade invalida`);
    exigir(Array.isArray(caso.alertas) && caso.alertas.length > 0, `${caso.id}.alertas deve ser lista nao vazia`);

    for (const alerta of caso.alertas) {
      exigirTexto(alerta.ref, `${caso.id}.alerta.ref`);
      exigir(PAPEIS_ALERTA.has(alerta.papel), `${caso.id}.${alerta.ref}.papel invalido`);
      exigir(!referencias.has(alerta.ref), `alerta triado mais de uma vez: ${alerta.ref}`);
      referencias.set(alerta.ref, { caso: caso.id, alerta });
    }

    exigirListaTexto(caso.evidencia?.fontes, `${caso.id}.evidencia.fontes`);
    exigirTexto(caso.evidencia?.sink, `${caso.id}.evidencia.sink`);
    exigirListaTexto(caso.preCondicoes, `${caso.id}.preCondicoes`);
    exigirListaTexto(caso.mitigacoes, `${caso.id}.mitigacoes`);
    exigirTexto(caso.impacto, `${caso.id}.impacto`);
    exigirTexto(caso.conclusao, `${caso.id}.conclusao`);

    if (caso.disposicao === 'confirmado') {
      exigir(/^PR (?:3[8-9]|4[0-9]|5[0-6])$/.test(caso.prRemediacao), `${caso.id}.prRemediacao invalido`);
    } else {
      exigirTexto(caso.proximaRevisao, `${caso.id}.proximaRevisao`);
    }
  }

  for (const [referencia, { caso, alerta }] of referencias) {
    if (alerta.papel !== 'duplicado') continue;
    exigirTexto(alerta.duplicadoDe, `${referencia}.duplicadoDe`);
    exigir(referencias.has(alerta.duplicadoDe), `${referencia} referencia duplicadoDe inexistente`);
    exigir(alerta.duplicadoDe !== referencia, `${referencia} nao pode duplicar a si mesmo`);
    const alvo = referencias.get(alerta.duplicadoDe);
    exigir(alvo.caso === caso, `${referencia} deve duplicar alerta do mesmo caso`);
    exigir(alvo.alerta.papel !== 'duplicado', `${referencia} deve apontar diretamente para alerta primario ou associado`);
  }

  const esperadas = ordenarReferencias(referenciasEsperadas(triagem.snapshot));
  const observadas = ordenarReferencias(referencias.keys());
  exigir(
    JSON.stringify(observadas) === JSON.stringify(esperadas),
    `cobertura de alertas divergente; esperados=${esperadas.join(',')}; observados=${observadas.join(',')}`,
  );

  exigir(triagem.snapshot.codeScanning.total === triagem.snapshot.codeScanning.alertas.length, 'total Code Scanning divergente');
  exigir(
    Object.values(triagem.snapshot.codeScanning.porFerramenta ?? {}).reduce((total, quantidade) => total + quantidade, 0)
      === triagem.snapshot.codeScanning.total,
    'contagem Code Scanning por ferramenta divergente',
  );
  exigir(triagem.snapshot.dependabot.total === triagem.snapshot.dependabot.alertas.length, 'total Dependabot divergente');
  exigir(triagem.snapshot.secretScanning.total === 0, 'segredos ativos exigem resposta a incidente, nao triagem documental');

  return `Triagem valida: ${triagem.casos.length} casos, ${observadas.length} alertas cobertos.`;
}

export function carregarEValidarTriagem(caminho = CAMINHO_TRIAGEM_PADRAO) {
  const triagem = JSON.parse(readFileSync(caminho, 'utf8'));
  const resultado = validarTriagem(triagem);
  const raiz = resolve(import.meta.dirname, '..');

  for (const caso of triagem.casos) {
    for (const fonte of caso.evidencia.fontes) {
      const partes = /^(.*):(\d+)(?:-(\d+))?$/.exec(fonte);
      exigir(partes, `${caso.id}.evidencia.fontes deve usar caminho:linha ou caminho:inicio-fim`);
      const caminhoFonte = resolve(raiz, partes[1]);
      exigir(existsSync(caminhoFonte), `${caso.id}.evidencia.fontes aponta arquivo ausente: ${partes[1]}`);
      const ultimaLinha = Number(partes[3] ?? partes[2]);
      const totalLinhas = readFileSync(caminhoFonte, 'utf8').split(/\r?\n/).length;
      exigir(ultimaLinha <= totalLinhas, `${caso.id}.evidencia.fontes aponta linha inexistente: ${fonte}`);
    }
  }

  return resultado;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  console.log(carregarEValidarTriagem());
}
