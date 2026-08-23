# Fase 115 - Check-ins e diario rapido de acompanhamento

Data: 2026-07-23

## Objetivo

Permitir que o paciente registre check-ins simples pelo portal, gerando dados acionaveis de acompanhamento entre consultas.

## Entregas

- Backend do portal registra check-in rapido usando o paciente vinculado ao usuario autenticado.
- Check-in registra humor, adesao ao plano, sintomas e observacoes.
- Registro reutiliza `logs_diario_rapido` com `origem: portal_paciente`.
- `ultimoCheckinEm` do paciente e atualizado apos o registro.
- Resumo do portal retorna `checkinsRecentes` e `diariosRecentes`.
- Portal web exibe contador `Check-ins`.
- Portal web adiciona formulario `Check-in rapido`.
- Portal web exibe `Diario recente` com humor, adesao, sintomas, observacoes e data.
- Linha do tempo do portal inclui eventos de check-in.
- BFF adiciona `POST /api/portal/paciente/checkins`.

## Decisoes

- O paciente nao informa `pacienteId`; o backend resolve o vinculo pelo `usuarioId` autenticado para evitar registros em paciente errado.
- O escopo da fase e registro simples pelo portal. Analises clinicas, graficos e alertas derivados ficam para fases futuras.
- O log foi persistido como tipo `humor`, mantendo compatibilidade com a estrutura existente de diario rapido.
- O frontend atualiza o diario localmente apos envio, sem depender de novo carregamento do portal.

## Arquivos principais

- `octaclin-backend/src/modulos/pacientes/aplicacao/dtos.ts`
- `octaclin-backend/src/modulos/pacientes/aplicacao/servico-portal-paciente.ts`
- `octaclin-backend/src/modulos/pacientes/aplicacao/servico-portal-paciente.spec.ts`
- `octaclin-backend/src/modulos/pacientes/apresentacao/controlador-portal-paciente.ts`
- `octaclin-backend/src/modulos/pacientes/modulo-pacientes.ts`
- `octaclin-web/app/api/portal/paciente/checkins/route.ts`
- `octaclin-web/lib/portal-api.ts`
- `octaclin-web/components/portal/portal-paciente.tsx`
- `octaclin-web/tests/visual/portal-paciente.spec.mjs`
- `CHECKLIST_FASES_FUTURAS_PRODUCAO.md`
- `RESUMO_FASES_CONCLUIDAS.md`

## Validacoes

```powershell
pnpm --dir octaclin-backend test --runInBand servico-portal-paciente.spec.ts
cd octaclin-web; $env:E2E_WEB_URL='http://localhost:3105'; .\node_modules\.bin\playwright.cmd test tests/visual/portal-paciente.spec.mjs --reporter=list
pnpm --dir octaclin-backend typecheck
pnpm --dir octaclin-web typecheck
pnpm --dir octaclin-backend build
pnpm --dir octaclin-web build
powershell -ExecutionPolicy Bypass -File .\validar-preflight.ps1 -DocsOnly
```

## Pendencias para fases futuras

- Criar graficos/tendencias de humor, adesao e sintomas para o profissional.
- Disparar alertas quando humor/adesao indicarem risco recorrente.
- Permitir filtros por periodo e exportacao dos check-ins no prontuario.
