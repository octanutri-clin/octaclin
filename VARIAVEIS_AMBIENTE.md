# OctaClin - Variaveis de ambiente

Este arquivo documenta variaveis sem expor valores. Nunca commite `.env` real ou secrets.

## Regras

- Valores reais devem ficar apenas no provedor adequado: Render, Neon, provedor de Redis, Google, Meta ou ambiente local privado.
- Se um token aparecer no chat ou em arquivo versionado, rotacione.
- Use nomes consistentes entre staging e producao.
- Producao deve ter secrets separados de staging.
- O backend recusa iniciar em producao se `CORS_ORIGINS`, `JWT_SEGREDO`,
  `JWT_REFRESH_SEGREDO`, `CRIPTOGRAFIA_CHAVE_AES_256` ou
  `FORMULARIO_PUBLICO_SEGREDO` estiverem ausentes. Desde o PR 39 da governanca
  de seguranca, `CRIPTOGRAFIA_CHAVE_AES_256` tambem precisa ter pelo menos 32
  bytes em producao, e o TLS do Postgres passa a exigir cadeia e hostname
  validos em staging e producao.
- Desde o PR 40, `JWT_SEGREDO` e `JWT_REFRESH_SEGREDO` sao obrigatorios em
  staging **e** producao, precisam ter pelo menos 32 bytes e precisam ser
  diferentes entre si. Nao ha mais heranca de `JWT_SEGREDO` para o refresh nem
  fallback publico versionado; fora de staging/producao a ausencia gera um
  segredo aleatorio por processo.
  Quando Google Calendar estiver configurado, tambem exige
  `GOOGLE_CALENDAR_OAUTH_STATE_SECRET` com pelo menos 32 bytes;
  `CORS_ORIGINS` nao pode conter `*`.
- Na Fase 201, processos que executam filas em producao tambem exigem Redis e
  devem receber papel explicito antes de escalar: `web` para HTTP e `worker`
  para consumidores/cron.
- Desde o PR 51, o processo mede o menor privilegio dos providers no bootstrap
  e em `GET /operacoes/providers` (SuperAdmin): role do Postgres sem
  `SUPERUSER`/`BYPASSRLS`, sem pertinencia a role privilegiada e sem `CREATE`
  no schema `public`; Redis com TLS; endpoint de armazenamento em HTTPS. Uma
  violacao aparece como `error` no log do deploy e **nao** derruba o boot: a
  falha fechada entra depois da evidencia de producao, conforme
  `docs/governance/POLITICA_PROVIDERS_MENOR_PRIVILEGIO.md`.

## Backend

