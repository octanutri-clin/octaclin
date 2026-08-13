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

Para readiness de deploy e monitoramento use tambem:

```powershell
curl https://<backend-render-url>/health/pronto
```

Esse endpoint responde `503` quando o banco estiver indisponivel ou houver
migration pendente. `/health/detalhado` permanece compativel para diagnostico e
inclui latencia do `SELECT 1` e contadores sanitizados do pool Postgres.

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

Roles criadas pelo Console/API/CLI do Neon recebem privilegios administrativos
e nao devem ser usadas como login runtime nem como evidencia de RLS. Crie a
role da aplicacao por SQL, conceda apenas `CONNECT`, `USAGE` de schema, acesso
necessario a tabelas/sequencias e confirme `rolsuper=false` e
`rolbypassrls=false`. Use `neondb_owner` somente para migrations e administracao.

### Ciclo de vida de tenants (Fase 228)

A migration aditiva `AdicionarCicloVidaTenants1720000001027` cria metadados
globais de provisionamento e ciclo de vida em `tenants`. Como o ORM passa a
selecionar essas colunas, a ordem obrigatoria e expandir o banco antes do
deploy. Confirmar projeto, branch, banco e role `neondb_owner`; executar apenas
se a `1027` for a unica pendente. Depois, verificar 40 migrations aplicadas,
as colunas `provisionamento_referencia`, `ciclo_vida_status` e `encerrado_em`,
a constraint `tenants_ciclo_vida_status_check` e os indices
`uq_tenants_provisionamento_referencia` e `idx_tenants_ciclo_vida_status`.

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

### Fase 216 - plano alimentar e catalogo TACO

Com `BANCO_EXECUTAR_MIGRACOES=false`, aplicar a migration
`1720000001021-CriarPlanosAlimentares` com role owner. Antes de executar,
`migration:show` deve indicar somente a `1021` como pendente; qualquer outra
pendencia exige interrupcao e diagnostico do banco-alvo.

```powershell
$env:DATABASE_URL='<url owner do banco explicitamente confirmado>'
Push-Location octaclin-backend
pnpm run typeorm -- migration:show
pnpm migration:run
pnpm run typeorm -- migration:show
Pop-Location
Remove-Item Env:DATABASE_URL
```

Validar as cinco tabelas clinicas com `relrowsecurity=true` e
`relforcerowsecurity=true`, uma policy `isolamento_tenant_*` em cada uma e os
triggers de imutabilidade/publicacao. As tabelas de fonte e alimento sao
catalogo global e nao contem dado de paciente.

Depois da migration, carregar o artefato TACO. O comando recusa banco cujo nome
nao coincida exatamente com `TACO_BANCO_ESPERADO`:

```powershell
$env:DATABASE_URL='<url owner do banco explicitamente confirmado>'
$env:TACO_CONFIRMAR_CARGA='true'
$env:TACO_BANCO_ESPERADO='<nome exato do banco>'
Push-Location octaclin-backend
pnpm catalogo:taco:carregar
Pop-Location
Remove-Item Env:DATABASE_URL
Remove-Item Env:TACO_CONFIRMAR_CARGA
Remove-Item Env:TACO_BANCO_ESPERADO
```

Esperado: uma fonte `taco_nepa_unicamp` e 583 alimentos para a versao atual.
A carga e idempotente e nao remove catalogo anterior. Nao regenerar o JSON em
producao; o artefato versionado no repositorio e a entrada do carregador.

No smoke, usar somente paciente sintetico: criar rascunho, selecionar avaliacao,
salvar, revisar, publicar e conferir o portal. Condicao especial deve ser
recusada. O portal nao pode exibir formula, metabolismo, antropometria, hash ou
fonte interna.

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

### API publica e webhooks (Fase 218)

O codigo da Fase 218 depende da migration aditiva
`CriarIntegracoesApiPublica1720000001022`. Como producao usa
`BANCO_EXECUTAR_MIGRACOES=false`, aplicar o schema **antes** do deploy do codigo.
Use somente a URL explicitamente confirmada de `Octaclin-db-producao` com role
`neondb_owner`. A role `octaclin_app_producao` nao deve executar migrations.

```powershell
$url = '<URL owner de producao confirmada>'
try {
  $env:DATABASE_URL = $url
  pnpm --dir octaclin-backend run typeorm -- migration:show
  # Parar se qualquer migration alem da 1022 estiver pendente.
  pnpm --dir octaclin-backend migration:run
  pnpm --dir octaclin-backend run typeorm -- migration:show
} finally {
  Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
  $url = $null
}
```

