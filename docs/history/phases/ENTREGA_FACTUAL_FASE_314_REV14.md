# Evidência da entrega factual Fase314 — REV14

Rodada2026-10-11, worktree `docs-fase-314-planejamento`, branch
`feat/fase-314-validacao-rev11`. Base main consultada2e06bcde e HEAD inicialdb4f317a;
nenhuma alteração preexistente nessa worktree. Outras worktrees preservadas.
PR394 única em Draft, sem merge/ativação/deploy.

## Comparação e alterações

- Main conserva seis métodos18–19 pendentes e snapshotv1; branch REV11 já tem
  seis métodos desde18, v2/ratificação e autorização antes de replay. Não duplicar
  sua implementação nem presumir integração da PR394 aindaOPEN.
- Aviso residual de idade fora do domínio não informa mais ratificação pendente.
  Tradução do antigo aviso adulto identifica histórico, sem recalcular resultados.
- UI pediátrica informa protocolo ratificado/referências não habilitadas, inclusive
  histórico v1; contexto, motivos e dados originais não são modificados.
- Regressões adicionais por sexo/17–20, idade ausente, sexo/medidas ausentes,
  gestação, domínio/população; teste de dependências transitivas a partir de main
  proíbe consumidores assistenciais dos classificadores isolados.
- Contrato/gates separados em `../../product/LIBERACAO_FACTUAL_FASE_314_REV14.md`.
  Atualizados status, roadmap, checklist/T01–T18, ADR e matriz. REV11/G02/oráculos
  originais preservados; REV14 arquivada byte a byte comhash próprio.

## Segurança e limites da revisão

Auto-revisão técnica do diff, contratos e testes, não revisão R4 independente.
Nenhuma nova entidade/migration/dependência/alteração de RLS/criptografia/portal.
A prova existente PostgreSQL real descartável voltou a passar, incluindo runtime
restrito, FORCE RLS, carteira/tenant, replay e concorrência, retenção/rollback.
As migrations1068/1069 estão registradas na configuração. Na etapa inicial nenhum banco externo foi consultado. Após identificação do alvo
pelo usuário, leituras separadas de metadados de produção e staging confirmaram1068/1069,
FORCE RLS, policies, triggers e flags/grants das respectivas roles previstas;
binding efetivo de cada aplicação e testes integrados continuam pendentes. Evidência sanitizada no contrato REV14; nenhuma escrita.
Checklist do revisor humano e condições dos alvos estão no contrato REV14.

## Verificações desta rodada

| Verificação | Resultado real |
| --- | --- |
| AnexoREV14 | PASS byte a byte e SHA256 no disco/blob Git; primeiro diff cached encontrou linha vazia final do original, exceção whitespace limitada a esse anexo imutável, sem relaxar runtime |
| TDD domínio | RED1 FAIL/14 PASS aviso residual; GREEN77 PASS em6 suítes focadas |
| Isolamento transitivo | 2 PASS; fixture cobre import dinâmico/ciclo, grafo real sem consumidores experimentais; correção do path do teste após primeira execução falhar |
| Playwright313/314 | RED2 FAIL mensagem ausente desktop/mobile; GREEN10 PASS; ampliação v1/v2 depois12 PASS desktop/mobile, axe, autorização/leitura/revogação/paginação |
| PostgreSQL Testcontainers | 31 PASS/1 suíte; instância descartável, nenhuma migration externa |
| Typecheckbackend/web | PASS |
| Buildbackend/guard | PASS, sem coeficientes de pesquisa no artefato |
| Lintweb | PASS,0 erros/65 warnings existentes |
| Governança focal | 25 PASS: matriz, guardas e contratos de migrations fora de banda |
| Preflight DocsOnly | PrimeiroFAIL pelo cabeçalho “Fase314” sem espaço; corrigido documento, repetiçãoPASS sem enfraquecer validador |
| Buildweb | PASS |
| Backend completo | 2.650 PASS/54 SKIPPED;295 suítes PASS/3 SKIPPED. Sem variáveis de oráculos integrais nesta rodada factual;4 verificações extras de pesquisa não executadas, não considerar G01 aprovado |
| Test:authz | PASS local:24 comandos, exit0; resultado CI deve ser conferido por HEAD na PR394 |
| CI | db4f317a/run38161961023PASS é anterior; CI do novo HEAD deve ser consultado na PR394 |
| R4 independente | BLOCKED: revisor independente/evidência ainda não disponíveis |
| Migrations/roles por alvo | PARTIAL/BLOCKED: produção e staging conferidos por SELECT de metadados; binding/teste integrado pendentes; nenhuma execução externa de migrations |
| G01/direitos/55s | BLOCKED somente classificadores, não gate factual |
| G02CL01–10 | RATIFICADO_PELO_USUARIO REV9, nenhuma reabertura |
| Merge/deploy/ativação | BLOCKED: autorização expressa necessária |

## Comandos realmente executados

Usada ferramenta Node22/pnpm11.25 existente, sem alterar lockfiles:

- `git fetch origin main`, `git rev-parse HEAD origin/main`, `git status`,
  `git diff --stat`, `gh pr view394`: somente leitura/fetch.
- Node22 `jest --runInBand protecoes-etarias.spec.ts elegibilidade-adulta.spec.ts
  antropometria.spec.ts antropometria-pediatrica.spec.ts servico-pediatrico.spec.ts
  projecao-antropometria.spec.ts`; `jest --runInBand isolamento-factual-rev14.spec.ts`.
