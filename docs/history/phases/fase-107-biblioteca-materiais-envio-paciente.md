# Fase 107 - Biblioteca de materiais e envio ao paciente

Data: 2026-07-22

## Objetivo

Criar uma biblioteca inicial de materiais educativos por tenant e permitir que o profissional envie links, PDFs por URL e orientacoes ao paciente diretamente pelo prontuario.

## Entregas

- Modulo backend `materiais` com entidades tenant-aware para materiais educativos e envios ao paciente.
- Endpoints protegidos para listar/criar materiais e listar/enviar materiais por paciente.
- Permissoes `materiais.ler` e `materiais.gerenciar` integradas a papeis operacionais.
- Observacao de envio criptografada antes da persistencia.
- BFF web em `/api/materiais` e `/api/materiais/pacientes/[pacienteId]`.
- Secao no prontuario para cadastrar material reutilizavel e enviar ao paciente.
- Regressao visual desktop/mobile cobrindo criacao e envio de material.

## Arquivos principais

- `octaclin-backend/src/modulos/materiais/`
- `octaclin-backend/src/infraestrutura/banco-dados/migracoes/1720000000600-CriarMateriaisEducativos.ts`
- `octaclin-backend/src/modulos/auth/dominio/permissoes.ts`
- `octaclin-web/lib/materiais-api.ts`
- `octaclin-web/app/api/materiais/`
- `octaclin-web/components/pacientes/prontuario-paciente.tsx`
- `octaclin-web/tests/visual/console-regression.spec.mjs`

## Validacoes

```powershell
pnpm --dir octaclin-backend exec jest servico-materiais.spec.ts servico-pacientes.spec.ts permissoes.spec.ts --runInBand
pnpm --dir octaclin-backend typecheck
pnpm --dir octaclin-web typecheck
pnpm --dir octaclin-web test:authz
pnpm --dir octaclin-web exec playwright test tests/visual/console-regression.spec.mjs -g "permite criar material e enviar ao paciente|permite prescrever tarefa de acompanhamento|permite registrar evolucao clinica privada|exibe linha do tempo clinica consolidada" --project=desktop-chromium --project=mobile-chromium --reporter=list
```

## Pendencias para fases futuras

- Exibir os materiais enviados no portal do paciente na Fase 114.
- Definir armazenamento definitivo para upload real de arquivos se o MVP precisar alem de URL de PDF.
- Conectar materiais diretamente a planos de acompanhamento quando a experiencia do paciente for expandida.
