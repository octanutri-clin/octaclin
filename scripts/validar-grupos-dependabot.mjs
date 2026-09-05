/**
 * Gate dos grupos de atualizacao do Dependabot.
 *
 * Por que este arquivo existe. O Dependabot agrupa por semver, e para `0.x` o
 * semver mente: a propria especificacao diz que projeto abaixo de `1.0.0` pode
 * quebrar em qualquer minor, e os frameworks usam isso -- cada `0.x` do React
 * Native e um release major dele. Um grupo "minor e patch" sem exclusao entrega
 * major de framework como rotina, e a secao 16 da
 * `docs/governance/POLITICA_SUPPLY_CHAIN_DEPENDENCIAS.md` diz o contrario:
 * major de framework nao e agrupada por conveniencia.
 *
 * Nao e hipotese. Em 2026-09-05 o PR #177 subiu `react-native` de 0.86.2 para
 * 0.87.0 dentro do grupo `mobile-minor-patch`, e o typecheck do mobile reprovou
 * com dezenas de erros de tipagem de estilo.
 *
 * A correcao e uma lista de `exclude-patterns` por nome, porque o Dependabot
 * nao sabe filtrar por faixa de versao ali. Lista por nome envelhece em
 * silencio -- dependencia `0.x` nova entra no grupo sem que nada reclame --, e
 * foi exatamente assim que um override de remediacao virou o pino de uma
 * vulnerabilidade neste mesmo repositorio (secao 9 da politica). Por isso a
 * lista **nao** e verificada contra si mesma: este gate le os `package.json`,
 * calcula quais dependencias estao em `0.x` e compara com o que o
 * `.github/dependabot.yml` declara.
 *
 * O que este gate **nao** faz: ele nao julga se a atualizacao e segura, e nao
 * substitui o CI. Ele garante que uma dependencia que pode quebrar num minor
 * chegue em PR proprio, onde da para olhar para ela.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const raiz = resolve(import.meta.dirname, '..');
const CONFIG = '.github/dependabot.yml';

/** Faixa que o npm resolve dentro de `0.x`, onde minor pode quebrar. */
const VERSAO_ZERO = /^[\^~]?0\./;

/**
 * Componentes npm cobertos, e o grupo de rotina de cada um.
 *
 * A lista e explicita, e nao derivada do arquivo, para que um componente novo
 * sem grupo declarado apareca como omissao aqui em vez de passar despercebido.
 */
export const COMPONENTES = [
  { diretorio: 'octaclin-backend', grupo: 'backend-minor-patch' },
  { diretorio: 'octaclin-web', grupo: 'web-minor-patch' },
  { diretorio: 'octaclin-mobile', grupo: 'mobile-minor-patch' }
];

/** Dependencias declaradas em `0.x` por um `package.json`. */
export function dependenciasVersaoZero(manifesto) {
  const todas = { ...(manifesto.dependencies ?? {}), ...(manifesto.devDependencies ?? {}) };
  return Object.entries(todas)
    .filter(([, faixa]) => VERSAO_ZERO.test(faixa))
    .map(([nome]) => nome)
    .sort();
}

/**
 * Le os `exclude-patterns` de um grupo.
 *
 * Leitura dirigida em vez de parser de YAML: o repositorio nao tem dependencia
 * de YAML e acrescentar uma para ler quinze linhas seria pagar caro. O preco
 * dessa escolha e fail-closed: grupo que a leitura nao encontrar reprova, em vez
 * de devolver lista vazia e aprovar o vazio.
 */
export function lerExclusoes(conteudoBruto, grupo) {
  // Fim de linha normalizado antes de qualquer busca. O repositorio e editado em
  // Windows e o git entrega CRLF na arvore de trabalho: sem isto a leitura
  // funciona no CI, que e Linux, e falha na maquina de quem escreveu. Achado ao
  // rebasear o proprio commit deste gate.
  const conteudo = conteudoBruto.replace(/\r\n/g, '\n');
  const inicio = conteudo.indexOf(`      ${grupo}:\n`);
  if (inicio === -1) throw new Error(`grupo ${grupo} nao encontrado em ${CONFIG}`);

  // O bloco do grupo termina na proxima chave de mesma indentacao ou menor.
  const resto = conteudo.slice(inicio + `      ${grupo}:\n`.length);
  const fim = resto.search(/\n {0,6}[a-zA-Z#-]/);
  const bloco = fim === -1 ? resto : resto.slice(0, fim);

  if (!/^\s*exclude-patterns:/m.test(bloco)) return [];
  return [...bloco.matchAll(/^\s*- "([^"]+)"\s*$/gm)].map((achado) => achado[1]).sort();
}

export function validarGrupos(diretorioRaiz = raiz) {
  const conteudo = readFileSync(resolve(diretorioRaiz, CONFIG), 'utf8');
  const problemas = [];
  let totalZero = 0;

  for (const { diretorio, grupo } of COMPONENTES) {
    const manifesto = JSON.parse(readFileSync(resolve(diretorioRaiz, diretorio, 'package.json'), 'utf8'));
    const zero = dependenciasVersaoZero(manifesto);
    const excluidos = lerExclusoes(conteudo, grupo);
    totalZero += zero.length;

    for (const pacote of zero) {
      if (!excluidos.includes(pacote)) {
        problemas.push(
          `${diretorio}: \`${pacote}\` esta em 0.x e pode ser agrupada por ${grupo}. ` +
            `Acrescente \`- "${pacote}"\` em exclude-patterns: em 0.x um minor pode quebrar, e a atualizacao precisa de PR proprio.`
        );
      }
    }

    // Exclusao que nao corresponde a nenhuma dependencia 0.x e exclusao que
    // ninguem revisou -- ou o pacote saiu, ou ele chegou a 1.0 e voltou a ser
    // rotina.
    for (const pacote of excluidos) {
      if (!zero.includes(pacote)) {
        problemas.push(
          `${diretorio}: \`${pacote}\` esta em exclude-patterns de ${grupo} mas nao e mais uma dependencia 0.x. ` +
            'Remova a exclusao; ela so mantem fora do grupo uma atualizacao que voltou a ser rotina.'
        );
      }
    }
  }

  // Piso de sanidade: se a leitura dos manifests quebrar, o gate passaria a nao
  // achar dependencia `0.x` nenhuma e ficaria verde por ter parado de olhar.
  if (totalZero === 0) {
    problemas.push(
      'Nenhuma dependencia 0.x encontrada nos tres componentes. Isso e improvavel: ' +
        'a leitura dos package.json provavelmente quebrou. Conserte a leitura em vez de aceitar o vazio.'
    );
  }

  return { problemas, totalZero };
}

function executarCli() {
  const { problemas, totalZero } = validarGrupos();

  if (problemas.length > 0) {
    for (const problema of problemas) console.error(`- ${problema}`);
    console.error('\nPolitica: secao 16 de docs/governance/POLITICA_SUPPLY_CHAIN_DEPENDENCIAS.md.');
    process.exitCode = 1;
    return;
  }

  console.log(
    `Grupos do Dependabot validados: ${COMPONENTES.length} componentes, ${totalZero} dependencias 0.x fora dos grupos de rotina.`
  );
}

if (process.argv[1] === resolve(import.meta.dirname, 'validar-grupos-dependabot.mjs')) {
  executarCli();
}
