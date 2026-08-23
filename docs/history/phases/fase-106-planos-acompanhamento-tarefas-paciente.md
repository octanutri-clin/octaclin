# Fase 106 - Planos de acompanhamento e tarefas do paciente

Data: 2026-07-22.

## Objetivo

Permitir que o profissional prescreva metas, tarefas e check-ins para o paciente cumprir entre consultas, deixando o acompanhamento registrado no prontuario.

## Entregue

- Nova entidade `acompanhamento_tarefas` com isolamento por tenant, RLS e indices por paciente/profissional.
- Descricao da tarefa salva criptografada por poder conter orientacao clinica individual.
- Endpoints backend para listar, criar e atualizar status de tarefas de acompanhamento.
- Auditoria para listagem, criacao e atualizacao de tarefas.
- Prontuario longitudinal agora inclui eventos `tarefa_acompanhamento`.
- Resumo do prontuario agora mostra `tarefasPendentes`.
- BFF autenticado para tarefas de acompanhamento.
- Tela `/pacientes/[id]` recebeu formulario de prescricao de tarefas/metas/check-ins.
- Teste visual cobre prescricao de tarefa no prontuario em desktop e mobile.

## Arquivos principais

- `octaclin-backend/src/modulos/pacientes/infraestrutura/acompanhamento-tarefa.orm.ts`
- `octaclin-backend/src/infraestrutura/banco-dados/migracoes/1720000000500-CriarAcompanhamentoTarefas.ts`
- `octaclin-backend/src/modulos/pacientes/aplicacao/servico-pacientes.ts`
- `octaclin-backend/src/modulos/pacientes/apresentacao/controlador-pacientes.ts`
- `octaclin-web/app/api/pacientes/[id]/tarefas-acompanhamento/route.ts`
- `octaclin-web/app/api/pacientes/[id]/tarefas-acompanhamento/[tarefaId]/route.ts`
- `octaclin-web/components/pacientes/prontuario-paciente.tsx`
- `octaclin-web/lib/prontuario-api.ts`
- `octaclin-web/tests/visual/console-regression.spec.mjs`

## Validacoes

```powershell
pnpm --dir octaclin-backend exec jest servico-pacientes.spec.ts --runInBand
pnpm --dir octaclin-backend typecheck
pnpm --dir octaclin-web typecheck
pnpm --dir octaclin-web test:authz
pnpm --dir octaclin-web exec playwright test tests/visual/console-regression.spec.mjs -g "permite prescrever tarefa de acompanhamento|permite registrar evolucao clinica privada|exibe linha do tempo clinica consolidada" --project=desktop-chromium --project=mobile-chromium --reporter=list
pnpm --dir octaclin-backend build
pnpm --dir octaclin-web build
```

## Pendencias

- Aplicar migrations no ambiente cloud antes de testar com dados reais.
- Exibir tarefas prescritas no portal do paciente na Fase 114.
- Proxima fase recomendada: Fase 107 - Biblioteca de materiais e envio ao paciente.