| Variavel | Obrigatoria | Uso | Onde configurar | Como validar |
| --- | --- | --- | --- | --- |
| `NODE_ENV` | Sim | Ambiente (`development`, `production`) | Render/backend | Logs e comportamento de producao |
| `APP_AMBIENTE` | Recomendada em staging e producao | Ambiente real: `local`, `test`, `staging` ou `producao`. Sem ela o backend deduz por `NODE_ENV`, que nao separa staging de producao no Render | Render/backend e worker | Valor invalido derruba o boot; `staging` passa a exigir as mesmas regras de falha fechada de producao |
| `OCTACLIN_PROCESSO` | Sim no rollout multi-instancia | `web`, `worker` ou `all` (somente compatibilidade/local) | Render/backend e worker | HTTP nao consome jobs; worker nao abre porta HTTP |
| `PORT` | Sim | Porta do backend | Render/backend | `/health` responde |
| `CORS_ORIGINS` | Sim em producao | Origens web autorizadas, separadas por virgula e sem `*` | Render/backend | Login/BFF funciona apenas pela origem oficial |
| `DATABASE_URL` | Sim | Conexao Neon/Postgres por papel sem `BYPASSRLS`, sem `SUPERUSER`, sem pertinencia a role privilegiada e sem `CREATE` no schema `public`. Colar a URL da role owner aqui nao gera erro: a aplicacao sobe e o isolamento entre tenants deixa de existir em silencio | Render/backend | `/health`, login, migrations e RLS; `GET /operacoes/providers` reporta `postgres: conforme` |
| `BANCO_SSL` | Nao | `true` liga TLS na conexao Postgres; qualquer valor fora de `true`/`false` derruba o boot | Render/backend e worker | Com TLS ligado a cadeia e o hostname sao sempre verificados; nao existe variavel que desligue a verificacao em nenhum ambiente |
| `BANCO_SSL_CA` | Nao | Certificado PEM da CA confiavel, quando o banco nao usa CA publica. Exclusiva com `BANCO_SSL_CA_ARQUIVO` | Render/backend e worker | Conexao estabelece; PEM invalido derruba o boot |
| `BANCO_SSL_CA_ARQUIVO` | Nao | Caminho para o PEM da CA confiavel | Render/backend e worker | Arquivo ilegivel ou sem certificado derruba o boot |
| `BANCO_SSL_SERVERNAME` | Nao | Nome esperado no certificado quando o host da conexao difere dele (pooler/proxy). O driver `pg` reescreve o SNI com o host, entao o nome declarado e aplicado na verificacao de identidade | Render/backend e worker | Certificado com outro nome passa a ser recusado |
| `BANCO_EXECUTAR_MIGRACOES` | Nao | Executar migrations no boot somente com `true` literal; ausente ou `false` nao executa DDL | Local/Render backend | Runtime sobe sem DDL; `pnpm --dir octaclin-backend migration:run` aplica explicitamente com role owner |
| `BANCO_POOL_MAX` | Nao | Maximo de conexoes por processo, padrao 10 | Render/backend e worker | `/health/detalhado` mostra limite e uso do pool |
| `BANCO_POOL_CONNECTION_TIMEOUT_MS` | Nao | Prazo para obter/conectar cliente Postgres, padrao 5000 ms | Render/backend e worker | Saturacao falha em prazo finito |
| `BANCO_POOL_IDLE_TIMEOUT_MS` | Nao | Tempo ocioso antes de liberar conexao, padrao 30000 ms | Render/backend e worker | Conexoes ociosas retornam ao Neon |
| `BANCO_HEALTH_TIMEOUT_MS` | Nao | Prazo dos checks de banco e migrations, padrao 1500 ms | Render/backend | `/health/pronto` nao fica pendurado |
| `REDIS_URL` | Sim para worker em producao | Filas/outbox/cache. Use `rediss://` em staging e producao: a URL carrega usuario e senha, e o payload de fila carrega tenant e conteudo de comunicacao | Render/backend e worker | Comunicacoes processam; `GET /operacoes/providers` reporta `redis: conforme` |
| `JWT_SEGREDO` | Sim | Assinatura do access token; minimo 32 bytes em staging/producao | Render/backend | Login funciona; ausencia, material curto ou valor igual ao refresh derruba o boot |
| `JWT_REFRESH_SEGREDO` | Sim | Assinatura do refresh token; minimo 32 bytes e obrigatoriamente diferente de `JWT_SEGREDO` | Render/backend | Renovacao de sessao funciona; nao ha mais heranca de `JWT_SEGREDO` |
| `JWT_EXPIRA_EM` | Nao | Validade do access token, padrao `15m`. E o valor devolvido ao cliente em `expiraEmSegundos` | Render/backend | Janela em que um access token sobrevive a uma revogacao de sessao |
| `JWT_REFRESH_EXPIRA_EM` | Nao | Validade do refresh token e da sessao, padrao `30d`. Define tambem o `maxAge` do cookie de renovacao no BFF | Render/backend | Tempo maximo de sessao inativa |
| `JWT_EMISSOR` | Nao | `iss` assinado e exigido na verificacao, padrao `octaclin` | Render/backend | Token de outro emissor e recusado; mudar invalida os tokens em circulacao |
| `JWT_AUDIENCIA` | Nao | `aud` assinado e exigido na verificacao, padrao `octaclin-api` | Render/backend | Token de outra audiencia e recusado; mudar invalida os tokens em circulacao |
| `CRIPTOGRAFIA_CHAVE_AES_256` | Sim | Chave-base da criptografia de PII e conteudo clinico; minimo 32 bytes em staging/producao | Render/backend e worker | Dados sensiveis salvam/leem; ausencia ou material curto derruba o boot |
| `CRIPTOGRAFIA_CHAVE_AES_256_ANTERIOR` | Nao | Chave anterior durante uma rotacao (dual-read). A escrita usa somente a chave atual | Render/backend e worker | Registros da chave antiga continuam legiveis; remover ao fim da janela |
| `CRIPTOGRAFIA_CHAVE_INDICE_HMAC` | Nao | Material dedicado do indice cego de busca por PII, separado da chave de cifra | Render/backend e worker | Trocar invalida os hashes gravados: exige `pnpm --dir octaclin-backend backfill:indices-busca` na mesma janela |
| `FORMULARIO_PUBLICO_SEGREDO` | Sim em producao | Assinatura dedicada dos links publicos de formularios, minimo 32 bytes | Render/backend | Link de formulario abre e aceita rascunho/resposta |
| `OCTACLIN_WEB_URL` | Sim | Links de convite/recuperacao | Render/backend | Link de email aponta para web correta |
| `WEB_URL` | Opcional | Fallback para links | Render/backend | Links gerados |
| `EXPOR_LINK_RECUPERACAO_SENHA` | Nao em producao | Expor link em resposta para debug | Local/staging restrito | API retorna link quando esperado |