Nunca executar seed com essa URL ativa. Em falha, nao rodar `migration:revert`:
registrar o erro com credenciais redigidas e investigar o estado transacional.

Verificacao obrigatoria no SQL Editor do mesmo banco:

```sql
select relname, relrowsecurity, relforcerowsecurity
from pg_class
where relname in ('api_chaves', 'webhook_assinaturas', 'webhook_entregas')
order by relname;

select tablename, policyname
from pg_policies
where tablename in ('api_chaves', 'webhook_assinaturas', 'webhook_entregas')
order by tablename, policyname;

select tablename, indexname
from pg_indexes
where tablename in (
  'api_chaves', 'webhook_assinaturas', 'webhook_entregas',
  'pacientes', 'agenda_consultas'
)
and (indexname like '%api_chaves%' or indexname like '%webhook_%'
  or indexname in ('ux_pacientes_referencia_externa', 'ux_agenda_consultas_referencia_externa'))
order by tablename, indexname;

select table_name, column_name
from information_schema.columns
where (table_name = 'pacientes' or table_name = 'agenda_consultas')
  and column_name = 'referencia_externa'
order by table_name;
```

Esperado: RLS `t|t` nas tres tabelas; policies
`isolamento_tenant_api_chaves`, `isolamento_tenant_webhook_assinaturas` e
`isolamento_tenant_webhook_entregas`; indices da migration; e duas colunas de
referencia externa. Conferir tambem as FKs compostas descritas em
`fase-218-api-publica-chaves-webhooks.md`.

Depois do deploy, criar credenciais somente com dados sinteticos. Confirmar:

1. chave aparece completa uma vez e chamadas sem escopo recebem HTTP 403;
2. repetir o mesmo `referenciaExterna` devolve o mesmo ID;
3. chave revogada recebe HTTP 401 na chamada seguinte;
4. webhook recebe o corpo minimo e HMAC valido conforme `API_PUBLICA_V1.md`;
5. entrega 2xx aparece como entregue e uma falha pode ser reprocessada;
6. remover ou revogar todas as credenciais usadas no aceite.

### Exames laboratoriais e evolucao fotografica (Fase 236)

Antes de disponibilizar a interface de exames, aplicar a migration aditiva
`CriarExamesEFotosClinicas1720000001024` primeiro em staging. Use somente a
URL owner do banco de testes explicitamente confirmado. Nao use URL de
producao, nem a role de aplicacao. `migration:show` deve indicar somente a
`1024` como pendente; se houver outra, interromper e revisar o banco-alvo.

```powershell
$url = '<URL owner do banco de staging confirmada>'
try {
  $env:DATABASE_URL = $url
  pnpm --dir octaclin-backend run typeorm -- migration:show
  # Parar se alguma migration alem da 1024 estiver pendente.
  pnpm --dir octaclin-backend migration:run
  pnpm --dir octaclin-backend run typeorm -- migration:show
} finally {
  Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
  $url = $null
}
```

Nao executar seed, `migration:revert` ou o `down` com essa URL ativa. Em caso
de falha, preservar o erro com a URL redigida e investigar o estado antes de
qualquer nova tentativa.

No SQL Editor do mesmo banco de staging, validar:

```sql
select relname, relrowsecurity, relforcerowsecurity
from pg_class
where relname in (
  'coletas_exames_laboratoriais',
  'marcadores_exames_laboratoriais',
  'consentimentos_evolucao_fotografica',
  'evolucoes_fotograficas'
)
order by relname;

select tablename, policyname
from pg_policies
where tablename in (
  'coletas_exames_laboratoriais',
  'marcadores_exames_laboratoriais',
  'consentimentos_evolucao_fotografica',
  'evolucoes_fotograficas'
)
order by tablename, policyname;

select tablename, indexname
from pg_indexes
where tablename in (
  'coletas_exames_laboratoriais',
  'marcadores_exames_laboratoriais',
  'consentimentos_evolucao_fotografica',
  'evolucoes_fotograficas'
)
order by tablename, indexname;
```

Esperado: quatro linhas com RLS `t|t`; as policies
`isolamento_tenant_coletas_exames`, `isolamento_tenant_marcadores_exames`,
`isolamento_tenant_consentimentos_fotos` e `isolamento_tenant_evolucoes_fotos`;
e os quatro indices `idx_*` da migration, alem das chaves primarias. So depois
disso usar uma conta e paciente sinteticos autorizados para registrar uma
coleta, listar a serie e confirmar auditoria sem valor clinico no log.

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

