# Licoes Sistemicas

Registre aqui somente incidente de producao, falso verde, seguranca, recorrencia,
falha sistemica, investigacao cara ou erro com alta chance de repetir. Cada nova
licao deve declarar problema, causa, correcao, como evitar, controle e status.

## 2026-09-09 - Precheck de idempotencia perdeu o commit concorrente

Problema: duas requisicoes simultaneas do mesmo provisionamento receberam `201`
e `409`, em vez de ambas convergirem no tenant vencedor. Causa: a consulta por
referencia ocorreu antes do commit concorrente e a consulta seguinte por slug
ocorreu depois; o precheck tratou o slug visivel como colisao sem comparar sua
referencia. Correcao: reutilizar o tenant encontrado por slug somente quando a
referencia tambem coincide. Como evitar: testes de idempotencia devem cobrir o
interleaving entre leituras, alem da violacao de unicidade no `INSERT`. Controle:
regressoes positiva e negativa de `ServicoCicloVidaTenant.provisionar`, mais a
jornada concorrente do staging descartavel. Status do controle: automated.

## 2026-09-08 - Exit code nativo oculto no preflight PowerShell

Problema: `git diff --check` e `git status` falharam por `safe.directory`, mas o
preflight imprimiu `OK` e terminou com exit code zero. Causa: `Stop` trata erros
do PowerShell, mas nao transforma automaticamente o exit code de processo nativo
em excecao. Correcao: todos os comandos nativos do preflight passam por um
wrapper que verifica `$LASTEXITCODE` e falha fechado. Como evitar: toda nova
chamada nativa nesse orquestrador deve usar o wrapper. Controle: regressao cria
um Git sintetico que retorna `42` e exige falha sem a mensagem final de sucesso.
Status do controle: automated.

## 2026-09-08 - Job AI auditava dependencias sem executar a suite

Problema: o job `AI FastAPI` instalava o lock, compilava e auditava o grafo,
mas nao executava `tests/test_main.py`, embora a matriz declarasse essa prova.
Causa: o comando de testes nao estava ligado ao workflow. Correcao: executar a
suite depois da instalacao verificada por hash. Como evitar: declaracao de gate
deve ser confrontada com o comando real do CI. Controle: o teste do lock tambem
exige `python -m unittest discover -s tests -v` dentro do job AI.
Status do controle: automated.

## 2026-09-08 - Patch de pacote nao garante artefato suportado corrigido

Problema: o scanner informa uma versao corrigida do pacote, mas a imagem-base
oficial fixada ainda nao a incorporou. Causa: disponibilidade foi avaliada no
nivel do pacote, sem distinguir a camada e o artefato realmente consumido.
Correcao: manter o alerta aberto em `aguardando_upstream` somente com
`bloqueioUpstream` explicito, digest observado e condicao de saida. Como evitar:
reconciliar pacote, camada, imagem oficial e arquiteturas antes de chamar um
achado de corrigivel. Controle: gate do inventario SQ-4. Status do controle:
automated.

## 2026-09-07 - Prazo de revisao invisivel ao gate do inventario

Problema: a suite validava o inventario com data fixa e ficava verde apos o
vencimento de uma revisao. Causa: o comando de CI executava somente specs.
Correcao: executar tambem a CLI do validador com o relogio corrente. Como evitar:
manter fixtures deterministicas e validar prazos ativos com a data real no gate.
Controle: regressao da CLI vinculada ao comando de CI, cobrindo o ultimo dia
vigente e o primeiro dia vencido em UTC. Status do controle: automated.

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
