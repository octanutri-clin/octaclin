# FOOD06 — Auth-1: permissão por usuário, tipo e tabela

## Escopo e base

Implementação sobre a main `4804f4820408dca16340051ce115032d7093fc60`, na branch
`claude/food06-auth-concessoes`. Risco R4: novo estado persistido de autorização.
O handoff solicitado estava na referência
`claude/food06-handoff-proximas-prs` (`bdf5b218`), com somente o documento adicional
sobre a mesma base; foi lido sem merge/cherry-pick dessa branch.

Somente Auth-1: tipo de permissão, tabela aditiva vazia1084, ORM, registro no
DataSource e provas. Auth-2 (serviço, endpoints, elegibilidade por papel, revogação
por desativação, confirmação e auditoria), P2/P3/P4 permanecem fora desta PR.

## Contrato

- `restricoes.confirmar` pertence a `PermissaoOctaClin`, mas não a qualquer matriz
  de papel. Os cinco papéis, inclusive SuperAdmin, continuam sem essa permissão.
  Guarda síncrona e JWT não ganharam consulta a banco nem capacidades novas.
- `concessoes_permissao_usuario`: id, tenant, usuário, permissão fechada,
  concedente/data, revogador/data e motivo administrativo de1–160caracteres,
  sem controles, vazio ou espaços externos. Não armazenar informação clínica
  nesse campo. O limite de texto não comprova ausência de PHI; o futuro escritor
  Auth-2 deve manter o uso estritamente administrativo e a projeção mínima.
- FKs compostas para usuário/concedente/revogador no mesmo tenant, todas RESTRICT,
  conforme o padrão1063. A camada Auth-2 decidirá os papéis elegíveis; esta
  estrutura não verifica conselho profissional nem executa decisão clínica.
- Unicidade parcial em `(tenant_id, usuario_id, permissao)` para concessões ativas.
  Revogação exige par autor/data e data não anterior à concessão.
- Dados originais imutáveis. UPDATE aceita apenas a primeira revogação completa;
  uma concessão revogada não é reativada nem reescrita. Nova concessão usa outro ID
  e conserva a anterior. Essa regra é proteção estrutural, não implementação do serviço.
- RLS ENABLE/FORCE com SELECT, INSERT e UPDATE por `app.tenant_id`. DELETE/TRUNCATE
  proibidos por trigger por instrução ENABLE ALWAYS, inclusive quando RLS oculta
  todas as linhas e em modo réplica. Não há grants novos para o runtime.
- ORM global e migration registrados uma única vez. A suíte1084 integra o runner
  existente `test:rls:testcontainers`, sem alteração de workflows ou dependências.

## Rollback e limites

`down` exige transação READ COMMITTED, `row_security=off` efetivo e lock ACCESS
EXCLUSIVE antes de conferir existência. Só remove a estrutura comprovadamente
vazia. Qualquer histórico, leitura não verificável ou isolamento diferente recusa
a reversão. Owner pode remover/desabilitar triggers por DDL: não há promessa de
imutabilidade contra administrador. Com dados, manter schema e reverter somente
consumidores compatíveis; nenhum procedimento de produção está autorizado.

Nenhuma migration foi aplicada em staging/Neon/produção. Os SQLs da prova foram
executados só em PostgreSQL15 criado por Testcontainers para este teste, com dados
sintéticos. O shim PostgreSQL local não foi usado.

## TDD, mutações e evidências

- Tipo: falha TS2322 ao usar a nova permissão no teste antes de adicioná-la ao
  union. É RED de contrato de tipo, não falha funcional executada. Após inclusão,
  os cinco papéis negam a permissão e as regressões dos guardas passam.
- Migration: implementação inicial vazia produziu seis falhas funcionais nos
  testes de estrutura e rollback; implementação levou a GREEN.
- Foco final:32/32 em quatro suítes (permissões, guarda, migration e registro ORM).
- PostgreSQL real descartável:17/17, zero skipped. Role runtime sem ownership,
  superuser ou BYPASSRLS; leitura sem tenant/cross-tenant e escrita cross-tenant,
  FKs dos três usuários, permissão fechada, motivo limitado, par/data de revogação,
  quatro inserções concorrentes, preservação após nova concessão, identidade
  imutável, DELETE/TRUNCATE e réplica, down com histórico e down vazio dedicado.
