# Fase 218 - API publica, chaves por tenant e webhooks

## Status

- Implementacao e testes locais: concluidos em 2026-08-08.
- Migration de producao: aplicada e validada em 2026-08-08 com role
  `neondb_owner`; banco em 35/35 migrations.
- Rollout de producao: pendente de push/deploy e smoke autenticado.

## Entrega

- API `/v1` para ler/criar pacientes e ler/criar/cancelar consultas.
- Chaves por tenant, escopos explicitos, expiracao, uso recente, rotacao e
  revogacao imediata.
- Segredo da chave persistido somente como SHA-256; valor completo exibido uma
  unica vez ao gestor `Client`.
- Idempotencia por `referenciaExterna` protegida por indice unico e recuperacao
  do vencedor em requisicoes concorrentes.
- Rate limit Redis por IP e por chave, com falha fechada quando o controle fica
  indisponivel.
- Webhooks assinados para paciente, consulta e formulario, gravados no mesmo
  commit da mutacao de dominio.
- Outbox com deduplicacao, historico, seis tentativas, recuperacao de lease
  interrompida e reprocessamento manual apenas de falhas.
- Destino HTTPS validado contra SSRF, sem redirect, com DNS validado e IP fixado
  na conexao.
- Portal do cliente para gerir chaves, assinaturas e entregas sem expor hashes
  ou segredos cifrados.
- Contrato de uso em `API_PUBLICA_V1.md`.

## Schema e isolamento

A migration `1720000001022-CriarIntegracoesApiPublica`:

- adiciona `referencia_externa` a `pacientes` e `agenda_consultas`;
- cria `api_chaves`, `webhook_assinaturas` e `webhook_entregas`;
- aplica RLS habilitada e forcada nas tres tabelas;
- cria policies por `app.tenant_id`, FKs compostas e checks de dominio;
- cria indices de referencia externa, chaves ativas, assinaturas ativas, fila,
  historico e deduplicacao de entrega.

## Decisoes de seguranca

- O tenant e roteado pelo identificador opaco da chave, mas a leitura da chave
  ocorre dentro do `ExecutorTenant` e continua sujeita a RLS.
- Hash comparado em tempo constante; chave expirada ou revogada falha na
  requisicao seguinte, sem cache de autorizacao.
- Projecoes publicas omitem score clinico, hashes, IDs Google, payload interno,
  financeiro e detalhes de notificacao.
- Segredo de webhook e cifrado com a chave AES existente e descriptografado
  somente no instante da entrega.
- Logs e auditoria usam apenas IDs, escopos e status operacionais.

## Validacoes locais

- Backend: 113 suites e 801 testes aprovados.
- `pnpm --dir octaclin-backend typecheck`: aprovado.
- `pnpm --dir octaclin-backend build`: aprovado com `dist/main.js` validado.
- `pnpm --dir octaclin-web test:authz`: 35 cenarios aprovados.
- `pnpm --dir octaclin-web test:next15`: 77 arquivos aprovados.
- `pnpm --dir octaclin-web typecheck` e `lint`: aprovados.
- `pnpm --dir octaclin-web build`: 118 paginas geradas.
- Preflight documental e varredura de secrets: aprovados.

## Gate de producao

1. Confirmar explicitamente banco `Octaclin-db-producao` e role
   `neondb_owner`; nunca usar staging nem `octaclin_app_producao`.
2. `migration:show` deve indicar somente a `1022` pendente. Se houver outra,
   parar sem executar.
3. Aplicar a migration e remover `DATABASE_URL` da sessao no bloco `finally`.
4. Verificar RLS forcada, policies, indices, FKs e as duas colunas novas.
5. Somente depois fazer push/deploy de backend e web.
6. Criar chave sintetica, chamar uma leitura e uma escrita idempotente, revogar
   e confirmar HTTP 401.
7. Cadastrar endpoint sintetico, provocar um evento, validar HMAC/corpo bruto e
   confirmar historico; remover a credencial de aceite ao terminar.

## Pendente

- [x] Migration `1022` aplicada e validada em producao.
- [x] Builds e validacoes finais aprovados.
- [ ] Push/deploy em producao.
- [ ] Smoke de chave, escopos, revogacao, idempotencia e webhook assinado.
- [ ] Checklist, resumo e status atual marcados como concluidos.