## Email/Gmail

| Variavel | Obrigatoria | Uso | Onde configurar | Como validar |
| --- | --- | --- | --- | --- |
| `EMAIL_PROVEDOR` | Recomendado | `smtp` ou `gmail_api` | Render/backend | Envio usa provedor correto |
| `EMAIL_REMETENTE` | Recomendado | Remetente exibido | Render/backend | Email recebido com remetente correto |
| `EMAIL_SMTP_HOST` | Para SMTP | Host SMTP | Render/backend | Envio SMTP funciona |
| `EMAIL_SMTP_PORT` | Para SMTP | Porta SMTP | Render/backend | Envio SMTP funciona |
| `EMAIL_SMTP_SECURE` | Para SMTP | TLS/SSL SMTP | Render/backend | Envio SMTP funciona |
| `EMAIL_SMTP_USUARIO` | Para SMTP | Usuario SMTP | Render/backend | Envio SMTP autentica |
| `EMAIL_SMTP_SENHA` | Para SMTP | Senha/app password SMTP | Render/backend | Envio chega |
| `EMAIL_SMTP_FAMILY` | Opcional | Forcar IPv4/IPv6 | Render/backend | Corrige timeout SMTP |
| `EMAIL_SMTP_CONNECTION_TIMEOUT_MS` | Opcional | Timeout conexao SMTP | Render/backend | Logs sem timeout |
| `EMAIL_SMTP_GREETING_TIMEOUT_MS` | Opcional | Timeout greeting SMTP | Render/backend | Logs sem timeout |
| `EMAIL_SMTP_SOCKET_TIMEOUT_MS` | Opcional | Timeout socket SMTP | Render/backend | Logs sem timeout |
| `EMAIL_SMTP_ALLOW_INTERNAL_NETWORK_INTERFACES` | Somente local/teste | Permitir relay em rede interna; sempre ignorada como `false` em staging/producao | Local/teste | Configuracao permissiva nao alcanca rede interna em ambiente fechado |
| `GMAIL_USUARIO` | Para Gmail API | Usuario Gmail | Render/backend | Gmail API envia |
| `GMAIL_CLIENT_ID` | Para Gmail API | OAuth client id | Render/backend | Token renova |
| `GMAIL_CLIENT_SECRET` | Para Gmail API | OAuth client secret | Render/backend | Token renova |
| `GMAIL_REFRESH_TOKEN` | Para Gmail API | Refresh token | Render/backend | Envio Gmail API funciona |
| `GMAIL_TOKEN_URI` | Opcional | Endpoint OAuth canonico Google; override aceito apenas para mock HTTPS `.test` em `NODE_ENV=test` | Render/backend | Configuracao externa/loopback e rejeitada antes do fetch |

