# Fase 25 - Operacao demo completa

## Objetivo

Retomar o plano original apos a integracao de Questionarios e fechar um fluxo demonstravel de produto: login, navegacao protegida, cadastros, questionarios, auditoria e operacoes, usando a web em `3000` e a API demo local em `3001`.

## Entregas

- Smoke E2E ampliado em `outputs/octaclin-web/scripts/smoke-e2e-bff.mjs`.
- Alias `npm run smoke:demo` no projeto web.
- Validacao coberta:
  - sessao ausente antes do login;
  - login via BFF;
  - cookies `HttpOnly`;
  - paginas protegidas `/operacoes`, `/pacientes`, `/profissionais`, `/questionarios`;
  - listagem de pacientes/profissionais;
  - criacao e edicao de profissional;
  - criacao e edicao de paciente;
  - categorias de pergunta;
  - criacao, edicao/publicacao de questionario;
  - criacao, edicao e reordenacao de perguntas;
  - criacao de agendamento por cron;
  - resumo operacional, outbox, reprocessamento e sincronizacoes mobile;
  - auditoria de leituras sensiveis.

## Como rodar

Terminal backend:

```bash
cd outputs/octaclin-backend
npm run mock:api
```

Terminal web:

```bash
cd outputs/octaclin-web
npm run build
npm run start
```

Smoke:

```bash
cd outputs/octaclin-web
npm run smoke:demo
```

Fallback sem npm no PATH:

```bash
node scripts/smoke-e2e-bff.mjs
```

## Validacao realizada

- `node --check scripts/smoke-e2e-bff.mjs`: aprovado.
- `node scripts/smoke-e2e-bff.mjs`: aprovado com `smoke-e2e-bff-ok`.
- `package.json`: JSON valido e alias `smoke:demo` registrado.
- `npm run smoke:demo`: nao executado nesta sessao porque `npm.cmd` nao esta disponivel no PATH do runtime.
- `GET http://localhost:3000/login`: `200`.
- `GET http://localhost:3001/health`: `200`, `{"status":"ok","modo":"demo-local"}`.
