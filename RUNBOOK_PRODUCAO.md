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

Runbook dedicado: `RUNBOOK_BACKUP_RESTORE.md`.

Antes de migration sensivel:

- revisar SQL/migration;
- confirmar backup/snapshot;
- rodar em staging;
- validar rollback ou plano de correcao;
- evitar migration destrutiva sem exportacao.

Validacoes:

- conexao backend;
- `/health`;
- `/health/detalhado`;
- login;
- uma leitura e uma escrita por dominio alterado.

### Fase 199 - indice de busca de pacientes

Com `BANCO_EXECUTAR_MIGRACOES=false`, aplicar a migration `1013` antes do
deploy do backend. O backfill nunca deve ser executado usando apenas contexto
visual ou nome de ambiente; a confirmacao precisa coincidir com o nome presente
na propria `DATABASE_URL`.

```powershell
$env:DATABASE_URL='<url do banco explicitamente confirmado>'
$env:CONFIRMAR_BANCO_BACKFILL='<nome exato do banco na DATABASE_URL>'
pnpm --dir octaclin-backend migration:run
pnpm --dir octaclin-backend backfill:indices-busca
```

No banco de integracao confirmado, validar o indice e o isolamento com dados
sinteticos:

```powershell
$env:CONFIRMAR_BANCO_BUSCA='<nome exato do banco na DATABASE_URL>'
$env:CONFIRMAR_MASSA_SINTETICA='SIM'
pnpm --dir octaclin-backend smoke:busca-pacientes
```

O smoke insere 500 pacientes sinteticos do tenant de staging; nunca deve ser
executado no banco de producao.

Ordem obrigatoria: backup/branch, staging, teste de busca e isolamento, janela
de producao, migration, backfill e somente entao deploy. A migration e aditiva;
o `down` remove indice e coluna. O backfill pode ser repetido sem duplicar
dados.

### Fase 200 - anexos clinicos

Antes do deploy, criar bucket privado e token S3 restrito ao bucket. Nao usar
dominio publico do R2. Configurar CORS apenas para a origem web do ambiente e
manter credenciais diferentes entre staging e producao.

No CORS, permitir `PUT`, `GET` e `HEAD` e os headers `content-type`,
`if-none-match` e `x-amz-meta-*`. Criar uma regra de lifecycle que remova, apos
1 dia, apenas objetos com prefixo `pendentes/`; nunca aplicar essa regra ao
prefixo `confirmados/`.

Com `BANCO_EXECUTAR_MIGRACOES=false`, aplicar a migration `1014` com role
`neondb_owner`; a `DATABASE_URL` permanente do backend continua usando a role
sem `BYPASSRLS` `octaclin_app_producao`.

```powershell
$env:DATABASE_URL='<url owner do banco explicitamente confirmado>'
pnpm --dir octaclin-backend migration:run
pnpm --dir octaclin-backend run typeorm -- migration:show
Remove-Item Env:DATABASE_URL
```

Depois do deploy, usar somente arquivo sintetico para validar: solicitar URL,
enviar, confirmar, abrir e excluir. Confirmar no provedor que o objeto foi
removido e nos logs que nao houve URL assinada, token ou nome clinico exposto.

Rollback de aplicacao: reverter o deploy. Nao executar o `down` da migration se
ja houver anexos reais; as colunas sao aditivas e podem permanecer sem uso.

### Notificacoes in-app (Fase 210)

Com `BANCO_EXECUTAR_MIGRACOES=false`, aplicar a migration `1720000001020` com
role `neondb_owner` pelo mesmo procedimento das migrations acima. Ela e aditiva:
cria a tabela `notificacoes` com RLS forcada e nao altera tabela existente.

Nao ha conexao persistente para operar. A atualizacao e por polling do navegador:
5s no sino do console e 20s nos paineis de agenda, comunicacoes e dashboard, e
so enquanto a aba esta visivel. Aba em segundo plano nao gera requisicao, o que
importa no plano Render atual: conexao aberta o tempo todo manteria a instancia
acordada e consumiria as horas mensais.

