# Fase 173 - Matriz longitudinal de respostas

Status: concluida e publicada em producao em 2026-07-30.

## Entregue

- Nova consulta autenticada `GET /questionarios/matriz-longitudinal`.
- Filtros opcionais por paciente, questionario, categoria e periodo.
- Cada indicador compara somente respostas numericas do mesmo paciente,
  questionario e pergunta: `likert`, `linear` e `metrica`.
- A matriz retorna valor atual, anterior, delta e historico em ordem temporal.
- Texto, escolha e respostas booleanas nao recebem delta artificial.
- Profissionais visualizam apenas seus questionarios e pacientes sob sua
  responsabilidade; SuperAdmin e Collaborator preservam o escopo do tenant.
- O editor de questionarios ganhou a secao Matriz longitudinal, com filtros e
  leitura dos dois ultimos valores de cada indicador.
- Respostas sem snapshot continuam suportadas pela definicao atual da pergunta.

## Validacoes

```powershell
pnpm --dir octaclin-backend exec jest src/modulos/questionarios/aplicacao/servico-questionarios.spec.ts src/modulos/questionarios/apresentacao/controlador-questionarios.spec.ts --runInBand
pnpm --dir octaclin-backend typecheck
pnpm --dir octaclin-backend build
pnpm --dir octaclin-web typecheck
pnpm --dir octaclin-web build
```

## Producao

Nao houve migration. Backend e web foram publicados pelo Render no commit
`b34113f`; os health checks dos dois servicos retornaram `200`.

## Proxima fase

Fase 174 - Check-ins consolidados no prontuario.
