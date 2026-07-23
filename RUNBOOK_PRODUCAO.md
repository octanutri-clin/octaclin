# OctaClin - Runbook de producao

Este runbook descreve como operar, validar e recuperar o OctaClin em staging/producao. Nao registre secrets neste arquivo.

## Ambientes

### Local

- Backend: `http://localhost:3001`
- Web: `http://localhost:3000`
- Tenant demo: `clinica-carla`
- Senha demo: `OctaClin@123`

### Staging atual

- GitHub: `octanutri-clin/octaclin`
- Backend/Web: Render
- Banco: Neon PostgreSQL
- Redis: Upstash
- Email: Gmail SMTP ou Gmail API
- WhatsApp: Meta Cloud API
- Agenda: Google Calendar

### Producao futura

Producao deve ser separada de staging:

- projeto Render separado ou servicos separados;
- banco Neon separado;
- Redis separado;
- variaveis separadas;
- dominio oficial;
- secrets rotacionados;
- backups e alertas ativos.

## Deploy

### Fluxo esperado

1. Commit validado em `main`.
2. Push para GitHub.
3. Render inicia auto-deploy, se configurado.
4. Aguardar deploy terminar.
5. Validar `/health`.
6. Validar `/health/detalhado` quando a mudanca tocar banco, Redis, email, WhatsApp, Google Calendar ou variaveis.
7. Validar login.
8. Validar uma jornada critica afetada pela mudanca.

### Validacao pos-deploy minima

```powershell
curl https://<backend-render-url>/health
curl https://<backend-render-url>/health/detalhado
```

Depois validar manualmente:

- login web;
- rota principal alterada;
- ausencia de erro visual;
- logs Render sem stack trace novo;
- se comunicacao mudou, validar envio real controlado.

## Rollback

1. Identificar ultimo commit saudavel.
2. Preferir rollback pelo painel Render para deploy anterior quando a falha for operacional.
3. Se precisar corrigir codigo, criar commit de fix para frente.
4. Nao usar `git reset --hard` em ambiente compartilhado sem pedido explicito.

## Banco de dados

Fornecedor atual: Neon PostgreSQL.

Antes de migration sensivel:

- revisar SQL/migration;
- confirmar backup/snapshot;
- rodar em staging;
- validar rollback ou plano de correcao;
- evitar migration destrutiva sem exportacao.

Validacoes:

- conexao backend;
- `/health`;
- login;
- uma leitura e uma escrita por dominio alterado.

## Redis e filas

Fornecedor atual: Upstash Redis.

Usos:

- filas/outbox;
- cache quando aplicavel;
- processamento de comunicacoes.

Sinais de problema:

- comunicacoes nao processam;
- outbox cresce;
- timeouts no backend;
- erros de conexao Redis nos logs.

Acao:

1. Verificar `REDIS_URL`.
2. Verificar status Upstash.
3. Validar logs do backend.
4. Reprocessar outbox quando disponivel.

## Email

Provedores suportados:

- SMTP Gmail;
- Gmail API.

Validacao:

1. Enviar mensagem manual pela interface.
2. Confirmar chegada no email destino.
3. Conferir outbox/status no backend.
4. Conferir logs de erro.

Falhas comuns:

- app password invalida;
- refresh token Gmail expirado/revogado;
- remetente nao configurado;
- bloqueio de seguranca do Google;
- timeout de rede.

## WhatsApp Meta

Componentes:

- token Meta;
- phone number id;
- webhook verify token;
- app secret;
- templates aprovados manualmente;
- webhooks de mensagem/status.

Validacao de envio:

1. Enviar mensagem real controlada.
2. Confirmar status backend `enviado`.
3. Confirmar ID Meta.
4. Confirmar webhook de status quando disponivel.
5. Confirmar recebimento no WhatsApp.

Validacao de recebimento:

1. Enviar mensagem para o numero Meta.
2. Conferir webhook no backend.
3. Confirmar conversa na inbox.
4. Associar contato a paciente quando necessario.

Nunca registre token Meta em commits, docs, issues ou logs.

## Google Calendar

Validacao:

1. Criar consulta no OctaClin.
2. Confirmar evento no Google Calendar.
3. Confirmar email/mensagem de agendamento ao paciente.
4. Conferir logs em caso de erro.

Falhas comuns:

- refresh token revogado;
- calendario alvo incorreto;
- conflito de horario;
- timezone errado;
- credenciais ausentes.

## Healthchecks recomendados

### Liveness

Use `/health` para load balancer, Render e verificacao rapida de processo:

```powershell
curl https://<backend-render-url>/health
```

Resposta esperada:

- `status: ok`
- `servico: octaclin-backend`
- `horario` em ISO.

### Readiness detalhado

Use `/health/detalhado` para suporte, monitoramento e validacao pos-deploy:

```powershell
curl https://<backend-render-url>/health/detalhado
```

Campos principais:

- `status: ok`: backend, banco e configuracoes criticas estao prontos.
- `status: degradado`: backend e banco respondem, mas alguma integracao opcional esta ausente/incompleta.
- `status: falha`: dependencia critica falhou, hoje principalmente banco.
- `checks.banco`: executa `SELECT 1`.
- `checks.redis`: valida se Redis/Upstash esta configurado.
- `checks.email`: valida SMTP ou Gmail API.
- `checks.whatsapp`: valida token e phone number id Meta.
- `checks.googleCalendar`: valida credenciais OAuth do Calendar.

O health detalhado nao deve retornar secrets, tokens, refresh tokens ou URLs com senha. Se aparecer qualquer credencial na resposta, trate como incidente e siga `RUNBOOK_ROTACAO_SECRETS.md`.

## Logs estruturados e correlacao

Cada requisicao HTTP recebe um `requestId`. Quando o cliente enviar `x-request-id` ou `x-correlation-id`, o backend preserva o valor sanitizado; caso contrario, gera um UUID. O mesmo valor volta no header `x-request-id`.

Eventos esperados nos logs do backend:

- `http.request`: requisicao concluida com `requestId`, `tenantId`, `usuarioId`, metodo, rota sem query string, status e duracao.
- `http.request.erro`: requisicao com erro, contendo nome tecnico do erro sem mensagem de negocio.
- `auditoria.falha`: falha ao persistir auditoria sem bloquear o fluxo principal e sem mensagem bruta de erro.

Uso em suporte:

1. Pedir ao usuario o horario aproximado e, se disponivel, o `x-request-id` retornado pela API.
2. Buscar o `requestId` nos logs Render.
3. Cruzar com `tenantId` e `usuarioId` quando a requisicao estiver autenticada.
4. Nunca colar corpo de requisicao, token, senha, email completo ou URL com query string em chamados, commits ou docs.

## Incidentes

### Login indisponivel

1. Verificar Render backend.
2. Verificar `/health`.
3. Verificar banco Neon.
4. Verificar variaveis JWT/cookies/API URL.
5. Conferir logs do backend e web.

### Convites nao chegam

1. Validar email provider.
2. Verificar outbox/logs.
3. Usar reenvio de convite no portal do cliente.
4. Confirmar spam/lixeira.
5. Se necessario, gerar novo convite.

### WhatsApp nao envia

1. Verificar token Meta.
2. Verificar phone number id.
3. Verificar template aprovado.
4. Conferir status no console OctaClin.
5. Conferir logs Render.

### Agenda nao sincroniza

1. Verificar credenciais Google.
2. Verificar timezone.
3. Conferir resposta da API Google.
4. Recriar evento de teste.

## Antes de ativar clientes reais

Ler e executar `CHECKLIST_GO_LIVE.md`.