Se o backend estiver hibernado, o poll falha em silencio e o sino mantem o ultimo
estado; nao aparece erro na tela e a rodada seguinte se recupera sozinha. Um sino
parado por muito tempo e sintoma de backend fora, nao de bug do sino — verificar
por `/health` antes de investigar a fase.

A tabela cresce sem expurgo automatico. A consulta quente usa indice parcial
sobre nao lidas e a listagem usa `limit`, entao o efeito e de disco e nao de
latencia; acompanhar o tamanho junto com as demais tabelas no Neon.

### Backup e restore

Antes de go-live e antes de migrations sensiveis:

1. Gerar backup com `powershell -ExecutionPolicy Bypass -File .\validar-backup-restore.ps1`.
2. Validar estrutura do dump com `pg_restore --list`.
3. Executar restore em banco dedicado com `-RestoreTeste`, `RESTORE_DATABASE_URL` e `CONFIRMAR_RESTORE_TESTE=SIM`.
4. Validar `/health/detalhado`, login e leitura de tabelas criticas no banco restaurado.
5. Registrar data, responsavel e arquivo usado fora do Git.

Nunca restaurar diretamente sobre producao sem decisao explicita de incidente e plano de reversao.

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

### Topologia multi-instancia (Fase 201)

- O servico HTTP usa `OCTACLIN_PROCESSO=web` e pode escalar horizontalmente.
- Um unico Background Worker Render usa `OCTACLIN_PROCESSO=worker`; ele executa
  consumidores BullMQ, lembretes e renovacao/reconciliacao Google Calendar.
- Durante a transicao, `all` e somente compatibilidade. Nao escalar o backend
  enquanto ele estiver nesse papel.
- Web e worker compartilham o mesmo Redis e banco runtime, mas o worker nao
  recebe dominio, health check HTTP ou CORS.
- Antes de escalar web, validar uma notificacao sintetica com uma unica entrega
  e outbox `processado`; registrar a evidencia em
  `fase-201-confiabilidade-processadores-multiplas-instancias.md`.

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
- `checks.googleCalendar`: valida `GOOGLE_CALENDAR_CLIENT_ID` e
  `GOOGLE_CALENDAR_CLIENT_SECRET`. Em OAuth individual, a ausencia de refresh
  token global e esperada; `modo: oauth_por_profissional` confirma esse modelo.

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

## Alertas operacionais

O console `/operacoes` exibe a secao `Alertas operacionais`, alimentada por `/operacoes/alertas` no backend e `/api/operacoes/alertas` no BFF web.

Severidades:

- `critico`: exige acao antes de continuar operacao normal.
- `atencao`: exige acompanhamento ou correcao operacional.
- `informativo`: melhora diagnostico, mas nao bloqueia uso.

Fontes atuais:

- health detalhado: banco/backend como servico critico; Redis, email, WhatsApp e Google Calendar como integracoes;
- outbox atrasado: eventos pendentes ou processando acima da janela operacional;
- falhas de comunicacao: itens reprocessaveis ou pendentes na central de comunicacoes;
- deploy: metadados de release ausentes em producao.

Fluxo de resposta:

1. Abrir `/operacoes` e revisar alertas criticos primeiro.
2. Se houver alerta de health, validar `/health/detalhado`.
3. Se houver alerta de outbox, conferir Redis, worker/processador e central de falhas.
4. Se houver alerta de integracao, seguir o runbook especifico do provedor.
5. Usar `requestId` dos logs da Fase 124 quando houver erro em uma requisicao especifica.

## Incidentes

Para atendimento operacional detalhado de login, convites, recuperacao de senha, WhatsApp, email e agenda, use `RUNBOOK_SUPORTE.md`. As secoes abaixo sao apenas o resumo de resposta rapida.

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
