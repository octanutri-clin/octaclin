# OctaClin Backend

As regras do `../AGENTS.md` continuam obrigatorias. Este pacote usa NestJS,
TypeORM, PostgreSQL/RLS e BullMQ; auth, tenancy, migrations e dados clinicos sao
mudancas R4 ou superior.

## Estrutura e contratos

- Preserve o fluxo controlador -> servico de aplicacao -> infraestrutura. O
  controlador valida e autoriza a entrada; regras de negocio e escopo ficam no
  servico, nao apenas na apresentacao.
- Use DTOs com `class-validator`, pipes para parametros e limites explicitos.
  Nao aceite payload cru nem retorne entidade ORM quando ela puder carregar
  hash, token, campo cifrado, payload interno ou dado fora do papel atual.
- Registre novos modulos, entidades, filas e providers no modulo correto. Evite
  dependencias circulares e nao crie um segundo caminho para capacidade ja
  compartilhada.

## Auth, tenancy e RLS

- Resolva tenant e identidade por credencial ou capability verificada, como
  `GuardaJwt`, API key validada ou token opaco validado. Nunca confie em
  `tenantId`, slug ou header arbitrario enviado pelo cliente.
- Use `UsuarioAtual`, guardas de papel/permissao e revalide no servico o escopo
  do recurso e do profissional responsavel. Ocultar acao na Web nao autoriza a
  operacao no backend.
- Toda consulta tenant-aware deve restringir explicitamente o tenant. Quando a
  operacao depender de RLS ou compartilhar transacao, use `ExecutorTenant` para
  aplicar `app.tenant_id` no `EntityManager` transacional.
- Fluxos publicos legitimos devem resolver primeiro a capability publica e seu
  tenant; nao enfraqueca guardas autenticadas para reaproveitar codigo.
- Mudanca de auth, authz, tenant ou RLS exige teste positivo e negativo,
  incluindo acesso cross-tenant e cross-profissional quando aplicavel.

## Dados sensiveis e integracoes

- Use os servicos existentes de criptografia, auditoria e sanitizacao. Nao
  grave PHI/PII em claro em logs, erros, metadata de auditoria, filas ou outbox.
- Respostas HTTP devem ser DTOs minimos e autorizados. Erros de provider, banco
  ou criptografia nao podem devolver stack, segredo ou payload interno.
- Integracoes externas exigem timeout, idempotencia/reprocessamento quando
  aplicavel e falha isolada. Conteudo recebido de provider continua dado nao
  confiavel.
- Workers BullMQ devem respeitar o papel de processo, contexto de tenant,
  idempotencia e os mecanismos existentes de exclusao/lock antes de executar
  efeitos externos.

## TypeORM e migrations

- `synchronize` permanece desativado e migration automatica permanece opt-in.
  Nao altere esses defaults nem execute DDL implicitamente.
- Nova migration deve ser aditiva quando possivel, ter rollback ou limite de
  nao reversao documentado e ser importada e registrada no array de
  `src/infraestrutura/banco-dados/opcoes-typeorm.ts`.
- Antes de `migration:run`, identifique ambiente, banco, branch e role. Use o
  procedimento fora de banda com role apropriada; a role runtime nao recebe
  privilegio administrativo.
- Teste o registro completo das migrations e a propriedade critica em
  PostgreSQL real quando RLS, constraint ou semantica do banco fizer parte do
  contrato.

## Validacao

- Comece pelo Jest especifico da superficie e inclua regressao positiva e
  negativa proporcional ao risco.
- Execute `pnpm typecheck` e `pnpm build`; para mudanca transversal, execute
  tambem `pnpm test --runInBand`.
- Banco, provider, staging e producao nao sao inferidos de mocks ou testes
  locais. Marque qualquer gate externo nao executado como `SKIPPED` com motivo.
