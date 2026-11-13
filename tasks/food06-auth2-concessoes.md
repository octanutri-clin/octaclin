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
