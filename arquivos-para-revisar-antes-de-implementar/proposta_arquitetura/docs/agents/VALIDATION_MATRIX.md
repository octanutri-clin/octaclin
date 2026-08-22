# OctaClin — Matriz de Validação por Risco

> Status: ativo  
> Fonte de verdade para: seleção proporcional de testes e gates

## 1. Regra

Validação deve ser proporcional ao risco.

Não use um build completo de todo o monorepo para corrigir uma vírgula, mas também não aceite teste unitário isolado para uma mudança de RLS.

## 2. Níveis

| Risco | Exemplos | Gates mínimos |
|---|---|---|
| **R0** | docs, typo, comentário | inspeção + `git diff --check` |
| **R1** | microcopy, CSS, ajuste visual local | lint/typecheck do pacote + teste visual quando relevante |
| **R2** | componente, rota comum, regra local de produto | RED/GREEN quando aplicável + testes específicos + lint + typecheck |
| **R3** | API, integração, job, banco aditivo simples | R2 + build/regressão relacionada + testes de contrato/integração |
| **R4** | auth, authz, RLS, tenancy, crypto, migration, PHI/PII, produção | TDD + positivos/negativos + segurança + regressão + revisão independente |
| **R5** | destrutivo, rollback complexo, indisponibilidade/perda de dados | R4 + autorização explícita + backup/restore/rollback + monitoramento |

## 3. Backend

Comandos comuns:

```sh
pnpm --dir octaclin-backend test -- <specs> --runInBand
pnpm --dir octaclin-backend typecheck
```

Adicionar conforme área:

- testes de integração;
- migrations;
- fila/worker;
- contratos;
- segurança;
- tenancy/RLS.

## 4. Web

Comandos comuns:

```sh
pnpm --dir octaclin-web lint
pnpm --dir octaclin-web typecheck
pnpm --dir octaclin-web test:authz
pnpm --dir octaclin-web test:apis-dinamicas
pnpm --dir octaclin-web build
```

Quando relevante:

```sh
pnpm --dir octaclin-web exec playwright test <spec> --reporter=list
```

Toda nova rota dinâmica deve respeitar o contrato atual de `params`/`searchParams` assíncronos e manter o gate correspondente verde.

## 5. Repositório

Antes de concluir mudança versionável:

```sh
pnpm security:secrets
git diff --check
```

Para lockfile/dependência:

- conferir diff do lockfile;
- executar instalação com modo compatível com CI;
- executar typecheck/build relevantes;
- testar a nova versão da dependência, não apenas código antigo.

## 6. TDD

Para feature/bugfix:

```text
RED real
→ GREEN
→ REFACTOR
→ REGRESSION
```

Registrar a causa do RED.

Falha por infraestrutura, protocolo, mock errado ou config não comprova a regra de negócio.

## 7. Banco e migrations

R3/R4 conforme impacto.

Validar:

- migration registrada;
- ordem correta;
- schema anterior esperado;
- schema posterior esperado;
- constraint pelo erro correto;
- integração na altura necessária;
- produção conforme runbook.

## 8. Tenancy/RLS

R4 obrigatório.

Mínimo:

- caso do próprio tenant passa;
- cross-tenant falha;
- papel esperado passa;
- papel indevido falha;
- job/worker preserva tenant se aplicável.

## 9. Auth/Authz

R4 quando mexer no mecanismo; R2/R3 quando apenas consumir regra existente.

Mínimo para alteração de mecanismo:

- autenticado + permitido;
- autenticado + negado;
- não autenticado;
- tenant incorreto;
- rota/API, não apenas UI.

## 10. Integração externa

R3/R4.

Validar:

- timeout;
- retry;
- idempotência;
- erro do provedor;
- payload mínimo;
- logs sem PII;
- desligamento/feature flag quando existir;
- webhook signature quando aplicável.

## 11. UI crítica

Para prontuário, agenda, formulários, plano alimentar e portal:

- teste funcional;
- teclado quando relevante;
- acessibilidade;
- loading/erro/vazio;
- permissão;
- responsividade no viewport alvo.

## 12. CI

Não afirmar `CI verde` por listagem aproximada.

Verifique o run correto e suas conclusões.

- `skipped` = não verificado;
- cancelado = não aprovado;
- run de outra árvore = evidência inválida.

## 13. Gate pulado

Formato obrigatório:

```md
### Validações

- PASS — `<comando>`
- PASS — `<comando>`
- NÃO EXECUTADO — `<gate>` — motivo: ...
```

Nunca omitir silenciosamente.

## 14. Definition of Done

A Definition of Done global permanece em `AGENTS.md`.

Esta matriz define **quais** evidências alimentam aquela Definition of Done.
