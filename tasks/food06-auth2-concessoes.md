# FOOD06 Auth-2 — serviço e administração de concessões

## Escopo e base

Risco R4 (auth/authz). Branch `claude/food06-auth2-servico`, baseada em
`f8cf057b4c9f12e6e777e02b702d5d83584aef15` da Auth-1 (#533, ainda Draft).
PR empilhada: depende da integração da Auth-1; sem merge automático.
Fonte do escopo: `tasks/food06-handoff-proximas-prs.md` no commit
`bdf5b218fd41749a9e4ff5da4d940bd91eb4c2b2` (o arquivo ainda não está na main
consultada `4804f4820408dca16340051ce115032d7093fc60`). Nenhuma integração implícita.

Somente Auth-2: serviço, endpoints administrativos e revogação no ciclo de vida
do usuário. Sem telas, sem confirmação de restrições clínicas, sem Auth-3/P2/P3,
sem migrations novas. O guard síncrono e a matriz de papéis permanecem intactos.

## Etapa 1 — serviço transacional

- `exigir` lê usuário ativo Professional e concessão ativa no banco/RLS, nunca
  claims do JWT. Com gerenciador explícito, exige transação ativa, não abre outra
  transação e mantém locks até o commit. A forma de três argumentos confere
  apenas aquele instante; o futuro consumidor deve passar o gerenciador da ação.
- Professional ativo pode conceder (inclusive a si) e SuperAdmin ativo pode
  administrar no próprio tenant. O alvo da concessão é somente Professional
  ativo. SuperAdmin não adquire implicitamente a capacidade clínica.
- Motivo administrativo fechado `habilitacao_administrativa`, sem texto livre;
  confirmação explícita estrita `true`. Não representa reautenticação nem
  validação de conselho profissional.
- Locks em usuários por UUID ordenado, depois concessão. Duplicata ativa e
  conflitos retornam 409, sem retry cego. Revogação por ID é idempotente e não
  atinge uma concessão posterior.
- Auditoria na mesma transação, metadados vazios; falha desfaz a operação.
  Projeção mínima, sem e-mail, tenant, motivo ou dados clínicos.

### Evidência local (2026-11-13)

- RED funcional: 9 falhas / 7 PASS em PostgreSQL 15 descartável (não falha de setup).
- GREEN ampliado: 22/22 PASS. Runtime não-owner, não-superuser, sem BYPASSRLS;
  RLS real, revogação, replay, concorrência, rollback de auditoria, paginação,
  exclusão mútua entre ação protegida e revogação.
- Typecheck backend: PASS, Node 22.21.1.
- Dependências reaproveitadas em modo leitura: grafo local não corresponde
  integralmente ao lock (TypeORM 1.1.1/Testcontainers 12.1.0); CI com lock exato
  continua necessário. Não foram alterados manifestos, engines ou lockfiles.
- Checkpoint inicial do serviço; complementado pela etapa 2 abaixo.
- R4 independente e CI desta branch: NOT RUN neste checkpoint.

## Limites e rollback

Sem DDL externo, acesso SQL externo, merge, deploy ou alteração operacional.
Migration 1084 pertence à Auth-1 e só foi usada no PostgreSQL descartável.
Reverter código não apaga concessões nem auditoria; não executar `down` para
apagar histórico. Futuro consumidor clínico deve permanecer fechado enquanto o
contrato e os gates de ativação não forem liberados.

## Etapa 2 — HTTP e ciclo de vida

- POST `/auth/concessoes-permissao`: usuário alvo, permissão fechada, motivo
  administrativo fechado e confirmação estrita; 201. POST `/:id/revogar`: somente
  confirmação; 200 e replay seguro por ID. GET `/usuarios/:usuarioId`: histórico
  paginado (página 1–1000, limite 1–50, padrão 25). Guardas de sessão, papel e
  `console.acessar`; serviço revalida o banco. Respostas `private, no-store`.
- DTOs por allowlist e parâmetros UUID; nenhuma credencial adicional ou tenant
  aceito no payload. Provider exportado no ModuloAuth; guard síncrono intacto.
- Cascata em `modulos/clientes/aplicacao/servico-usuarios-cliente.ts` (o caminho
  em `integracoes` citado no handoff não existe). Reusa a mesma transação de
  desativação, revogação de convite e mudança de papel; reativar não recria grant.
- RED HTTP: 6 falhas funcionais por rotas ausentes; GREEN: 6/6 PASS.
- RED cascata: 1 falha funcional / 16 PASS (não contada a primeira execução
  interrompida por erro de compilação da fixture, corrigido antes do RED).
- GREEN HTTP + ciclo de vida + piloto legado: 24/24 PASS em 3 suítes.
- GREEN PostgreSQL ampliado: 23/23 PASS; cascata confirma estado persistido,
  auditoria única, preservação de outro usuário, não reabilitação implícita e
  rollback conjunto de usuário/concessão/auditoria.
- Typecheck: PASS. Redação de auditoria: 24/24 PASS; nenhuma chave nova livre.
- Novo teste adicionado ao runner oficial `test:rls:testcontainers`.

## Fechamento técnico local

Código validado: `31c1f4b9f80396ba9369563ba60a16cab7546c2b` (a atualização
seguinte deste documento não modifica o código). Sem mudanças em workflows,
lockfiles, guards síncronos, matriz de papéis ou contratos clínicos.

| Gate | Resultado local e limite |
| --- | --- |
| Backend completo, Node 22.21.1 | PASS: 430 suítes / 4.922 testes; 308 testes em 14 suítes SKIPPED pelos opt-ins/ambientes da configuração padrão. Não são aprovados pelo resultado global. |
| PostgreSQL/RLS dedicado | PASS: 59/59, zero skipped, migrations 1083/1084 + serviço Auth-2, runtime sem owner/superuser/BYPASSRLS, em PostgreSQL 15 criado e destruído por Testcontainers. Não utiliza shim local ou banco externo. |
| Foco após mutações/restauração | PASS: 47/47 em 4 suítes (serviço PG, HTTP, usuários cliente e piloto legado). Há sobreposição com os gates anteriores; não somar contagens. |
| Typecheck backend | PASS: `node node_modules/typescript/bin/tsc --noEmit`, sem relaxar flags/config. |
| Build/artefato | PASS: Nest build e `verificar-artefato-producao.mjs`, `dist/main.js` validado. |
| Web test:authz completo | PASS: 27 scripts com exit 0, incluindo 591/591 testes reportados em 26 grupos TAP, Node 22; primeiro intento sem dependências foi erro de setup, não RED. |
| Auditoria | PASS: 24/24, nenhuma chave livre nova. |
| Tooling dos agentes | PASS: 12 testes Node + 5 Python. |
| Guardas/migrations fora de banda | PASS: 24/24; nenhuma exceção adicionada. |
| Matriz de confiabilidade | PASS: 40 referências críticas válidas. |
| Scanner de segredos / diff | PASS nos dois pushes de implementação; repetir antes do push documental final. |
| Runner RLS agregado completo | SKIPPED local: imagem Timescale padrão ausente e menos de 1 GiB livre; não forçado pull nem substituído Timescale por PostgreSQL. Os 59 testes dedicados acima efetivamente executaram PostgreSQL; o runner completo fica para CI. |
| Preflight PowerShell | SKIPPED: `pwsh` ausente. |
| Grafo canônico local | SKIPPED: reutilização somente leitura das dependências existentes, sem espaço para instalação isolada. TypeORM/Testcontainers locais diferem do lock. CI congelado é obrigatório antes de integração. |
| R4 independente | Parecer estático favorável do subagente `/root/auth2_r4`, contra a base Auth-1 `f8cf057b`, sem achados reproduzíveis. Leu serviço, controller/DTOs, módulo, cascata e testes; não executou testes, SQL ou boot. Não é revisão humana formal da PR nem prova de CI. |
| UX/Playwright | N/A: nenhum fluxo/tela/consumidor clínico implementado em Auth-2. Q3/Q6 existentes preservados; perspectivas A/B/C e interface profissional/paciente pertencem às entregas de UI. N/A não constitui validação visual. |
| Smoke runtime completo | SKIPPED: sem serviços externos/Redis e schema completo implantado; build e HTTP Nest isolado não provam disponibilidade operacional. |
| CI/scanners do HEAD final | PENDING na abertura da PR; não herdar o resultado da Auth-1 nem declarar CI verde antes dos checks. |

### Mutações temporárias (fonte restaurada integralmente)

As três mutações foram mortas por falha funcional de negativa, não por setup ou
compilação. Cada execução subiu seu PostgreSQL descartável:

1. Remover `if (!concessao) throw negar()` em `exigir`: teste “JWT com claim
   clínica não supre ausência” passou a resolver indevidamente (1 falha).
2. Remover verificação do papel Professional do alvo em `conceder`: matriz de
   alvos não elegíveis passou a aceitar quatro papéis (4 falhas).
3. Remover filtro `revogadaEm: IsNull()` na consulta de `exigir`: teste de
   revogação com mesmo JWT passou a resolver indevidamente (1 falha).

Confirmado `git diff --exit-code 31c1f4b9 -- octaclin-backend/src` após restaurar;
47/47 GREEN após restauração. Nenhuma mutação foi commitada.

### Reprodução mínima

No diretório `octaclin-backend`, com Node 22 e dependências canônicas do lock:

```sh
pnpm typecheck
pnpm build
pnpm test --runInBand
RLS_TESTCONTAINERS=true FOOD06_RESTRICOES_TESTCONTAINERS=true pnpm exec jest --runInBand --runTestsByPath src/infraestrutura/banco-dados/migracoes/1720000001083-RestricoesAlimentares.integracao.spec.ts src/infraestrutura/banco-dados/migracoes/1720000001084-ConcessoesPermissaoUsuario.integracao.spec.ts src/modulos/auth/aplicacao/servico-concessoes-permissao.integracao.spec.ts
```

No runner local desta execução, equivalentes Node 22 foram usados diretamente,
pois o wrapper pnpm disponível força Node 24. Nenhum requisito de engine ou
manifesto foi alterado. O primeiro intento de `test:authz` Web falhou por ausência
de `node_modules`; isso foi erro de setup, não RED funcional. Reutilização somente
leitura do grafo Web existente permitiu retomar o comando, sem instalar dependências.

## Estado de integração e próxima ação

Auth-2 deve permanecer Draft e empilhada sobre `claude/food06-auth-concessoes`.
Integrar Auth-1 primeiro por decisão do proprietário, depois conferir base/diff,
retarget da Auth-2 para main e repetir CI aplicável; não fazer merge implícito.
Revisão humana formal, CI do lock exato e pendências operacionais continuam gates.
A migração 1084 não foi executada em staging/produção. **BLOCKED operacional:**
antes de disponibilizar este backend, é necessário comprovar a 1084 e RLS no
ambiente alvo, em procedimento autorizado separado. Merge da Auth-1 não comprova
schema aplicado. A nova cascata usa a tabela mesmo sem tela/flag clínica ativa;
backend Auth-2 com schema anterior falharia ao desativar/alterar acesso. Não
silenciar ausência da tabela nem contornar a revogação para permitir rollout.

O futuro P2 deve chamar `exigir(tenantId, usuarioId, permissao, gerenciador)`
dentro da transação da ação clínica, além de autorizar paciente/carteira. Não usar
um `exigir` independente seguido de escrita em outra transação. A API administrativa
não valida conselho profissional e não ativa regras clínicas ou flags.

Encerrar a execução após abrir a PR. Nenhum P2/P3/P4, tela, merge, deploy,
migration externa, Neon, Render ou cobrança autorizado/realizado nesta tarefa.

## Correção do CI herdada da Auth-1 — 2026-11-13

O Backend do run `43411884871` falhou no inventário agregado RLS, pelo mesmo
motivo da Auth-1: concessões não estavam na lista nominal de tabelas sem DELETE.
Incorporada a correção `3999559d` da branch base por merge local, mantendo a PR
empilhada. O inventário exige exatamente SELECT/INSERT/UPDATE por tenant, sem
DELETE/ALL. Sem mudança funcional, migration ou política SQL.

Evidências adicionais em Windows, Node 22.23.3 / pnpm 11.25.0:

- PASS: instalação congelada, typecheck, build e artefato `dist/main.js`.
- PASS: migration unitária 1084, 7/7; HTTP de concessões, usuários/cliente e
  permissões, 38/38 em três suítes (grupos distintos).
- FAIL de preparação: primeira seleção focada citou dois paths de spec
  inexistentes; corrigida a seleção, sem alterar testes ou expectativas.
- PASS: `git diff --check` e scanner local de segredos antes do push.
- SKIPPED: suíte completa local Auth-2 e PostgreSQL/RLS local. Docker indisponível;
  regressão completa Auth-1 apresentou duas falhas de plataforma fora do diff,
  detalhadas em `tasks/food06-auth1-concessoes.md`. CI Linux do novo HEAD obrigatório.
- NA: UX/Playwright neste delta de inventário e documentação, sem nova jornada.

CI do novo HEAD pendente no registro. Não herdar verde da base; confirmar Backend
incluindo inventário PostgreSQL e runner Testcontainers nesta PR. Rollback do delta:
reverter ajuste do teste, sem alterar schema ou histórico. Permanecem os gates
operacionais e a dependência da Auth-1; nenhum merge de PR ou deploy foi realizado.