- Backend `pnpm test:rls:testcontainers`, `pnpm typecheck`, `pnpm build`.
- Web `pnpm typecheck`, `pnpm lint`, `pnpm exec playwright test
  console-regression.spec.mjs --grep 'Fase 31[34]'`, `pnpm test:authz`, `pnpm build`.
- Node22 `--test scripts/test-matriz-confiabilidade.mjs
  scripts/validar-migracoes-fora-de-banda.spec.mjs
  scripts/validar-guardas-controladores.spec.mjs`.
- `pwsh -NoProfile -File validar-preflight.ps1 -DocsOnly`, `git diff --check`.
- Conector Neon `run_sql`, alvos produção e staging explicitamente identificados: SELECT restritos
  ao diário de migrations e catálogos RLS/policies/triggers/roles/grants; sem linhas clínicas.

São testes/artefatos locais ou checks GitHub, não prova de produção nem aprovação
humana independente. Sem uso de pacientes reais ou mensagem enviada a terceiros.

## Correção dos achados GitHub Advanced Security da PR394

Rodada2026-10-11, riscoR2: somente scripts de pesquisa pública opt-in e seu
controle CI, fora do runtime clínico. Nenhuma dependência nova ou alteração de
cálculo, tolerância, fonte/hashes, snapshot, banco ou ativação assistencial.

- Alerta505 CodeQL (regex hostname): expressão atual já tem pontos escapados;
  três testes reais do padrão comprovam host exato, HTTPS e rejeição de similares.
- Alertas506/507 Semgrep (urllib dinâmico): ambos callsites substituídos por
  transporte stdlib HTTPS restrito com allowlist por chamador, porta443,
  proibição de credenciais/fragmentos/controles e redirecionamentos. TLS padrão;
  sem supressão/dismissal de alertas. Downloader importável sem efeitos de CLI,
  para testar a função real sem rede. Hash divergente continua impedindo gravação.
- TDD: cinco erros antes de criar o transporte; depois11 testes offline PASS
  (segurança do regex/transporte/callsites/download/hash),15 testes dos contratos
  de workflows PASS, ambos CLI --help PASS. Novos testes incluídos na governança CI.
- Não executada nova coleta externa ou validação matemática integral nesta
  correção. G01 e demais gates científicos/operacionais preservados.
- API de detalhes code-scanning retorna403 para a integração; comentários do bot
  foram lidos na PR. Não declarar alertas fechados sem evidência do novo scan.
  Estado dos scanners/CI do commit corrigido deve ser conferido na PR394.

Rollback técnico: reverter o commit de scripts/CI; não há estado persistente do
produto afetado. Reversão reintroduz os callsites inseguros e exige nova análise.

### Aviso adicional de auditoria TLS508

No scan do commit849ad83d, CodeQL não apresenta novas anotações; os comentários
506/507 não apontam mais linhas atuais. Semgrep aponta somente a regra de
`httpsconnection-detected` no novo transporte. A regra pública é incondicional
para HTTPSConnection: pede auditar compatibilidade em Python anterior a3.4.3,
não inspeciona os parâmetros de contexto. Não contornar por alias/supressão.

Correção adicional: ssl.create_default_context com CERT_REQUIRED e check_hostname
explícitos; teste verifica o contexto realmente passado à conexão. O aviso508
permanece sujeito à triagem do scanner/revisor; não declarar fechamento automático.
Regra consultada apenas como texto público, sem execução de conteúdo remoto.
O produto não depende deste script e nenhuma chamada clínica usa essa conexão.

## Dependabot incorporado por autorização posterior

Rodada2026-10-11: usuário solicitou integrar uma PR Dependabot à PR394. Selecionada
PR382: source-map-js1.2.1→1.2.2, dependência transitiva PostCSS da web. Cherry-pick
com rastreabilidade25776976212a762d13765471a21c4d53b1a36556, autor Dependabot
preservado; apenas cinco substituições no lockfile, sem conflitos. Não há mudança
nos contratos clínicos, migrations, portal ou autorizações da Fase314.

Registro npm confirma versão, engineNode>=0.10.0, BSD-3-Clause e SHA512 idêntico ao
lockfile. Sem scripts de install/postinstall no metadata da versão; política de
builds/idade mínima/integridade permanece intacta. Changelog upstream informa
correções CSP e DoS em mapas indexados; essa indicação não prova o encerramento
dos seis alertas de dependências existentes na main.

PASS: pnpm11.25.0 install --frozen-lockfile (450 entradas nas políticas), pacote
instalado1.2.2/BSD-3-Clause, auditoria de licenças392 pacotes, build Next com etapa
TypeScript e geração177 páginas, sem mudanças geradas na worktree. Os checks da
PR382 foram conferidos, mas não aprovam por si o novo HEAD da PR394; CI da PR394
deve passar novamente após o push. Não fechar PR382 antes de integração à main.

Comandos: git fetch origin pull/382/head; git cherry-pick -x 25776976212a762d13765471a21c4d53b1a36556;
pnpm install --frozen-lockfile na web; node scripts/validar-licencas.mjs
octaclin-web/node_modules; pnpm build na web; inspeção package.json instalado.
Rollback limitado à atualização do lockfile, sem dados persistentes afetados.
