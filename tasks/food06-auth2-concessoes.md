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
- Endpoints e ligação ao ciclo de vida: ainda pendentes neste checkpoint.
- R4 independente e CI desta branch: NOT RUN neste checkpoint.

## Limites e rollback

Sem DDL externo, acesso SQL externo, merge, deploy ou alteração operacional.
Migration 1084 pertence à Auth-1 e só foi usada no PostgreSQL descartável.
Reverter código não apaga concessões nem auditoria; não executar `down` para
apagar histórico. Futuro consumidor clínico deve permanecer fechado enquanto o
contrato e os gates de ativação não forem liberados.
