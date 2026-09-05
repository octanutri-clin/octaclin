/**
 * Gate de coerencia da versao do Node.
 *
 * Por que este arquivo existe. Em 2026-09-05 o Dependabot propos subir a imagem
 * base de `node:22-alpine` para `node:26-alpine` (PRs #180 e #181) mexendo
 * **somente** no `Dockerfile`. Se aquilo tivesse entrado, a imagem publicada
 * rodaria Node 26 enquanto todo teste que a aprova roda em Node 22 -- o artefato
 * entregue deixaria de ser o artefato testado, e nenhum check mostraria isso.
 *
 * A versao do runtime esta declarada em quatro lugares, e os quatro precisam
 * concordar. Este gate compara os tres primeiros entre si e trata o quarto como
 * divergencia declarada com prazo:
 *
 * 1. `NODE_VERSION` em `.github/workflows/ci.yml` -- onde os testes rodam;
 * 2. `FROM node:<major>-alpine` nos Dockerfiles -- onde o codigo roda;
 * 3. `engines.node` de cada `package.json` -- o que o repositorio afirma exigir;
 * 4. `@types/node` -- contra o que o codigo e tipado.
 *
 * O que este gate **nao** faz: ele nao opina sobre qual major usar. Ele exige
 * que a escolha seja a mesma nos tres pontos, de modo que uma migracao de
 * runtime mova todos juntos ou nao passe.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const raiz = resolve(import.meta.dirname, '..');

/** Manifests cujo `engines.node` e comparado com o CI. */
export const MANIFESTS = [
  'package.json',
  'octaclin-backend/package.json',
  'octaclin-web/package.json',
  'octaclin-mobile/package.json'
];

/** Dockerfiles cuja imagem base e comparada com o CI. */
export const DOCKERFILES = ['octaclin-backend/Dockerfile', 'octaclin-web/Dockerfile'];

/**
 * Divergencia declarada de `@types/node`, com prazo.
 *
 * O codigo e tipado contra o Node 26 e roda no 22. O alinhamento obvio -- baixar
 * os tipos para 22 -- **nao e executavel**: `@types/node@22.x` depende de
 * `undici-types@6.21.0`, que o `trustPolicy: no-downgrade` do PR 49 recusa com
 * `ERR_PNPM_TRUST_DOWNGRADE`, porque versoes publicadas antes dela tinham
 * atestado de proveniencia e ela nao tem. Abrir excecao de trust policy para
 * corrigir um desalinhamento de tipagem seria trocar um controle de supply chain
 * por conforto de tipos, e a troca nao compensa.
 *
 * O caminho que fecha a divergencia e o **inverso**: subir o runtime para o 26,
 * quando ele virar LTS. Por isso o prazo abaixo e a data de LTS do Node 26, a
 * mesma registrada no `CHECKLIST_FASES_FUTURAS_PRODUCAO.md` para reabrir os PRs
 * #180 e #181. Passada essa data, este gate reprova: a divergencia volta para a
 * mesa em vez de virar permanente.
 *
 * O risco aceito enquanto ela dura, escrito para nao ser descoberto depois: uma
 * API que so existe no Node 26 compila e lanca em runtime. O que contem isso e o
 * `engines.node`, que declara 22, e a suite completa rodando na versao real.
 */
export const DIVERGENCIA_TYPES_NODE = {
  pacote: '@types/node',
  majorAceito: 26,
  ate: '2026-10-28',
  motivo:
    '@types/node@22.x puxa undici-types@6.21.0, recusado pelo trustPolicy: no-downgrade. ' +
    'A divergencia fecha subindo o runtime para o Node 26 na data de LTS dele, e nao baixando os tipos.'
};

const MAJOR = /^(\d+)/;

export function majorDe(faixa) {
  const numeros = String(faixa).match(/\d+/);
  return numeros ? Number(numeros[0]) : undefined;
}

/** `NODE_VERSION: "22"` do workflow de CI. */
export function lerNodeDoCi(conteudo) {
  const achado = conteudo.replace(/\r\n/g, '\n').match(/^\s*NODE_VERSION:\s*"?(\d+)"?\s*$/m);
  if (!achado) throw new Error('NODE_VERSION nao encontrado em .github/workflows/ci.yml');
  return Number(achado[1]);
}

