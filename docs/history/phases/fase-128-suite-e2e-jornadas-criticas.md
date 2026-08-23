# Fase 128 - Suite E2E de jornadas criticas

Data: 2026-07-23

## Objetivo

Adicionar uma suite Playwright focada nas jornadas minimas que precisam estar confiaveis antes de incluir clientes reais: cliente convidando usuario, profissional criando paciente e agendando consulta com comunicacoes, e paciente acessando portal com consulta/notificacoes/plano.

## Entregas

- Criado `octaclin-web/tests/visual/jornadas-criticas.spec.mjs`.
- Adicionado script web `pnpm --dir octaclin-web test:e2e:criticas`.
- Adicionado validador autocontido `validar-jornadas-criticas.ps1`.
- Adicionado script raiz `pnpm test:e2e:criticas`, que sobe o Next temporariamente e encerra a porta ao final.
- Suite cobre:
  - cliente criando convite administrativo;
  - profissional criando paciente;
  - profissional agendando consulta com email, WhatsApp, Google Calendar e notificacoes habilitadas;
  - paciente acessando portal com consulta, notificacoes e plano visiveis.

## Validacoes

```powershell
pnpm test:e2e:criticas
pnpm security:secrets
powershell -ExecutionPolicy Bypass -File .\validar-preflight.ps1 -DocsOnly
```

## Observacoes

- A suite usa Playwright contra a UI real do Next.js e contratos BFF mockados, seguindo o padrao dos testes visuais existentes.
- A Fase 129 deve criar dados realistas de staging para complementar esta cobertura com validacao mais proxima do ambiente real.
