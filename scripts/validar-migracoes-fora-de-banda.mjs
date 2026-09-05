/**
 * Gate de aplicacao de migration fora de banda.
 *
 * Por que este arquivo existe. A role de runtime (`octaclin_app_producao`) nao
 * tem `CREATE` no schema `public` -- decisao do PR 51 da governanca, e devolver
 * esse privilegio desfaz aquela separacao. Toda migration com DDL precisa,
 * portanto, ser aplicada fora de banda com a role owner **antes do merge**,
 * pelo procedimento do `RUNBOOK_PRODUCAO.md`.
 *
 * Nada no CI detectava que uma PR carregava migration com DDL. O sintoma da
 * omissao nao aparece no CI: o boot novo falha com `permission denied for
 * schema public`, o Render mantem a instancia anterior servindo, e o deploy
 * entra em laco de falha visivel so no painel. E a segunda vez que esta classe
 * de falha aparece -- a primeira esta na secao 2 da
 * `docs/governance/POLITICA_PROVIDERS_MENOR_PRIVILEGIO.md` (o relatorio da fase 2
 * do PR 52 a citou como secao 3, e esta e a referencia certa), e a segunda na
 * secao 9 do `docs/governance/RELATORIO_SEGURANCA_PR52_FASE2_2026-09-03.md`,
 * que registrou "um gate que reprove PR com migration nova sem checklist de
 * aplicacao fora de banda" como trabalho a fazer.
 *
 * O que este gate faz: obriga cada migration a **declarar** como e aplicada, e
 * confere a declaracao contra o SQL que a propria migration executa. Declaracao
 * sozinha seria s afirmacao -- e afirmacao verdadeira quando escrita, sem nada
 * que a sustente depois, e exatamente o defeito que o PR 52 passou tres fases
 * corrigindo. Por isso a classificacao e **derivada do arquivo** e comparada com
 * o que ele declara.
 *
 * O que este gate **nao** faz, e nao tem como fazer: ele nao prova que a
 * migration foi aplicada em ambiente algum. Isso e estado operacional, vive fora
 * do Git e nao pode ser inferido daqui. Ele prova que quem escreveu a migration
 * classificou-a, e que a classificacao nao contradiz o SQL.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const raiz = resolve(import.meta.dirname, '..');
const DIRETORIO = 'octaclin-backend/src/infraestrutura/banco-dados/migracoes';

/** Valores aceitos na tag, e o que cada um afirma. */
const APLICACAO_FORA_DE_BANDA = 'fora-de-banda';
const APLICACAO_SOMENTE_DADOS = 'somente-dados';
const VALORES = new Set([APLICACAO_FORA_DE_BANDA, APLICACAO_SOMENTE_DADOS]);

/**
 * DDL que a role de runtime nao pode executar.
 *
 * A lista e de verbos de esquema, e nao de "comandos perigosos": o criterio
 * aqui nao e risco, e sim **privilegio**. `create index` e inofensivo do ponto
 * de vista de dados e mesmo assim exige owner, que e justamente o caso que
 * passaria despercebido por uma lista escrita por risco.
 */
const DDL = /\b(create|alter|drop)\s+(?:or\s+replace\s+)?(?:unique\s+)?(?:materialized\s+)?(table|function|trigger|index|type|extension|view|schema|sequence|policy|publication|domain|rule)\b/gi;

/**
 * Piso de sanidade do proprio extrator.
 *
 * Se a leitura do SQL quebrar, o gate passaria a achar que nenhuma migration
 * tem DDL e ficaria verde por ter parado de olhar -- o falso verde que a norma
 * do PR 51 nomeia como `nao-verificado` e o PR 52 repete no gate de redacao.
 * O numero e piso, e nao alvo: ele so precisa ser alto o bastante para que um
 * extrator quebrado nao passe.
 */
const PISO_MIGRACOES_COM_DDL = 40;

/** A tag declarada pelo autor, em comentario, em qualquer ponto do arquivo. */
const TAG = /@aplicacao\s+([a-z-]+)/g;

export function listarMigracoes(diretorio = resolve(raiz, DIRETORIO)) {
  return readdirSync(diretorio)
    .filter((nome) => nome.endsWith('.ts') && !nome.endsWith('.spec.ts'))
    .sort();
}

/** Verbos de DDL distintos encontrados no arquivo, em ordem estavel. */
export function extrairDdl(conteudo) {
  const encontrados = new Set();
  for (const achado of conteudo.matchAll(DDL)) {
    encontrados.add(`${achado[1]} ${achado[2]}`.toLowerCase().replace(/\s+/g, ' '));
  }
  return [...encontrados].sort();
}

