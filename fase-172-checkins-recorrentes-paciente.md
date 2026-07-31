# Fase 172 - Check-ins recorrentes por paciente

Status: concluida e publicada em producao em 2026-07-30.

## Entregue

- Cada agendamento de questionario exige e persiste o paciente selecionado.
- O processador recorrente cria somente um envio para o paciente vinculado.
- Agendamentos antigos sem paciente sao desativados pela migration, impedindo
  qualquer disparo automatico para toda a base do tenant.
- Profissionais so podem criar ou enviar questionarios para pacientes sob sua
  responsabilidade; SuperAdmin e Collaborator preservam o escopo do tenant.
- O editor passou a exibir o seletor do paciente no bloco de check-in recorrente.

## Producao

A migration `VincularAgendamentoQuestionarioPaciente1720000001009` foi aplicada
e registrada no Neon de producao. Ela adiciona `paciente_id`, desativa regras
legadas sem paciente e cria o indice de execucao. O commit `56bc06d` foi
publicado no Render; o health check do backend retornou `200` e uma rota
protegida da web retornou `401` sem sessao, como esperado.

## Validacoes

```powershell
pnpm --dir octaclin-backend exec jest src/modulos/questionarios/aplicacao/servico-questionarios.spec.ts src/infraestrutura/banco-dados/opcoes-typeorm.spec.ts --runInBand
pnpm --dir octaclin-backend typecheck
pnpm --dir octaclin-backend build
pnpm --dir octaclin-web typecheck
pnpm --dir octaclin-web build
```

## Proxima fase

Fase 173 - Matriz longitudinal de respostas.
