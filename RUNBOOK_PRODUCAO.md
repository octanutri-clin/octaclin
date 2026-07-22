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
6. Validar login.
7. Validar uma jornada critica afetada pela mudanca.

### Validacao pos-deploy minima

```powershell
curl https://<backend-render-url>/health
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

- Backend `/health`.
- Login web.
- Banco via backend.
- Redis/fila.
- Envio email.
- Envio WhatsApp.
- Webhook WhatsApp.
- Criacao de evento Google Calendar.

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