- Quatro mutações temporárias detectadas e integralmente restauradas: remover
  CHECK da permissão (3falhas), remover unicidade ativa (1), remover FORCE RLS (1),
  dar a permissão a Professional/SuperAdmin por herança (2). Nenhum sobrevivente.
  A suíte PostgreSQL foi repetida após restauração:17/17PASS.
- Typecheck backend e build Nest/artefato `dist/main.js`: PASS com Node22.21.1.
- Tooling de agentes:12testes Node e5Python PASS. O wrapper pnpm disponível usa
  Node24; após identificá-lo, os comandos equivalentes foram repetidos diretamente
  com Node22, sem mudar engines/configuração ou instalação compartilhada.
- Scanner local de segredos e `git diff --check`: PASS.

Regressão backend completa:429suítes/4.915testes PASS,285testes em13suítes SKIPPED
na configuração padrão, zero falhas. Não somar os17casos dedicados de PostgreSQL
ao total como se fossem casos adicionais distintos. A primeira invocação foi feita
na raiz da worktree e teve4914PASS/1FAIL por ENOENT de uma ficha legada resolvida
relativamente ao CWD. A suíte completa foi repetida no diretório correto do backend,
sem editar o teste legado, e resultou no GREEN acima.

Governança de migrations fora de banda:13/13PASS. Os casos completos e o teste
de registro específico incluem a fonte final dos testes desta PR.

Com grafo canônico instalado, comandos de reprodução:

```bash
pnpm --dir octaclin-backend typecheck
pnpm --dir octaclin-backend build
pnpm --dir octaclin-backend test --runInBand
RLS_TESTCONTAINERS=true pnpm --dir octaclin-backend exec jest --runInBand --runTestsByPath src/infraestrutura/banco-dados/migracoes/1720000001084-ConcessoesPermissaoUsuario.integracao.spec.ts
pnpm test:tooling-agentes
pnpm test:migracoes-fora-de-banda
pnpm security:secrets
git diff --check
```

Nesta sessão usou-se Node22 diretamente nos entrypoints de Jest/tsc/Nest/scripts
de governança para não acionar o wrapper pnpm que força Node24. Nenhum requisito
de engine, comando de CI ou dependência foi relaxado.

## Ambiente e gates não equivalentes

Dependências locais reaproveitadas somente para leitura por symlink na worktree;
não houve instalação ou mudança de lockfiles. O grafo não é o lock canônico atual:
TypeORM1.1.1 e Testcontainers12.1.0 locais, em vez das versões mínimas declaradas
atuais1.1.2/12.2.1, além de diferenças em bibliotecas não alteradas. Os resultados
locais acima identificam esse ambiente e não substituem o CI com instalação congelada.

- SKIPPED validação com grafo canônico local/runner agregado RLS: espaço residual
  inferior a1GiB, sem instalação congelada nova e sem a imagem Timescale padrão
  do runner agregado. A prova dedicada1084 real foi executada com postgres15-alpine
  disponível. O runner oficial do CI inclui a suíte nova.
- SKIPPED preflight PowerShell: não disponível neste executor Linux.
- SKIPPED revisão R4 independente antes da abertura: pendente revisor da PR;
  inspeção do autor não é revisão independente nem autorização de merge.
- CI/scanners do HEAD publicado: pendentes na abertura; não herdam PASS de outra PR.
- N/A Web/BFF/Playwright/UX: sem endpoint, contrato de resposta ou interface nova;
  o mecanismo continua sem consumidor e sem impacto de jornada nesta Auth-1.
- N/A auditoria nova e cascata: pertencem explicitamente à Auth-2.

## Transferência e encerramento

Etapas publicadas pequenas: `229dcb7c` (tipo/negação por papel) e `50df28ca`
(migration/ORM/RLS e testes). O commit final acrescenta a evidência e o isolamento
do teste de down, sem alterar contratos. Worktrees e modificações preexistentes
foram preservadas. Conferir SHA final no Git/PR, sem fixá-lo neste próprio arquivo.

O proprietário determinou parar ao abrir a PR. Não executar Auth-2/P2/P3/P4,
merge, deploy, migration externa ou ativação. Revisão e gates pendentes devem
permanecer visíveis na descrição da PR.
