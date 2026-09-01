// Politica de licencas de dependencias (PR 49).
//
// O objetivo e tecnico: impedir que licenca incompativel entre em silencio.
// Duas armadilhas guiam a implementacao:
//   1. substring ingenua confunde GPL com LGPL e AGPL, entao a classificacao e
//      por token SPDX;
//   2. expressao dual precisa preservar a semantica de OR e AND, porque
//      "BSD-3-Clause OR GPL-2.0-only" permite escolher o lado permitido.
// Licenca desconhecida exige revisao registrada; nunca e aprovada por omissao.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CAMINHO_POLITICA = join(RAIZ, 'docs', 'governance', 'politica-licencas.json');
const CAMINHO_LEDGER = join(RAIZ, 'docs', 'governance', 'excecoes-supply-chain.json');

// Prioridade de agregacao: quanto maior, pior.
const PESO = { permitida: 0, revisao: 1, desconhecida: 2, bloqueada: 3 };
const PIOR = (a, b) => (PESO[a] >= PESO[b] ? a : b);
const NOME_NPM_VALIDO = /^(?:@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*$/i;
const MELHOR = (a, b) => (PESO[a] <= PESO[b] ? a : b);

export function carregarPolitica({ caminho = CAMINHO_POLITICA } = {}) {
  return JSON.parse(readFileSync(caminho, 'utf8'));
}

function classificarToken(token, politica) {
  const limpo = token.trim().replace(/\+$/, '');
  if (limpo === '') return 'desconhecida';
  if (politica.permitidas.includes(limpo)) return 'permitida';
  if (politica.revisaoObrigatoria.includes(limpo)) return 'revisao';
  if (politica.bloqueadas.includes(limpo)) return 'bloqueada';
  return 'desconhecida';
}

// Avaliador SPDX minimo: parenteses, OR e AND. Nao implementa WITH nem
// operadores de excecao; qualquer coisa fora disso cai em "desconhecida", que
// exige revisao humana em vez de aprovacao silenciosa.
function avaliar(tokens, politica) {
  let posicao = 0;

  function expressao() {
    let valor = termo();
    while (tokens[posicao] === 'OR') {
      posicao += 1;
      valor = MELHOR(valor, termo());
    }
    return valor;
  }

  function termo() {
    let valor = fator();
    while (tokens[posicao] === 'AND') {
      posicao += 1;
      valor = PIOR(valor, fator());
    }
    return valor;
  }

  function fator() {
    const atual = tokens[posicao];
    if (atual === '(') {
      posicao += 1;
      const interno = expressao();
      if (tokens[posicao] === ')') posicao += 1;
      return interno;
    }
    posicao += 1;
    return classificarToken(atual ?? '', politica);
  }

  const resultado = expressao();
  return posicao === tokens.length ? resultado : 'desconhecida';
}

export function classificarExpressao(expressao, politica) {
  if (typeof expressao !== 'string' || expressao.trim() === '') return 'desconhecida';
  const texto = expressao.trim();

  for (const marcador of politica.desconhecidas) {
    if (texto.toUpperCase().startsWith(marcador.toUpperCase())) return 'desconhecida';
  }

  const tokens = texto
    .replace(/\(/g, ' ( ')
    .replace(/\)/g, ' ) ')
    .split(/\s+/)
    .filter(Boolean);

  return avaliar(tokens, politica);
}

function revisaoCobre(politica, nome, classificacao, expressao) {
  if (classificacao !== 'revisao') return false;
  return politica.revisoesConcluidas.some(
    (revisao) =>
      revisao.decisao === 'permitida-sem-modificacao' &&
      revisao.pacotes.includes(nome) &&
      (expressao ?? '').includes(revisao.licenca)
  );
}

function excecaoCobre(excecoes, nome, versao) {
  return excecoes.some(
    (excecao) =>
      excecao.tipo === 'license' && excecao.package === nome && excecao.version === versao
  );
}

export function avaliarInventario(inventario, politica, { excecoes = [] } = {}) {
  const problemas = [];

  for (const { nome, versao, licenca } of inventario) {
    const classificacao = classificarExpressao(licenca, politica);
    if (classificacao === 'permitida') continue;

    if (classificacao === 'bloqueada') {
      problemas.push(`${nome}@${versao}: licenca bloqueada (${licenca}).`);
      continue;
    }
    if (classificacao === 'revisao') {
      if (revisaoCobre(politica, nome, classificacao, licenca)) continue;
      problemas.push(
        `${nome}@${versao}: licenca de revisao obrigatoria (${licenca}) sem revisao concluida na politica.`
      );
      continue;
    }
    if (excecaoCobre(excecoes, nome, versao)) continue;
    problemas.push(
      `${nome}@${versao}: licenca desconhecida (${licenca ?? 'ausente'}) sem excecao datada no ledger.`
    );
  }

  return problemas.length === 0
    ? { aprovado: true, problemas, mensagem: `Licencas aprovadas: ${inventario.length} pacotes.` }
    : {
        aprovado: false,
        problemas,
        mensagem: `Licencas reprovadas (${problemas.length}): ${problemas.join(' ')}`,
      };
}

// Uma dependencia instalada mora em `.../node_modules/<nome>` ou
// `.../node_modules/@escopo/<nome>`. Qualquer outro caminho e conteudo
// empacotado pela propria dependencia, nao uma dependencia do projeto.
export function ehPosicaoDeDependencia(raiz, diretorio, nome) {
  const partes = [
    ...relative(resolve(raiz, '..'), resolve(diretorio)).split(sep).filter(Boolean),
  ];
  const segmentos = nome.split('/').length;
  if (partes.length < segmentos + 1) return false;
  return partes[partes.length - segmentos - 1] === 'node_modules';
}

export function coletarInventario(pastaNodeModules, { profundidadeMaxima = 8 } = {}) {
  const encontrados = new Map();

  function varrer(diretorio, profundidade) {
    if (profundidade > profundidadeMaxima) return;
    let entradas;
    try {
      entradas = readdirSync(diretorio, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entrada of entradas) {
      const caminho = join(diretorio, entrada.name);
      if (entrada.isSymbolicLink()) {
        try {
          if (statSync(caminho).isDirectory()) varrer(caminho, profundidade + 1);
        } catch {
          /* link quebrado no store: ignorar */
        }
        continue;
      }
      if (entrada.isDirectory()) {
        varrer(caminho, profundidade + 1);
        continue;
      }
      if (entrada.name !== 'package.json') continue;
      try {
        const manifesto = JSON.parse(readFileSync(caminho, 'utf8'));
        if (!manifesto.name || !manifesto.version) continue;
        // Pacotes de scaffolding (@nestjs/schematics) carregam package.json de
        // template com placeholders; nao sao dependencias instaladas.
        if (!NOME_NPM_VALIDO.test(manifesto.name)) continue;
        // Algumas dependencias empacotam arvores de teste (por exemplo
        // expo-modules-autolinking/node_modules_mock). So conta o que esta em
        // posicao real de dependencia instalada.
        if (!ehPosicaoDeDependencia(pastaNodeModules, diretorio, manifesto.name)) continue;
        let licenca = manifesto.license;
        if (!licenca && Array.isArray(manifesto.licenses)) {
          licenca = manifesto.licenses.map((item) => item.type ?? item).join(' OR ');
        }
        if (licenca && typeof licenca === 'object') licenca = licenca.type;
        encontrados.set(`${manifesto.name}@${manifesto.version}`, {
          nome: manifesto.name,
          versao: manifesto.version,
          licenca,
        });
      } catch {
        /* package.json invalido dentro de dependencia: ignorar */
      }
    }
  }

  varrer(pastaNodeModules, 0);
  return [...encontrados.values()];
}

export function validarPolitica({ caminho = CAMINHO_POLITICA } = {}) {
  const politica = carregarPolitica({ caminho });

  for (const campo of ['permitidas', 'revisaoObrigatoria', 'bloqueadas', 'desconhecidas']) {
    if (!Array.isArray(politica[campo]) || politica[campo].length === 0) {
      throw new Error(`Politica de licencas invalida: "${campo}" precisa ser uma lista nao vazia.`);
    }
  }

  const vistos = new Map();
  for (const campo of ['permitidas', 'revisaoObrigatoria', 'bloqueadas']) {
    for (const licenca of politica[campo]) {
      if (vistos.has(licenca)) {
        throw new Error(
          `Politica de licencas invalida: ${licenca} aparece em "${vistos.get(licenca)}" e em "${campo}".`
        );
      }
      vistos.set(licenca, campo);
    }
  }

  for (const revisao of politica.revisoesConcluidas ?? []) {
    if (!politica.revisaoObrigatoria.includes(revisao.licenca)) {
      throw new Error(
        `Politica de licencas invalida: revisao concluida para ${revisao.licenca}, que nao esta em "revisaoObrigatoria".`
      );
    }
    for (const campo of ['justificativa', 'owner', 'revisadoEm', 'condicaoDeReabertura']) {
      if (typeof revisao[campo] !== 'string' || revisao[campo].trim().length < 8) {
        throw new Error(
          `Politica de licencas invalida: revisao de ${revisao.licenca} sem "${campo}" util.`
        );
      }
    }
    if (!Array.isArray(revisao.pacotes) || revisao.pacotes.length === 0) {
      throw new Error(
        `Politica de licencas invalida: revisao de ${revisao.licenca} precisa listar os pacotes cobertos.`
      );
    }
  }

  return `Politica de licencas coerente: ${politica.permitidas.length} permitidas, ${politica.revisaoObrigatoria.length} em revisao, ${politica.bloqueadas.length} bloqueadas.`;
}

export function auditarPasta(pastaNodeModules) {
  const politica = carregarPolitica();
  const ledger = JSON.parse(readFileSync(CAMINHO_LEDGER, 'utf8'));
  const inventario = coletarInventario(pastaNodeModules);
  if (inventario.length === 0) {
    throw new Error(
      `Nenhum pacote encontrado em ${pastaNodeModules}; rode a instalacao antes da auditoria de licencas.`
    );
  }
  return avaliarInventario(inventario, politica, { excecoes: ledger.excecoes });
}

if (process.argv[1] && process.argv[1].endsWith('validar-licencas.mjs')) {
  const alvo = process.argv[2];
  if (!alvo) {
    console.log(validarPolitica());
  } else {
    const resultado = auditarPasta(alvo);
    console.log(resultado.mensagem);
    if (!resultado.aprovado) process.exitCode = 1;
  }
}
