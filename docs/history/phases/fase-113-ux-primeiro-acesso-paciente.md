# Fase 113 - UX final do primeiro acesso do paciente

Data: 2026-07-22

## Objetivo

Melhorar a experiencia do paciente no primeiro acesso para reduzir suporte manual quando o link estiver incompleto, expirado ou invalido.

## Entregas

- Tela de primeiro acesso com estado especifico para link sem token.
- Tela de primeiro acesso com estado especifico para convite expirado.
- Tela de primeiro acesso com estado especifico para convite nao encontrado.
- Mensagens orientadas para acao, mantendo linguagem simples para paciente.
- Acoes visiveis para solicitar novo acesso em `/recuperar-senha` e voltar ao login em `/login`.
- Preservacao do caminho feliz de ativacao do convite e redirecionamento para o portal do paciente.
- Smoke visual cobrindo caminho feliz, link sem token, convite expirado e convite invalido.

## Decisoes

- A UX foi resolvida no frontend, pois o backend ja retornava status HTTP suficiente para diferenciar convite expirado e nao encontrado.
- A classe `ErroApiConvitePaciente` passou a ser exportada para permitir classificacao por status HTTP no componente.
- O link de novo acesso aponta para o fluxo existente de recuperacao de senha/acesso, evitando criar outro processo paralelo de suporte.
- Os estados de falha nao exibem o formulario de senha, reduzindo risco de tentativa em convite invalido.

## Arquivos principais

- `octaclin-web/components/auth/primeiro-acesso-form.tsx`
- `octaclin-web/lib/convites-paciente-api.ts`
- `octaclin-web/tests/visual/primeiro-acesso-paciente.spec.mjs`
- `CHECKLIST_FASES_FUTURAS_PRODUCAO.md`
- `RESUMO_FASES_CONCLUIDAS.md`

## Validacoes

```powershell
cd octaclin-web; $env:E2E_WEB_URL='http://localhost:3101'; .\node_modules\.bin\playwright.cmd test tests/visual/primeiro-acesso-paciente.spec.mjs --reporter=list
pnpm --dir octaclin-web typecheck
pnpm --dir octaclin-web build
powershell -ExecutionPolicy Bypass -File .\validar-preflight.ps1 -DocsOnly
```

## Pendencias para fases futuras

- Conectar a solicitacao de novo acesso a um fluxo operacional especifico para reenvio de convite, caso o produto decida separar isso de recuperacao de senha.
- Validar a experiencia em mobile quando a Fase 128 ampliar a suite E2E de jornadas criticas.
