# Fase 199 - Busca, filtros e paginacao server-side

Status: implementada e validada localmente em 2026-08-02. O fechamento depende
da migration/backfill e do ensaio de 500 pacientes em banco confirmado.

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

## Gate operacional pendente

1. Confirmar o banco de integracao, nunca producao por inferencia.
2. Aplicar a migration `1013`.
3. Executar o backfill com o nome exato do banco confirmado.
4. Inserir/usar 500 pacientes sinteticos e medir busca abaixo de 1 segundo,
   incluindo isolamento entre tenant e profissional.
5. Repetir a migration e o backfill em producao antes do deploy do codigo,
   pois `BANCO_EXECUTAR_MIGRACOES=false`.

## Proxima fase

Fase 200 - Upload seguro e anexos clinicos, somente depois do gate operacional
acima e da definicao do bucket de objetos.