## WhatsApp Meta

| Variavel | Obrigatoria | Uso | Onde configurar | Como validar |
| --- | --- | --- | --- | --- |
| `META_WHATSAPP_TOKEN` | Sim | Envio Meta Cloud API | Render/backend | Envio real controlado |
| `META_WHATSAPP_PHONE_NUMBER_ID` | Sim | Numero remetente | Render/backend | Envio para numero de teste |
| `META_WHATSAPP_WEBHOOK_VERIFY_TOKEN` | Sim com Meta | Verificacao webhook | Render/backend e Meta | Challenge numerico valida como `text/plain` |
| `META_WHATSAPP_APP_SECRET` | Sim com Meta | HMAC SHA-256 do webhook, minimo 32 bytes | Render/backend | Assinatura sobre raw body valida |
| `META_WHATSAPP_WEBHOOK_RECEIVE_TOKEN` | Opcional legado | Defesa adicional da URL antiga | Render/backend e callback antigo | Nao substitui a assinatura Meta |
| `META_WHATSAPP_API_VERSION` | Opcional | Versao Graph API | Render/backend | Logs/URL Meta corretos |

## Google Calendar

| Variavel | Obrigatoria | Uso | Onde configurar | Como validar |
| --- | --- | --- | --- | --- |
| `GOOGLE_CALENDAR_CLIENT_ID` | Sim | Client ID do OAuth Google | Render/backend | Botao redireciona ao consentimento |
| `GOOGLE_CALENDAR_CLIENT_SECRET` | Sim | Client secret do OAuth Google | Render/backend | Callback conclui sem erro |
| `GOOGLE_CALENDAR_OAUTH_STATE_SECRET` | Sim com OAuth Google | Segredo HMAC dedicado para state OAuth, minimo 32 bytes | Render/backend | Callback valida state sem fallback previsivel |
| `OCTACLIN_BACKEND_URL` | Recomendado | Base publica do callback e webhook | Render/backend | URL gerada aponta para producao |
| `OCTACLIN_WEB_URL` | Sim em producao | Retorno apos o consentimento | Render/backend | Retorna para `/agenda?google=conectado` |
| `GOOGLE_CALENDAR_REFRESH_TOKEN` | Opcional | Compatibilidade com agenda compartilhada antiga | Render/backend | Health indica modo compativel |
| `GOOGLE_CALENDAR_ID` | Opcional | Calendario da agenda compartilhada antiga | Render/backend | Evento aparece no calendario |
| `GOOGLE_CALENDAR_TOKEN_URI` | Opcional | Endpoint OAuth canonico Google; override aceito apenas para mock HTTPS `.test` em `NODE_ENV=test` | Render/backend | Configuracao externa/loopback e rejeitada antes do fetch |

Na conexao individual da Fase 136, os refresh tokens sao obtidos no callback
OAuth e armazenados criptografados por profissional. No Google Cloud Console,
registre exatamente `https://octaclin-backend-producao.onrender.com/agenda/google/callback`
como redirect URI autorizado do cliente OAuth de producao.

Desde o PR 46, o inicio passa por um ticket curto e de uso unico no backend,
mas o redirect URI do Google permanece o mesmo. Consentimentos iniciados antes
do deploy devem ser reiniciados para receber binding de navegador e PKCE.

## Frontend/BFF

