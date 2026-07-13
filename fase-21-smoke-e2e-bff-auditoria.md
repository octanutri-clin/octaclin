# Fase 21 - Smoke E2E BFF e auditoria

## Objetivo

Criar uma validacao ponta a ponta do fluxo critico web: login pelo BFF, sessao via cookies `HttpOnly`, leitura de dados sensiveis e consulta dos eventos de auditoria gerados por essas leituras.

## Entregas

- Script `npm run smoke:e2e:bff` no projeto `octaclin-web`.
- Implementacao em `scripts/smoke-e2e-bff.mjs`, sem dependencias novas.
- Parametros por ambiente:
  - `E2E_WEB_URL`, padrao `http://localhost:3000`.
  - `E2E_API_URL`, padrao `http://localhost:3001`.
  - `E2E_TENANT_SLUG`, padrao `clinica-carla`.
  - `E2E_EMAIL`, padrao `admin@octaclin.local`.
  - `E2E_SENHA`, padrao `OctaClin@123`.
- Validacoes cobertas:
  - `GET /api/auth/session` retorna `401` antes do login.
  - `POST /api/auth/login` autentica usando o backend configurado.
  - Cookies `octaclin_access_token` e `octaclin_refresh_token` sao emitidos com `HttpOnly`.
  - `GET /api/pacientes` retorna ao menos um paciente com `nome` e `contato` descriptografados.
  - `GET /api/profissionais` retorna ao menos um profissional com `nome` descriptografado.
  - `GET /api/operacoes/auditoria` encontra eventos `pacientes.listar_dados_sensiveis` e `profissionais.listar_dados_sensiveis`.

## Execucao local esperada

1. Subir Postgres/Redis/MinIO com `docker compose -f ../docker-compose.yml up -d`.
2. Rodar migrations e seed demo no backend.
3. Subir backend em porta diferente da web, por exemplo `PORTA_HTTP=3001`.
4. Subir web em `3000`.
5. Executar `npm run smoke:e2e:bff` em `outputs/octaclin-web`.

## Validacao realizada nesta sessao

- `node --check scripts/smoke-e2e-bff.mjs`: aprovado.
- web `tsc --noEmit`: aprovado.
- backend `tsc --noEmit`: aprovado.
- web `next build`: aprovado.
- backend `nest build`: aprovado.
- `node work/checar-imports-relativos.js`: aprovado, `relative-imports-ok 117`.
- busca por mencoes ao sistema usado como referencia: sem ocorrencias.

## Bloqueio de execucao real nesta maquina

O smoke E2E real nao foi executado ate o fim nesta sessao porque o binario `docker` nao esta disponivel no PATH, e Postgres/Redis nao estao ouvindo localmente nas portas `5432` e `6379`. Tambem havia um servico em `3001`, mas ele nao respondeu como a API Nest esperada (`/health` retornou `404`).
