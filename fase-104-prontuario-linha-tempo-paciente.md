# Fase 104 - Prontuario e linha do tempo do paciente

Data: 2026-07-22.

## Objetivo

Criar uma visao longitudinal do paciente para o profissional, consolidando dados cadastrais, agenda, formularios, respostas e mensagens em uma linha do tempo clinica.

## Entregue

- Novo endpoint backend `GET /pacientes/:id/prontuario`.
- Auditoria de leitura sensivel do prontuario com acao `pacientes.prontuario.ler`.
- DTO de prontuario com paciente, resumo e eventos cronologicos.
- Eventos consolidados de:
  - consultas;
  - envios de formularios;
  - respostas de formularios;
  - mensagens.
- Nova rota BFF `/api/pacientes/[id]/prontuario`.
- Nova tela web `/pacientes/[id]`.
- Link de acesso ao prontuario na lista de pacientes.
- Middleware web exigindo `pacientes.ler` para rotas detalhadas `/pacientes/*`.
- Testes visuais desktop/mobile para a linha do tempo.

## Arquivos principais

- `octaclin-backend/src/modulos/pacientes/aplicacao/servico-pacientes.ts`
- `octaclin-backend/src/modulos/pacientes/aplicacao/dtos.ts`
- `octaclin-backend/src/modulos/pacientes/apresentacao/controlador-pacientes.ts`
- `octaclin-web/app/api/pacientes/[id]/prontuario/route.ts`
- `octaclin-web/app/pacientes/[id]/page.tsx`
- `octaclin-web/components/pacientes/prontuario-paciente.tsx`
- `octaclin-web/lib/prontuario-api.ts`
- `octaclin-web/components/cadastros/lista-pacientes.tsx`
- `octaclin-web/lib/server/autorizacao-rotas.ts`

## Validacoes

- RED backend: `pnpm --dir octaclin-backend exec jest servico-pacientes.spec.ts --runInBand`.
- GREEN backend: `pnpm --dir octaclin-backend exec jest servico-pacientes.spec.ts --runInBand`.
- RED web: `pnpm --dir octaclin-web exec playwright test tests/visual/console-regression.spec.mjs -g "prontuario do paciente" --project=desktop-chromium --reporter=list`.
- GREEN web: `pnpm --dir octaclin-web exec playwright test tests/visual/console-regression.spec.mjs -g "prontuario do paciente" --project=desktop-chromium --project=mobile-chromium --reporter=list`.
- RED autorizacao: `pnpm --dir octaclin-web test:authz`.
- GREEN autorizacao: `pnpm --dir octaclin-web test:authz`.
- `pnpm --dir octaclin-backend typecheck`.
- `pnpm --dir octaclin-web typecheck`.
- `pnpm --dir octaclin-web build`.
- `pnpm --dir octaclin-backend build`.

## Pendencias

- Adicionar evolucoes clinicas privadas na Fase 105.
- Vincular tarefas, materiais e plano de acompanhamento quando esses modulos forem criados.
- Evoluir filtros da linha do tempo por tipo de evento e periodo.