| Variavel | Obrigatoria | Uso | Onde configurar | Como validar |
| --- | --- | --- | --- | --- |
| `OCTACLIN_COOKIE_SECURE` | Sim em producao | Cookies apenas HTTPS | Render/web | Login persiste em HTTPS |
| `OCTACLIN_BACKEND_URL` | Sim | Backend usado pelo BFF antes e depois do login | Render/web | Login e recuperacao respondem |
| `OCTACLIN_TENANT_SLUG` | Sim em producao | Organizacao atendida pelo frontend | Render/web | Login resolve o tenant sem campo tecnico |
| `OCTACLIN_API_ORIGENS_PERMITIDAS` | Sim em producao | Allowlist da origem do backend | Render/web | BFF aceita apenas backend correto |
| `OCTACLIN_WEB_ORIGENS_PERMITIDAS` | Recomendada com proxy/dominio | Origens HTTPS oficiais aceitas nas mutacoes BFF, separadas por virgula | Render/web | Origem oficial passa; origem externa recebe `403` |
| `NEXT_PUBLIC_*` | Evitar secrets | Variaveis publicas do Next | Render/web | Inspecionar bundle se necessario |

Na Fase 229, o BFF passou a falhar fechado em producao sem cookie `Secure` e
allowlist da API. Mutacoes tambem exigem `Origin`; navegadores modernos devem
informar `Sec-Fetch-Site: same-origin`. Configure
`OCTACLIN_WEB_ORIGENS_PERMITIDAS` no build e runtime quando proxy, URL interna
ou dominio customizado puderem divergir da origem publica.

## Armazenamento de anexos

| Variavel | Obrigatoria | Uso | Onde configurar | Como validar |
| --- | --- | --- | --- | --- |
| `ARMAZENAMENTO_S3_ENDPOINT` | Sim | Endpoint do bucket privado S3-compativel. Precisa ser HTTPS em staging e producao: o valor e usado literalmente, inclusive na assinatura das URLs entregues ao navegador | Render/backend | Assinatura e `HEAD` funcionam; `GET /operacoes/providers` reporta `armazenamento: conforme` |
| `ARMAZENAMENTO_S3_REGION` | Sim | Regiao informada pelo provedor | Render/backend | Cliente S3 inicializa |
| `ARMAZENAMENTO_S3_ACCESS_KEY_ID` | Sim | Chave restrita ao bucket | Render/backend | Upload real funciona |
| `ARMAZENAMENTO_S3_SECRET_ACCESS_KEY` | Sim | Segredo da chave restrita | Render/backend | Nunca aparece na web/logs |
| `ARMAZENAMENTO_BUCKET_MIDIA` | Sim | Nome do bucket privado | Render/backend | Objeto fica no bucket esperado |
| `ARMAZENAMENTO_S3_IF_NONE_MATCH` | Nao | `false` apenas quando o provedor nao aceita escrita condicional, como Backblaze B2 | Render/backend | Upload assinado nao retorna `501` |

O bucket nao pode ter acesso publico. O CORS deve liberar somente a origem web
do ambiente, `PUT`, `GET` e `HEAD`, `content-type`, `if-none-match` e
`x-amz-meta-*`. Configure lifecycle de 1 dia apenas no prefixo `pendentes/`.
Use bucket e credencial diferentes em staging e producao.

## Backup automatizado no GitHub

Estas configuracoes pertencem exclusivamente ao GitHub Environment
`production-backup`; nao devem ser copiadas para Render ou para o backend.

| Nome | Tipo | Uso |
| --- | --- | --- |
| `OCTACLIN_BACKUP_DATABASE_URL` | Secret | Neon producao com role `octaclin_backup_producao` |
| `OCTACLIN_RESTORE_DATABASE_URL` | Secret | Neon dedicado de restore com `neondb_owner` |
| `B2_BACKUP_KEY_ID` | Secret | Chave restrita ao bucket de backup |
| `B2_BACKUP_APPLICATION_KEY` | Secret | Segredo da chave B2 de backup |
| `OCTACLIN_RESTORE_DATABASE_EXPECTED` | Variable | Nome exato do banco dedicado de restore |
| `B2_BACKUP_ENDPOINT` | Variable | Endpoint S3 HTTPS oficial da regiao B2 |
| `B2_BACKUP_REGION` | Variable | Regiao do bucket B2 |
| `B2_BACKUP_BUCKET` | Variable | Bucket privado exclusivo de backup |
| `OCTACLIN_BACKUP_AUTOMATICO_HABILITADO` | Variable | `true` somente depois do primeiro restore aprovado |