Rotacao segura da Gmail API:

1. Copiar `GMAIL_CLIENT_ID` e `GMAIL_CLIENT_SECRET` do Render somente para
   variaveis da sessao local.
2. Definir `GMAIL_REFRESH_TOKEN_OUTPUT` como arquivo temporario inexistente e
   executar `node octaclin-backend/scripts/gmail-oauth-token.mjs`.
3. Autorizar a conta remetente e substituir apenas `GMAIL_REFRESH_TOKEN` no
   Render, sem registrar o valor em terminal, commit ou documentacao.
4. Apagar o arquivo temporario, remover as tres variaveis locais e limpar a
   area de transferencia.
5. Implantar e confirmar uma entrega real controlada.

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
5. Criar um evento externo sintetico no Google e usar `Sincronizar agora`.
6. Confirmar que o horario aparece como indisponivel na agenda interna.

Falhas comuns:

- refresh token revogado;
- calendario alvo incorreto;
- conflito de horario;
- timezone errado;
- credenciais ausentes.
- `OCTACLIN_PROCESSO=web` sem worker separado;
- fila Redis sem consumidor ou carga inicial sem `syncToken`.

Quando o canal estiver conectado, mas eventos externos nao aparecerem, use o
comando `Sincronizar agora` como recuperacao. Enquanto nao houver worker
dedicado, mantenha `OCTACLIN_PROCESSO=all`. A sincronizacao inicial limita a
janela a 30 dias anteriores e 400 dias futuros; a renovacao semanal move esse
horizonte. As incrementais usam somente o `syncToken` persistido.

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
- `status: falha`: dependencia critica falhou — banco fora do ar ou schema atras
  do codigo.
- `checks.banco`: executa `SELECT 1`. Atencao: isso prova conexao viva, **nao**
  schema correto. Use `checks.migracoes` para isso.
- `checks.migracoes`: acusa migrations pendentes. `falha` aqui significa que o
  banco esta atras do codigo implantado: as entidades apontam para colunas que
  nao existem e as features da fase correspondente nao funcionam, ainda que o
  login e o `/health` respondam normalmente. A correcao e rodar
  `pnpm --dir octaclin-backend migration:run` pelo procedimento de migration
  deste runbook, nunca reverter o deploy.

  Este check existe porque em 2026-08-06 producao estava cinco migrations atras
  (`1015` a `1019`) e nada apontava para isso: `/health/detalhado` respondia
  `200`, e as Fases 206 a 209 estavam no ar com o schema faltando. Nao inferir
  estado de migration por codigo HTTP de rota autenticada — `401` vem do guard,
  antes de qualquer acesso ao banco, e nao prova nada.

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

### Monitor externo da Fase 220

O workflow `Monitor producao` verifica a cada 30 minutos, quando habilitado:

- `/health/pronto`, incluindo banco e migrations;
- `/health/detalhado`, incluindo Redis, email, WhatsApp e Google Calendar;
- `/login`, sem autenticar, para confirmar que a web entrega a identidade
  OctaClin.

Falha persistente abre a issue `[Alerta producao] Saude externa indisponivel`.
O workflow tambem acompanha `Backup producao` e usa a issue
`[Alerta producao] Backup automatico falhou`. As issues sao deduplicadas e
fechadas pelo proprio workflow na recuperacao.

Execucao manual:

```powershell
gh workflow run monitor-producao.yml --ref main
gh run list --workflow monitor-producao.yml --limit 5
```

Nao copie o corpo de health, logs integrais ou credenciais para a issue. Use o
link da execucao e o horario para diagnosticar no Render. Se o cron estiver
desabilitado, conferir `OCTACLIN_MONITOR_AUTOMATICO_HABILITADO` nas Repository
Variables do GitHub.

### Regressao autenticada somente leitura da Fase 221

Execute o gate de `fase-221-regressao-e2e-producao-isolada.md` separadamente
para `Professional`, `SuperAdmin`, `Client` e `Patient`. Confirme a identidade da conta antes
de cada rodada, leia a senha via clipboard e remova todas as variaveis no
`finally`. Nao reutilize senha em argumento de linha de comando, arquivo,
GitHub Actions ou historico do terminal.

Falha em HTTP 5xx, rede, console, pagina, login ou autorizacao bloqueia o
aceite. `net::ERR_ABORTED` provocado pela navegacao deliberada entre telas e o
unico cancelamento ignorado. Nao use este smoke para criar dados ou validar
mutacoes; essas jornadas exigem massa sintetica e ambiente dedicado.

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