/** Valores declarados na tag. Mais de um e erro: a migration tem uma classificacao so. */
export function extrairDeclaracao(conteudo) {
  return [...conteudo.matchAll(TAG)].map((achado) => achado[1]);
}

export function avaliarMigracao(nome, conteudo) {
  const ddl = extrairDdl(conteudo);
  const declaracoes = extrairDeclaracao(conteudo);
  const problemas = [];

  if (declaracoes.length === 0) {
    problemas.push(
      `${nome}: sem declaracao de aplicacao. Acrescente ` +
        `\`@aplicacao ${ddl.length > 0 ? APLICACAO_FORA_DE_BANDA : APLICACAO_SOMENTE_DADOS}\` ` +
        'ao comentario da classe e siga o procedimento de migration do RUNBOOK_PRODUCAO.md.'
    );
  } else if (declaracoes.length > 1) {
    problemas.push(`${nome}: ${declaracoes.length} declaracoes \`@aplicacao\`; a migration tem uma classificacao so.`);
  } else if (!VALORES.has(declaracoes[0])) {
    problemas.push(
      `${nome}: \`@aplicacao ${declaracoes[0]}\` nao e valor conhecido. Use ` +
        `\`${APLICACAO_FORA_DE_BANDA}\` ou \`${APLICACAO_SOMENTE_DADOS}\`.`
    );
  } else if (declaracoes[0] === APLICACAO_SOMENTE_DADOS && ddl.length > 0) {
    // A direcao perigosa, e a unica que reprova por divergencia. Declarar
    // `somente-dados` uma migration que cria objeto de esquema e a afirmacao que
    // faz o deploy entrar em laco de falha: ela diz ao revisor que nao ha passo
    // humano, e ha.
    problemas.push(
      `${nome}: declara \`@aplicacao ${APLICACAO_SOMENTE_DADOS}\` mas executa DDL (${ddl.join(', ')}). ` +
        'A role de runtime nao tem CREATE no schema public; esta migration exige aplicacao fora de banda com a role owner.'
    );
  }

  return { nome, ddl, declaracao: declaracoes[0], problemas };
}

export function validarMigracoes(diretorio = resolve(raiz, DIRETORIO)) {
  const nomes = listarMigracoes(diretorio);
  const avaliacoes = nomes.map((nome) => avaliarMigracao(nome, readFileSync(resolve(diretorio, nome), 'utf8')));
  const problemas = avaliacoes.flatMap((avaliacao) => avaliacao.problemas);
  const comDdl = avaliacoes.filter((avaliacao) => avaliacao.ddl.length > 0);

  // A direcao conservadora nao reprova: declarar `fora-de-banda` uma migration
  // sem DDL apenas manda fazer um procedimento a mais. Mas ela e registrada,
  // porque uma migration que perdeu o DDL num rebase se parece com isso.
  const conservadoras = avaliacoes.filter(
    (avaliacao) => avaliacao.declaracao === APLICACAO_FORA_DE_BANDA && avaliacao.ddl.length === 0
  );

  if (comDdl.length < PISO_MIGRACOES_COM_DDL) {
    problemas.push(
      `Piso de sanidade do extrator: so ${comDdl.length} de ${nomes.length} migrations foram lidas como DDL, ` +
        `abaixo do piso de ${PISO_MIGRACOES_COM_DDL}. Um extrator quebrado aprova o vazio; conserte a leitura em vez de baixar o piso.`
    );
  }

  return { nomes, avaliacoes, comDdl, conservadoras, problemas };
}

function executarCli() {
  const { nomes, comDdl, conservadoras, problemas } = validarMigracoes();

  if (problemas.length > 0) {
    for (const problema of problemas) console.error(`- ${problema}`);
    console.error(
      '\nProcedimento: RUNBOOK_PRODUCAO.md, secao "Banco de dados". ' +
        'Migration com DDL e aplicada fora de banda com a role owner antes do merge.'
    );
    process.exitCode = 1;
    return;
  }

  const conservador = conservadoras.length > 0 ? `; ${conservadoras.length} declaram fora-de-banda sem DDL` : '';
  console.log(
    `Migrations validadas: ${nomes.length} declaradas, ${comDdl.length} exigem aplicacao fora de banda com a role owner${conservador}.`
  );
}

if (process.argv[1] === resolve(import.meta.dirname, 'validar-migracoes-fora-de-banda.mjs')) {
  executarCli();
}
