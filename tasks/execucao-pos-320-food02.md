# Execução — plano: tasks/plan-pos-320-food02.md

Branch feat/pos320-food02-planejamento; base95e9f33d; planejamento8b4d6d38.
Autorização: “Pode seguir, sol médio”. R4: biblioteca cifrada, snapshots,
autorização e migration aditiva. Só PostgreSQL local descartável em T05.

## Preflight

T01→T03: conteúdo original/normalizado e DTOs fechados; sem conflito.
T02→T04: coluna cifrada versionada + FK custom de medidas; reader antigo não
é rollback compatível. T03→T04: primeira aplicação revalida; preservação não
consulta biblioteca. T04→T06: publicar handoff real só após backendGREEN.
Decisão técnica: usar ledger canônico em tasks; scripts da skill cloud não
estão fornecidos no filesystem. Não instalar ferramenta para bookkeeping.
Sem revisão independente realizada nesta etapa, sem delegação automática.

## T01 — GREEN

RED normalização:27 falhas comportamentais com stub sem implementação;
/tmp/food02-t01-red.log. RED DTO:2 falhas/15 passam com classes sem contratos;
/tmp/food02-dto-red.log. GREEN normalização/DTO + micros existentes:
3 suítes/65 testes PASS, /tmp/food02-t01-final.log.
Comando: Node22 jest --config octaclin-backend/package.json --runInBand
--testPathPatterns='(alimentos-personalizados|micronutrientes).spec.ts'.
Preservada razão original, ausência/zero, base30g e overflow. Não equivale à
suíte integral nem à integração PostgreSQL, ainda pendentes.
