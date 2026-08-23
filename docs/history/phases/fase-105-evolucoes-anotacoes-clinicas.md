# Fase 105 - Evolucoes/anotacoes clinicas

Data: 2026-07-22.

## Objetivo

Criar notas privadas do profissional no prontuario do paciente, com historico clinico, conteudo sensivel criptografado e auditoria operacional.

## Entregue

- Nova entidade `evolucoes_clinicas` com isolamento por tenant, RLS e indices por paciente/autor.
- Endpoint backend para listar e criar evolucoes clinicas por paciente.
- Conteudo da evolucao salvo criptografado e retornado descriptografado apenas por DTO autorizado.
- Auditoria para listagem e criacao de evolucoes no prontuario.
- Prontuario longitudinal passou a incluir eventos de evolucao clinica na linha do tempo.
- Tela `/pacientes/[id]` recebeu formulario de registro privado do profissional.
- BFF `/api/pacientes/[id]/evolucoes` criado para proxy autenticado.

## Arquivos principais

- `octaclin-backend/src/modulos/pacientes/infraestrutura/evolucao-clinica.orm.ts`
- `octaclin-backend/src/infraestrutura/banco-dados/migracoes/1720000000400-CriarEvolucoesClinicas.ts`
- `octaclin-backend/src/modulos/pacientes/aplicacao/servico-pacientes.ts`
- `octaclin-backend/src/modulos/pacientes/apresentacao/controlador-pacientes.ts`
- `octaclin-web/app/api/pacientes/[id]/evolucoes/route.ts`
- `octaclin-web/components/pacientes/prontuario-paciente.tsx`
- `octaclin-web/lib/prontuario-api.ts`
- `octaclin-web/tests/visual/console-regression.spec.mjs`

## Validacoes

```powershell
pnpm --dir octaclin-backend exec jest servico-pacientes.spec.ts --runInBand
pnpm --dir octaclin-backend typecheck
pnpm --dir octaclin-web typecheck
pnpm --dir octaclin-web test:authz
pnpm --dir octaclin-web exec playwright test tests/visual/console-regression.spec.mjs -g "permite registrar evolucao clinica privada|exibe linha do tempo clinica consolidada" --project=desktop-chromium --project=mobile-chromium --reporter=list
pnpm --dir octaclin-web build
pnpm --dir octaclin-backend build
powershell -ExecutionPolicy Bypass -File .\validar-preflight.ps1 -DocsOnly
```

## Pendencias

- Aplicar migrations no ambiente cloud antes de testar com dados reais.
- Proxima fase recomendada: Fase 106 - Planos de acompanhamento e tarefas do paciente.
