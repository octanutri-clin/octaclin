# Fase 174 - Check-ins consolidados no prontuario

Status: concluida localmente em 2026-07-30. Publicacao de producao pendente.

## Entregue

- O prontuario agora le `respostas_checkin` de formularios e
  `logs_diario_rapido` sem migrar ou duplicar os dois armazenamentos.
- Registros diarios aparecem na mesma linha do tempo clinica, identificados
  como check-in rapido e ordenados junto de consultas, formularios e mensagens.
- O resumo passou a mostrar a quantidade de check-ins rapidos recebidos pelo
  portal ou pelo modulo mobile.
- O detalhe do diario apresenta apenas os campos clinicos conhecidos: humor,
  adesao ao plano, sintomas e observacoes.
- O mesmo controle de paciente, tenant e profissional aplicado ao prontuario
  protege os dois tipos de check-in.

## Validacoes

```powershell
pnpm --dir octaclin-backend exec jest src/modulos/pacientes/aplicacao/servico-pacientes.spec.ts src/modulos/pacientes/apresentacao/controlador-pacientes.spec.ts --runInBand
pnpm --dir octaclin-backend typecheck
pnpm --dir octaclin-backend build
pnpm --dir octaclin-web typecheck
pnpm --dir octaclin-web build
```

## Proxima fase

Fase 175 - Separacao UX do modulo de formularios.
