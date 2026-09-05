/**
 * Gate do procedimento de resposta a incidente de auditoria (PR 52 da
 * governanca, fase 3).
 *
 * Por que este arquivo existe. As proibicoes desta secao do runbook sao o
 * controle: "nao desabilitar o gatilho", "nao rodar `migration:revert`", "nao
 * reiniciar antes de ler o contador", "nao inserir linha sintetica na trilha em
 * producao". Nenhuma delas tem representacao em codigo -- elas so existem como
 * texto, e texto se perde numa reescrita bem-intencionada sem que nada reprove.
 * O defeito central deste PR, desde a fase 1, e exatamente a frase confortavel
 * que ninguem confere contra o mecanismo.
 *
 * O que este gate NAO faz: ele nao verifica a logica dos alertas (isso e teste
 * do proprio codigo) e nao valida limiar. Ele reprova a remocao silenciosa das
 * proibicoes e a degradacao do tabletop em exercicio sem achado.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const raiz = resolve(import.meta.dirname, '..');
const runbook = readFileSync(resolve(raiz, 'RUNBOOK_PRODUCAO.md'), 'utf8');
const tabletop = readFileSync(
  resolve(raiz, 'docs/governance/TABLETOP_AUDITORIA_PR52_FASE3_2026-09-04.md'),
  'utf8'
);

/**
 * Colapsa espaco em branco antes de procurar.
 *
 * Os dois documentos sao quebrados em 80 colunas, entao uma frase inteira quase
 * nunca cabe numa linha so: procurar pelo texto cru faria o gate reprovar por
 * causa da posicao de uma quebra de linha. O gate existe para reprovar a
 * **remocao** da regra, e nao a reformatacao do paragrafo -- e um gate que
 * reprova por reformatacao e um gate que alguem desliga.
 */
function normalizar(texto) {
  return texto.replace(/\s+/g, ' ');
}

const runbookNormalizado = normalizar(runbook);
const tabletopNormalizado = normalizar(tabletop);

const secoesRunbook = [
  '## Alertas operacionais',
  '### Teste de alerta da trilha de auditoria (PR 52 da governanca, fase 3)',
  '#### Alerta de falha de gravacao da trilha',
  '#### Alerta de volume de negativa de autorizacao',
  '## Incidentes',
  '### Incidente de auditoria e seguranca (PR 52 da governanca, fase 3)',
  '#### Deteccao',
  '#### Triagem e classificacao',
  '#### Escalonamento',
  '#### Contencao de credencial suspeita',
  '#### Preservacao de evidencia',
  '#### Comunicacao e registro',
  '#### Encerramento'
];

for (const secao of secoesRunbook) {
  assert.ok(runbookNormalizado.includes(secao), `secao obrigatoria ausente no runbook: ${secao}`);
}

// Proibicoes que sao o controle. Perder qualquer uma reabre um caminho que
// destroi evidencia de forma irreversivel.
const proibicoesRunbook = [
  'nao desabilitar o gatilho',
  'migration:revert',
  'Nao restaurar backup sobre producao',
  'antes de ler o contador de falhas',
  'nao inserir linha sintetica na trilha para testar',
  'Nao inserir linha sintetica na trilha',
  'Nao abra issue publica'
];

// Comparacao sem caixa: a proibicao aparece ora no meio da frase, ora abrindo
// um item de lista. O que este gate protege e a existencia da regra, e nao a
// letra maiuscula -- acoplar a caixa faria o gate reprovar uma reescritura
// legitima e, pior, ensinaria a desligar o gate em vez de ler o que ele diz.
const runbookMinusculo = runbookNormalizado.toLowerCase();
for (const proibicao of proibicoesRunbook) {
  assert.ok(
    runbookMinusculo.includes(normalizar(proibicao).toLowerCase()),
    `proibicao ausente no runbook: ${proibicao}`
  );
}

// Mecanismos e caminhos citados pelo procedimento. Um runbook que manda rodar
// um comando inexistente e pior que um runbook vazio, entao o que ele cita
// precisa continuar sendo o que o repositorio tem.
const mecanismosRunbook = [
  '42501',
  "tgenabled = 'A'",
  'select current_database();',
  'user_action_logs',
  '/api/operacoes/auditoria/paginada',
  'operacoes.auditoria.exportar_csv',
  'docs/governance/POLITICA_TRILHA_AUDITORIA_E_REDACAO.md',
  'docs/agents/LESSONS_LEARNED.md',
  'RUNBOOK_ROTACAO_SECRETS.md',
  'RUNBOOK_BACKUP_RESTORE.md',
  'SLA_SUPORTE.md',
  'SECURITY.md'
];

for (const mecanismo of mecanismosRunbook) {
  assert.ok(runbookNormalizado.includes(mecanismo), `referencia ausente no runbook: ${mecanismo}`);
}

// O encerramento precisa continuar exigindo a declaracao do intervalo sem
// trilha. Sem essa condicao, fechar o incidente vira afirmacao falsa de
// cobertura -- o achado T-01 do tabletop.
assert.ok(
  runbookNormalizado.includes('O intervalo sem trilha esta declarado'),
  'condicao de encerramento sobre o intervalo sem trilha foi removida'
);

// A escala de risco e a do AGENTS.md; o runbook nao pode passar a inventar
// outra.
for (const nivel of ['R3', 'R4', 'R5']) {
  assert.ok(runbookNormalizado.includes(nivel), `nivel de risco ausente na triagem: ${nivel}`);
}

// --- Tabletop -------------------------------------------------------------
//
// Um tabletop so vale se encontrar defeito. Um exercicio em que tudo funciona
// nao e evidencia de prontidao, e sim evidencia de que o roteiro foi escrito
// para passar -- e um gate que aceitasse isso seria o controle que roda verde
// sem proteger nada.

const achados = tabletop.match(/ACHADO-\d{2}/g) ?? [];
const achadosDistintos = new Set(achados);
assert.ok(
  achadosDistintos.size >= 5,
  `tabletop sem achados suficientes: ${achadosDistintos.size} distintos`
);

const excecoesPropostas = new Set(tabletop.match(/EXC-AUD-\d{3}/g) ?? []);
assert.ok(
  excecoesPropostas.size >= 1,
  'tabletop sem nenhuma lacuna aberta: exercicio sem lacuna alguma exige justificativa escrita, nao silencio'
);

const cenarios = ['## 4. Cenario T-01', '## 5. Cenario T-02', '## 6. Cenario T-03'];
for (const cenario of cenarios) {
  assert.ok(tabletopNormalizado.includes(cenario), `cenario ausente no tabletop: ${cenario}`);
}

// Cada cenario declara o desfecho do exercicio, e nao apenas o roteiro.
const resultados = tabletop.match(/\*\*Resultado do exercicio T-0\d:/g) ?? [];
assert.equal(resultados.length, cenarios.length, 'cenario sem resultado declarado no tabletop');

// Dado sintetico e limite de escopo sao condicao do exercicio, e nao ornamento.
const declaracoesTabletop = [
  '**Todos os dados destes cenarios sao sinteticos.**',
  'Nao houve acesso a producao, a staging, a provedor, a painel ou a credencial.',
  'Nao inventou limiar.'
];

for (const declaracao of declaracoesTabletop) {
  assert.ok(
    tabletopNormalizado.includes(normalizar(declaracao)),
    `declaracao obrigatoria ausente no tabletop: ${declaracao}`
  );
}

console.log(
  `Procedimento de resposta a incidente de auditoria validado: ${achadosDistintos.size} achados, ${excecoesPropostas.size} lacunas propostas.`
);
