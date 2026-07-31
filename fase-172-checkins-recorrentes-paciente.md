# Fase 172 - Check-ins recorrentes por paciente

Status: concluida localmente em 2026-07-30. Requer aplicar a migration antes
do deploy de producao.

## Entregue

- Cada agendamento de questionario exige e persiste o paciente selecionado.
- O processador recorrente cria somente um envio para o paciente vinculado.
- Agendamentos antigos sem paciente sao desativados pela migration, impedindo
  qualquer disparo automatico para toda a base do tenant.
- Profissionais so podem criar ou enviar questionarios para pacientes sob sua
  responsabilidade; SuperAdmin e Collaborator preservam o escopo do tenant.
- O editor passou a exibir o seletor do paciente no bloco de check-in recorrente.

## Deploy

Aplicar `VincularAgendamentoQuestionarioPaciente1720000001009` no Neon de
producao antes ou junto da publicacao do backend. A migration adiciona
`paciente_id`, desativa regras legadas sem paciente e cria o indice de execucao.

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