## Monitor externo no GitHub

Estas configuracoes sao GitHub Repository Variables. Nao sao secrets e nao
devem conter credenciais, query string ou caminhos.

| Nome | Tipo | Uso |
| --- | --- | --- |
| `OCTACLIN_MONITOR_BACKEND_URL` | Variable | URL base HTTPS oficial do backend de producao |
| `OCTACLIN_MONITOR_WEB_URL` | Variable | URL base HTTPS oficial da web de producao |
| `OCTACLIN_MONITOR_AUTOMATICO_HABILITADO` | Variable | `true` somente depois da execucao manual aprovada |

## Feature flags de rollout

| Variavel | Obrigatoria | Uso | Onde configurar | Como validar |
| --- | --- | --- | --- | --- |
| `OCTACLIN_FEATURE_FLAGS` | Nao | JSON booleano com defaults globais para flags conhecidas | Render/backend | Aba Rollout mostra origem `ambiente` e configuracao valida |

Exemplo sem dados sensiveis:

```json
{"ia.clinica":false,"mobile.sync":false}
```

Omitir a variavel mantem ambas desabilitadas. JSON invalido ou valor que nao
seja booleano falha fechado e gera atencao no painel. A configuracao especifica
do tenant, administrada pelo SuperAdmin, tem precedencia e fica em
`tenant_configuracoes`; nao editar diretamente no banco.

## Servico interno de IA

| Variavel | Obrigatoria | Uso | Onde configurar | Como validar |
| --- | --- | --- | --- | --- |
| `IA_SERVICE_URL` | Sim para habilitar IA | URL privada/base do FastAPI | Render/backend | Health do servico e teste autenticado controlado |
| `IA_SERVICE_TOKEN` | Sim para habilitar IA | Segredo compartilhado, aleatorio e com no minimo 32 caracteres | Render/backend e Render/IA, como secret | POST sem token retorna 401 e backend autenticado recebe 200 |
| `IA_SERVICE_TIMEOUT_MS` | Nao | Timeout entre 1.000 e 60.000 ms; padrao 15.000 | Render/backend | Falha lenta retorna timeout sanitizado |

Nunca usar token da OpenAI como `IA_SERVICE_TOKEN`. Gere um segredo dedicado,
configure o mesmo valor nos dois servicos e mantenha `ia.clinica=false` ate o
aceite. O segredo, URLs assinadas, texto clinico e corpos de resposta nao podem
aparecer em logs, tickets ou documentos versionados.

Desde o PR 47, URL e token devem existir juntos e nao ha fallback automatico
para `localhost`. O FastAPI atual e exclusivamente local, sem provider ou
ferramentas; no reconhecimento ele recebe apenas hash e observacao limitada,
nunca URL assinada ou bytes da imagem. Provider externo e NO-GO ate haver nova
decisao de seguranca e privacidade.

## Smoke local de producao somente leitura

Estas variaveis nunca pertencem ao Render, GitHub ou a arquivos `.env`. Use
somente na sessao temporaria do PowerShell e remova todas no `finally`.

| Nome | Uso |
| --- | --- |
| `E2E_PRODUCAO_READONLY` | Opt-in literal `true` para permitir o smoke real |
| `E2E_WEB_URL` | URL base HTTPS oficial da web no Render |
| `E2E_EMAIL` | Conta do papel validado |
| `E2E_PAPEL` | `Professional`, `SuperAdmin`, `Client` ou `Patient` esperado |
| `E2E_SENHA` | Senha recebida de forma efemera, preferencialmente via clipboard |

