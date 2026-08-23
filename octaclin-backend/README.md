# OctaClin Backend - Fundacao

Backend NestJS inicial da Fase 0.

## Rodar localmente

```bash
cp .env.example .env
npm install
npm run start:dev
```

Infra local:

```bash
docker compose -f ../docker-compose.yml up -d
```

Seed demo:

```bash
npm run migration:run
npm run seed:demo
```

Credenciais criadas pelo seed:

- Tenant: `clinica-carla`
- SuperAdmin: `admin@octaclin.local`
- Profissional: `dra.carla@example.com`
- Paciente: `paciente.demo@example.com`
- Senha: `OctaClin@123`

Na tela web de login, o campo `API` deve apontar para o backend, por exemplo `http://localhost:3001` quando a web estiver em `3000` ou `3002`.

Sem Docker/Postgres local, use a API demo para navegar pela interface:

```bash
npm run mock:api
```

Ela sobe em `http://localhost:3001` e aceita as credenciais demo acima.
Tambem e possivel iniciar web + API demo pelo script raiz `outputs/iniciar-demo-local.ps1`.

Smoke operacional, com backend rodando:

```bash
npm run smoke:operacoes
```

Variaveis opcionais:

- `SMOKE_API_URL`
- `SMOKE_TENANT_SLUG`
- `SMOKE_EMAIL`
- `SMOKE_SENHA`

## Decisoes

- Multitenancy por PostgreSQL RLS usando `tenant_id`.
- O boot nao executa migrations sem `BANCO_EXECUTAR_MIGRACOES=true` explicito.
  Para staging e producao, aplique `npm run migration:run` fora de banda com a
  role owner do banco antes do deploy.
- Dados sensiveis preparados para criptografia AES-256-GCM.
- O backend principal permanece modular; IA deve entrar como microservico FastAPI nas fases seguintes.

## Headers

Desde a Fase 1, o tenant e derivado do JWT validado. O header `x-tenant-id` foi removido do fluxo de aplicacao para evitar spoofing de tenant.

## Auth

```http
POST /auth/login
{
  "tenantSlug": "clinica-carla",
  "email": "dra.carla@example.com",
  "senha": "senha-forte"
}
```

Use o `accessToken` retornado:

```http
Authorization: Bearer <accessToken>
```

Rotacao de refresh token:

```http
POST /auth/renovar
{
  "refreshToken": "<refreshToken>"
}
```

## CRUD principal

- `POST /profissionais`
- `GET /profissionais`
- `GET /profissionais/:id`
- `PATCH /profissionais/:id`
- `DELETE /profissionais/:id`
- `POST /pacientes`
- `GET /pacientes`
- `GET /pacientes/:id`
- `PATCH /pacientes/:id`
- `DELETE /pacientes/:id`

Deletes sao arquivamentos logicos para preservar auditoria clinica.
As listagens de pacientes e profissionais retornam DTOs minimizados com nomes descriptografados para usuarios autorizados.
Criacao e atualizacao de pacientes/profissionais tambem retornam DTOs autorizados, sem expor campos criptografados da entidade ORM.
Leituras de listagem e detalhe de pacientes/profissionais gravam eventos em `user_action_logs` com usuario, tenant, recurso, IP, user-agent e metadados de paginacao quando aplicavel.

## Questionarios

- `POST /categorias-pergunta`
- `GET /categorias-pergunta`
- `POST /questionarios`
- `GET /questionarios`
- `PATCH /questionarios/:id`
- `POST /questionarios/:id/perguntas`
- `GET /questionarios/:id/perguntas`
- `PATCH /questionarios/:id/perguntas/:perguntaId`
- `PATCH /questionarios/:id/perguntas/ordem`
- `POST /agendamentos-questionario`

O processador de agendamentos roda a cada minuto e cria `envios_questionario` com status `pendente`. Na Fase 3, esses envios passam a alimentar filas BullMQ para WhatsApp, e-mail e push.

## Comunicacoes

- `POST /comunicacoes/canais`
- `GET /comunicacoes/canais`
- `POST /comunicacoes/templates`
- `GET /comunicacoes/templates`
- `POST /comunicacoes/mensagens`

Mensagens sao persistidas como `pendente` e gravam um evento em `outbox_eventos` na mesma transacao.
O processador de outbox publica jobs idempotentes na fila BullMQ `notificacoes`.

## IA

- `POST /ia/sentimento`
- `POST /ia/reconhecimento-alimentar`

Configure `IA_SERVICE_URL` apontando para o microservico FastAPI.

## Automacoes

- `POST /automacoes/regras`
- `GET /automacoes/regras`
- `POST /automacoes/avaliacoes`

## Gamificacao

- `POST /gamificacao/circulos`
- `POST /gamificacao/circulos/:id/membros`
- `POST /gamificacao/posts`
- `POST /gamificacao/desafios`
- `POST /gamificacao/desafios/progresso`
- `GET /gamificacao/desafios/:id/ranking`
- `POST /gamificacao/badges`
- `POST /gamificacao/badges/concessoes`

## Mobile

- `POST /mobile/diario-rapido`
- `POST /mobile/midias/uploads`
- `POST /mobile/acompanhantes`
- `POST /mobile/sincronizacao/lote`

Audio e limitado a 2 minutos; video e limitado a 30 segundos.
O lote mobile usa `idLocal` para idempotencia e evita duplicar registros em retentativas offline.

## Operacoes

Rotas protegidas por JWT e papel `SuperAdmin`:

- `GET /operacoes/resumo`
- `GET /operacoes/outbox/falhas`
- `POST /operacoes/outbox/:id/reprocessar`
- `GET /operacoes/mobile/sincronizacoes`
- `GET /operacoes/auditoria`

Use essas rotas para acompanhar outbox transacional, suporte de sincronizacao mobile e trilhas de leitura sensivel.
`GET /operacoes/auditoria` aceita filtros opcionais `acao`, `recursoTipo`, `recursoId`, `usuarioId`, `inicio`, `fim` e `limite`.

## Saude

- `GET /health`

Usado por load balancers, ECS, Container Apps e verificacoes de rollout.
