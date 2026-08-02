# Fase 199 - Busca, filtros e paginacao server-side

Status: concluida em 2026-08-02, com validacao local, integracao, migration e
backfill de producao.

## Entregue no codigo

- Pacientes ganharam indice cego `busca_hashes` com HMAC-SHA256 derivado da
  chave de criptografia, separado por tenant e indexado por GIN.
- Nome e contato atualizam o indice em cadastro, edicao, portal do paciente,
  associacao de WhatsApp e seeds.
- Busca por prefixos de 3 a 32 caracteres, risco, status, responsavel e ausencia
  de consulta futura agora ocorre no PostgreSQL antes da paginacao.
- O papel `Professional` continua impondo o proprio profissional responsavel,
  mesmo que outro ID seja enviado no filtro.
- Lista de pacientes preserva filtros/pagina na URL e profissionais ganhou
  navegacao real entre paginas.
- Formularios ganharam busca por titulo e paginacao server-side no workspace.
- Migration `1720000001013-AdicionarIndiceBuscaPacientes` possui `up`, `down`,
  indice GIN e teste de sequencia.
- `pnpm --dir octaclin-backend backfill:indices-busca` e idempotente e recusa
  execucao sem coincidencia exata entre `DATABASE_URL` e
  `CONFIRMAR_BANCO_BACKFILL`.

## Validacoes locais

- Backend: 72 suites e 403 testes.
- Typecheck e build do backend.
- Lint, typecheck, build e autorizacao da web.
- Editor de formularios: 8 jornadas Playwright em desktop e mobile.
- Busca/paginacao de pacientes: 2 jornadas Playwright em desktop e mobile.
- `git diff --check` sem erro.

## Validacao no banco de integracao

- Alvo confirmado pela propria `DATABASE_URL`: `octaclin_test_fase150b`, no
  projeto Neon `octaclin-integration-tests`.
- As 26 migrations pendentes foram aplicadas, incluindo
  `1720000001013-AdicionarIndiceBuscaPacientes`.
- `seed:staging` foi executado com dados sinteticos.
- O smoke criou 500 pacientes, comprovou o isolamento por profissional e mediu
  a busca em 129,2 ms.
- Os indices foram removidos intencionalmente e o backfill reindexou 503
  pacientes.
- A busca repetida depois do backfill retornou o paciente esperado em 133,7 ms,
  sem resultado no escopo de outro profissional.
- O comando reutilizavel e
  `pnpm --dir octaclin-backend smoke:busca-pacientes`; ele exige confirmacao
  exata em `CONFIRMAR_BANCO_BUSCA` e `CONFIRMAR_MASSA_SINTETICA=SIM`.

## Rollout de producao

- Branch Neon `production` com Backup & Restore ativo.
- Banco confirmado pela propria URL: `Octaclin-db-producao`.
- Apenas a migration `AdicionarIndiceBuscaPacientes1720000001013` estava
  pendente; foi aplicada em transacao e a verificacao posterior retornou zero
  migrations pendentes.
- O backfill executado com a chave de criptografia do backend atualizou 1
  paciente.
- A repeticao imediata atualizou 0 pacientes, comprovando idempotencia.
- URL, chave, variaveis temporarias e area de transferencia foram limpas depois
  da operacao.

## Proxima fase

Fase 200 - Upload seguro e anexos clinicos, somente depois do gate operacional
acima e da definicao do bucket de objetos.