## Neon

Secrets ficam no painel Neon e em `DATABASE_URL` no Render. Nao registrar usuario/senha reais em docs.

Tres roles distintas, com escopos que nao se sobrepoem:

| Papel | Onde a credencial vive | Pode |
| --- | --- | --- |
| runtime (`web`, `worker`) | `DATABASE_URL` no Render | DML sob RLS |
| owner | sessao do proprietario, fora de banda | DDL das migrations |
| backup | `OCTACLIN_BACKUP_DATABASE_URL` no GitHub Environment `production-backup` | dump logico |

A separacao e a norma do PR 51:
`docs/governance/POLITICA_PROVIDERS_MENOR_PRIVILEGIO.md`, secao 2. O
procedimento de coleta de evidencia esta na secao 6 do mesmo documento.

## Redis gerenciado

Secrets ficam no painel do provedor de Redis e em `REDIS_URL` no Render. Nao
registrar URL real em docs.

`REDIS_URL` sozinha basta: `configuracao-redis.ts` extrai host, porta, usuario,
senha e TLS dela, e liga TLS quando o esquema e `rediss://`. As variaveis
`REDIS_HOST`, `REDIS_PORTA`, `REDIS_USUARIO`, `REDIS_SENHA` e `REDIS_TLS` sao o
caminho alternativo para quando nao ha URL unica — se `REDIS_URL` estiver
definida, elas sao ignoradas. Nao misturar as duas formas.

Em staging e producao o esquema precisa ser `rediss://` (ou `REDIS_TLS=true`).
Sem TLS, usuario, senha e payload de fila -- que carrega tenant e conteudo de
comunicacao -- trafegam em claro entre o Render e o provedor. O Postgres ja
exige TLS desde o PR 39; o PR 51 passou a medir a mesma propriedade no Redis.

Requisitos do provedor, impostos pelo BullMQ:

- `maxmemory-policy` **precisa** ser `noeviction`. Qualquer outra politica deixa
  o Redis descartar chave sozinho, e no BullMQ isso e job sumindo em silencio.
- Redis 6.2 ou maior (o minimo aceito e 5.0, mas 6.2 e o recomendado para
  producao). Valkey e Dragonfly sao alternativas compativeis.

Em 2026-08-22 a conta gratuita anterior estourou o teto de 500 mil comandos por
mes, com consumo observado de 1,2 a 1,5 milhao e **nenhum cliente em producao**.
A causa nao era uso, era espera: os workers BullMQ usavam os defaults
`drainDelay: 5` e `stalledInterval: 30000`, e com fila vazia cada worker reemite
o comando bloqueante a cada 5 segundos. Corrigido em
`infraestrutura/processamento/opcoes-worker-bullmq.ts`; o calculo esta no
comentario do arquivo. Ao avaliar provedor, considerar que cobranca por comando
pune processo ocioso — cobranca por instancia, nao.

## Checklist de rotacao

Runbook detalhado: `RUNBOOK_ROTACAO_SECRETS.md`.

Antes de commit ou deploy:

```powershell
npm run security:secrets
```

Rotacionar imediatamente se exposto:

- `META_WHATSAPP_TOKEN`
- `GMAIL_REFRESH_TOKEN`
- `GOOGLE_REFRESH_TOKEN`
- `EMAIL_SMTP_SENHA`
- `DATABASE_URL`
- `REDIS_URL`
- `JWT_SEGREDO`
- `JWT_REFRESH_SEGREDO`
- `CRIPTOGRAFIA_CHAVE_AES_256`
- `FORMULARIO_PUBLICO_SEGREDO`
- `ARMAZENAMENTO_S3_ACCESS_KEY_ID`
- `ARMAZENAMENTO_S3_SECRET_ACCESS_KEY`

Depois da rotacao:

1. Atualizar Render.
2. Redeploy.
3. Validar `/health`.
4. Validar login.
5. Validar integracao afetada.
