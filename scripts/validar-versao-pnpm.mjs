// Gate de versao unica e exata do pnpm (PR 49).
//
// Antes deste PR o repositorio convivia com tres respostas diferentes para
// "qual pnpm?": o CI fixava apenas o major `9`, backend e web declaravam
// `pnpm@9.15.9`, raiz e mobile nao declaravam nada e os Dockerfiles chamavam
// `corepack enable` sem versao. Package manager diferente resolve dependencia
// diferente, entao o gate exige uma unica versao exata em todas as fontes.

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Fonte de verdade da versao. Ao atualizar o pnpm, altere aqui e nas fontes
// abaixo; o gate falha enquanto qualquer uma delas discordar.
export const VERSAO_PNPM_ESPERADA = '11.25.0';

export const FONTES_OBRIGATORIAS = [
  'package.json',
  join('octaclin-backend', 'package.json'),
  join('octaclin-web', 'package.json'),
  join('octaclin-mobile', 'package.json'),
  join('.github', 'workflows', 'ci.yml'),
  join('octaclin-backend', 'Dockerfile'),
  join('octaclin-web', 'Dockerfile'),
];

const VERSAO_EXATA = /^\d+\.\d+\.\d+$/;

function falhar(mensagem) {
  throw new Error(`Versao do pnpm inconsistente: ${mensagem}`);
}

export function extrairVersoesDeConteudo(origem, conteudo) {
  const encontradas = [];

  if (origem.endsWith('package.json')) {
    let manifesto;
    try {
      manifesto = JSON.parse(conteudo);
    } catch (erro) {
      falhar(`${origem} nao e JSON valido: ${erro.message}`);
    }
    const declarado = manifesto.packageManager;
    if (typeof declarado === 'string' && declarado.startsWith('pnpm@')) {
      // `pnpm@X.Y.Z+sha512-...`: o hash e opcional na sintaxe, a versao nao.
      const versao = declarado.slice('pnpm@'.length).split('+')[0];
      encontradas.push({ origem, chave: 'packageManager', versao });
    }
    return encontradas;
  }

  if (origem.endsWith('.yml') || origem.endsWith('.yaml')) {
    for (const linha of conteudo.split(/\r?\n/)) {
      const env = linha.match(/^\s*PNPM_VERSION:\s*['"]?([^'"\s#]+)['"]?/);
      if (env) encontradas.push({ origem, chave: 'PNPM_VERSION', versao: env[1] });

      const acao = linha.match(/^\s*version:\s*['"]?(\d[^'"\s#]*)['"]?/);
      if (acao) encontradas.push({ origem, chave: 'pnpm/action-setup version', versao: acao[1] });
    }
    return encontradas;
  }

  if (origem.endsWith('Dockerfile')) {
    for (const linha of conteudo.split(/\r?\n/)) {
      if (!/corepack/.test(linha)) continue;
      const preparado = linha.match(/corepack\s+prepare\s+pnpm@([^\s]+)\s+--activate/);
      if (preparado) {
        encontradas.push({ origem, chave: 'corepack prepare', versao: preparado[1].split('+')[0] });
        continue;
      }
      if (/corepack\s+enable/.test(linha) && !/corepack\s+prepare/.test(conteudo)) {
        falhar(
          `${origem} usa "corepack enable" sem "corepack prepare pnpm@<versao> --activate"; a versao do package manager ficaria implicita.`
        );
      }
    }
    return encontradas;
  }

  return encontradas;
}

export function validarVersoes(versoes, { fontesObrigatorias = [], esperada = VERSAO_PNPM_ESPERADA } = {}) {
  for (const { origem, chave, versao } of versoes) {
    if (!VERSAO_EXATA.test(versao)) {
      falhar(`${origem} (${chave}) declara "${versao}"; e obrigatorio usar versao exata X.Y.Z.`);
    }
    if (versao !== esperada) {
      falhar(
        `${origem} (${chave}) declara ${versao} e a politica exige ${esperada}; as fontes divergem.`
      );
    }
  }

  const declarantes = new Set(versoes.map((entrada) => entrada.origem));
  for (const fonte of fontesObrigatorias) {
    if (!declarantes.has(fonte)) {
      falhar(`${fonte} nao declara a versao do pnpm.`);
    }
  }

  return versoes.length;
}

export function validarFontesDeVersao({ raiz = RAIZ, esperada = VERSAO_PNPM_ESPERADA } = {}) {
  const versoes = [];
  for (const fonte of FONTES_OBRIGATORIAS) {
    let conteudo;
    try {
      conteudo = readFileSync(join(raiz, fonte), 'utf8');
    } catch (erro) {
      falhar(`nao foi possivel ler ${fonte}: ${erro.message}`);
    }
    versoes.push(...extrairVersoesDeConteudo(fonte, conteudo));
  }

  const total = validarVersoes(versoes, { fontesObrigatorias: FONTES_OBRIGATORIAS, esperada });
  return `Versao do pnpm consistente em ${total} declaracoes: ${esperada}.`;
}

if (process.argv[1] && process.argv[1].endsWith('validar-versao-pnpm.mjs')) {
  console.log(validarFontesDeVersao());
}
