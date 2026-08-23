# Licoes Sistemicas

Registre aqui somente incidente de producao, falso verde, seguranca, recorrencia,
falha sistemica, investigacao cara ou erro com alta chance de repetir. Cada nova
licao deve declarar problema, causa, correcao, como evitar, controle e status.

## 2026-08-22 - Migration com DDL no boot do runtime

Problema: deploy tentou DDL com a role runtime e entrou em falha por falta de
`CREATE` no schema. Causa: migration automatica era ligada por default e o painel
de ambiente divergia do documento. Correcao: migrations passaram a ser opt-in e
sao executadas fora de banda com role owner. Como nao repetir: identificar banco,
role e estado de migration antes do deploy. Controle: teste de configuracao,
runbook e staging mutavel. Status do controle: automated.

## 2026-08-18 - Migration presente, mas nao registrada

Problema: uma migration existia no repositorio e nunca seria aplicada. Causa: o
DataSource usa lista explicita e a assercao parcial nao detectava omissao.
Correcao: registrar a migration e comparar o conjunto de arquivos com o conjunto
configurado. Como nao repetir: procurar o registro de artefatos irmaos ao criar
migration, entidade, rota ou DTO. Controle: spec de `opcoes-typeorm.ts`. Status
do controle: automated.

## 2026-08-22 - Health novo medido fora do ambiente real

Problema: um check opcional degradou a saude global em producao. Causa: a regra
foi validada contra configuracao presumida, nao contra o ambiente real.
Correcao: reduzir severidade do check e conferir a configuracao produtiva antes
de declarar aceite. Como nao repetir: producao exige evidencia de producao;
integracao nao e prova substituta. Controle: runbook e regra de evidencia. Status
do controle: documented.

## 2026-08-22 - Ensaio de migration em staging desalinhado

Problema: staging tinha migrations pendentes alem da migration em avaliacao.
Causa: o ensaio nao comparou a altura do schema com producao. Correcao: parar,
reconciliar e repetir o ensaio. Como nao repetir: `migration:show` deve indicar
somente a pendencia planejada antes de rollout. Controle: runbook. Status do
controle: documented.

## 2026-08-20 - CI observado por listagem instavel

Problema: uma consulta paginada sugeriu conclusao antes do run correto terminar.
Causa: `gh run list` e uma janela, nao uma prova do run especifico. Correcao:
esperar e consultar pelo ID do run. Como nao repetir: nunca afirmar CI por nome
ou listagem parcial. Controle: instrucao de ambiente. Status do controle: tested.

## 2026-08-19 - Configuracao do compilador ocultou erros posteriores

Problema: uma falha de configuracao do TypeScript mascarou milhares de erros de
arquivo. Causa: o compilador interrompe analise antes dos arquivos. Correcao:
validar o compilador alvo contra `node_modules` real antes de declarar upgrade
pronto. Como nao repetir: resolver primeiro erros de configuracao e repetir a
checagem completa. Controle: playbook de ambiente. Status do controle: documented.

## 2026-08-19 - Lockfile alterado pela ferramenta errada

Problema: pnpm de versao diferente removeu metadados e um auto-merge deixou
lockfile potencialmente incoerente. Causa: lockfile foi tratado como texto comum.
Correcao: usar a versao fixada, revisar diff e pedir rebase quando dependencias
concorrem. Como nao repetir: validar instalacao congelada antes de merge. Controle:
playbook de ambiente. Status do controle: documented.

## 2026-08-01 - Teste verde pelo motivo errado

Problema: um teste de constraint foi aceito por erro de protocolo, nao pela
constraint. Causa: o teste verificava somente rejeicao. Correcao: conferir codigo
e constraint do erro, usando parametros para `bytea`. Como nao repetir: teste
negativo deve provar o motivo declarado. Controle: regra de evidencia. Status do
controle: documented.

## 2026-08-01 - Dado factual afirmado sem medicao

Problema: impacto de backfill foi descrito sem contar linhas reais. Causa:
inferencia substituiu medicao. Correcao: consultar a fonte antes da afirmacao.
Como nao repetir: numero em prosa vem de comando ou evidencia contemporanea.
Controle: regra de evidencia. Status do controle: documented.

## 2026-08-01 - Ambiente e shell distorceram comandos

Problema: CRLF, PowerShell, Git Bash, glob, PATH e PTY causaram comandos
enganosos ou falhas de execucao. Causa: supor que shell e filesystem sao
intercambiaveis. Correcao: normalizar antes de casar conteudo, usar paths e
comandos apropriados ao shell e confirmar o processo real. Como nao repetir:
consultar o playbook antes de improvisar. Controle: `ENVIRONMENT_PLAYBOOK.md`.
Status do controle: documented.
