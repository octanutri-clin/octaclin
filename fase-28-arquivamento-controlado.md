# Fase 28 - Arquivamento controlado

## Objetivo

Adicionar remocao operacional segura como arquivamento, mantendo consistencia com o backend e evitando exclusao acidental de dados clinicos.

## Entregue

- `DELETE /api/pacientes/:id` no BFF autenticado.
- `DELETE /api/profissionais/:id` no BFF autenticado.
- Funcoes client `arquivarPaciente` e `arquivarProfissional`.
- Confirmacao antes de arquivar Pacientes e Profissionais.
- Arquivamento de Questionarios pelo editor via status `arquivado`.
- API demo local atualizada para suportar arquivamento de Pacientes e Profissionais.
- Smoke E2E expandido para validar arquivamento de Questionario, Paciente e Profissional.

## Contrato funcional

- Pacientes e Profissionais usam `DELETE` porque o backend trata a operacao como arquivamento logico.
- Questionarios usam `PATCH /questionarios/:id` com `status: "arquivado"`, pois esse status ja faz parte do contrato da entidade.
- A interface sempre solicita confirmacao antes do arquivamento.

## Validacao esperada

Execute a demo local e rode:

```powershell
node outputs/octaclin-web/scripts/smoke-e2e-bff.mjs
```

O resultado esperado e `smoke-e2e-bff-ok`.