/** Majors distintos de `FROM node:<major>-alpine` num Dockerfile. */
export function lerNodeDoDockerfile(conteudo) {
  const achados = [...conteudo.matchAll(/^FROM\s+node:(\d+)-/gm)].map((a) => Number(a[1]));
  if (achados.length === 0) throw new Error('nenhum FROM node:<major> encontrado');
  return [...new Set(achados)];
}

export function validarVersaoNode(diretorioRaiz = raiz, hoje = new Date()) {
  const problemas = [];
  const ci = lerNodeDoCi(readFileSync(resolve(diretorioRaiz, '.github/workflows/ci.yml'), 'utf8'));

  for (const arquivo of DOCKERFILES) {
    const majors = lerNodeDoDockerfile(readFileSync(resolve(diretorioRaiz, arquivo), 'utf8'));
    for (const major of majors) {
      if (major !== ci) {
        problemas.push(
          `${arquivo}: imagem base e node:${major} e o CI roda Node ${ci}. ` +
            'A imagem publicada deixaria de ser a versao testada; mova NODE_VERSION e o Dockerfile no mesmo commit.'
        );
      }
    }
  }

  let comEngines = 0;
  for (const arquivo of MANIFESTS) {
    const manifesto = JSON.parse(readFileSync(resolve(diretorioRaiz, arquivo), 'utf8'));
    const declarado = manifesto.engines?.node;
    if (!declarado) {
      problemas.push(
        `${arquivo}: sem \`engines.node\`. Sem ele o repositorio nao diz em qual runtime ele roda, ` +
          'e uma divergencia de versao passa a ser descoberta em producao.'
      );
      continue;
    }
    comEngines += 1;
    if (majorDe(declarado) !== ci) {
      problemas.push(`${arquivo}: \`engines.node\` declara ${declarado} e o CI roda Node ${ci}.`);
    }

    const tipos = manifesto.devDependencies?.['@types/node'] ?? manifesto.dependencies?.['@types/node'];
    if (!tipos) continue;
    const majorTipos = majorDe(tipos);
    if (majorTipos === ci) continue;

    // Divergencia conhecida: aceita ate a data declarada, e so nela.
    if (majorTipos === DIVERGENCIA_TYPES_NODE.majorAceito && hoje <= new Date(`${DIVERGENCIA_TYPES_NODE.ate}T23:59:59Z`)) {
      continue;
    }
    problemas.push(
      `${arquivo}: \`@types/node\` esta em ${tipos} e o CI roda Node ${ci}. ` +
        (majorTipos === DIVERGENCIA_TYPES_NODE.majorAceito
          ? `A divergencia declarada venceu em ${DIVERGENCIA_TYPES_NODE.ate}: suba o runtime ou renove a decisao por escrito.`
          : 'Codigo tipado contra um major e rodando em outro compila usando API que pode nao existir em runtime.')
    );
  }

  // Piso de sanidade: se a leitura dos manifests quebrar, o gate passaria a nao
  // comparar nada e ficaria verde por ter parado de olhar.
  if (comEngines < MANIFESTS.length) {
    problemas.push(
      `Apenas ${comEngines} de ${MANIFESTS.length} manifests tinham \`engines.node\` legivel. ` +
        'Conserte a leitura ou a declaracao, em vez de aceitar a comparacao parcial.'
    );
  }

  return { ci, problemas };
}

function executarCli() {
  const { ci, problemas } = validarVersaoNode();

  if (problemas.length > 0) {
    for (const problema of problemas) console.error(`- ${problema}`);
    console.error(
      '\nPolitica: secao 16 de docs/governance/POLITICA_SUPPLY_CHAIN_DEPENDENCIAS.md. ' +
        'Major de runtime move CI, imagem base, engines e tipos no mesmo PR.'
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    `Versao do Node coerente: CI, ${DOCKERFILES.length} imagens base e ${MANIFESTS.length} manifests em Node ${ci}; ` +
      `divergencia declarada de @types/node valida ate ${DIVERGENCIA_TYPES_NODE.ate}.`
  );
}

if (process.argv[1] === resolve(import.meta.dirname, 'validar-versao-node.mjs')) {
  executarCli();
}
