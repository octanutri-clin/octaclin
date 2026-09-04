# OctaClin - Runbook de producao

Este runbook descreve como operar, validar e recuperar o OctaClin em staging/producao. Nao registre secrets neste arquivo.

Para a janela do primeiro cliente, gates GO/NO-GO, responsabilidades,
comunicacao e rollback, use tambem `RUNBOOK_LANCAMENTO.md` e registre a
evidencia sanitizada em `OPERACAO_LANCAMENTO_CONTROLE.md`.

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
- Redis: instancia gerenciada definida por `REDIS_URL`
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

### TLS da conexao com o Postgres

Ate o PR 39 da governanca de seguranca o backend conectava com
`rejectUnauthorized: false`: o canal era cifrado, mas nenhum certificado era
verificado. A partir do PR 39, com TLS ligado (`BANCO_SSL=true` ou
`sslmode=require`/`verify-ca`/`verify-full` na `DATABASE_URL`), a cadeia e o
hostname sao verificados sempre.

Regras em staging e producao (`APP_AMBIENTE=staging` ou `producao`, ou
`NODE_ENV=production` sem `APP_AMBIENTE`):

- TLS e obrigatorio. Sem `BANCO_SSL=true` e sem `sslmode` estrito, o boot falha.
- `sslmode=disable`, `allow` e `prefer` sao recusados.
- `sslmode` desconhecido derruba o boot em vez de virar "sem TLS".

Antes de qualquer deploy que carregue este codigo, confira no provider:

1. a `DATABASE_URL` de producao contem `sslmode=require` (ou mais estrito), ou
   `BANCO_SSL=true` esta definido;
2. `CRIPTOGRAFIA_CHAVE_AES_256` tem pelo menos 32 bytes;
3. nao existe nenhuma tentativa de contornar a verificacao: o modulo nao le
   nenhuma variavel capaz de desligar a validacao do certificado.

O Neon apresenta certificado emitido por CA publica, entao a cadeia fecha pelo
armazenamento padrao do Node e `BANCO_SSL_CA` nao deve ser necessario. Preencha
`BANCO_SSL_CA` (PEM inline) ou `BANCO_SSL_CA_ARQUIVO` — nunca as duas — apenas se
o banco usar CA propria. Se um pooler ou proxy atender por um hostname diferente
do nome do certificado, declare o nome esperado em `BANCO_SSL_SERVERNAME`.

Sintoma esperado de falha: o processo nao sobe e registra o motivo
(`TLS e obrigatorio...`, `sslmode ... e permissivo...`, `BANCO_SSL_CA ...`). E
falha fechada, nao incidente de banco. Nao existe atalho para "resolver"
aceitando qualquer certificado: essa opcao foi deliberadamente deixada de fora.
Se o certificado do banco nao fecha pela CA publica, declare a CA correta em
`BANCO_SSL_CA` ou `BANCO_SSL_CA_ARQUIVO`.

### Rotacao da chave de criptografia

O formato de cifra e versionado desde o PR 39: registros novos carregam versao e
key-id, registros antigos continuam legiveis no formato legado. A rotacao e
dual-read / new-write e nao exige operacao no banco.

1. Gerar a nova chave fora do repositorio, do chat e de qualquer log.
2. Definir `CRIPTOGRAFIA_CHAVE_AES_256_ANTERIOR` com o valor **atual**.
3. Substituir `CRIPTOGRAFIA_CHAVE_AES_256` pelo valor novo.
4. Reiniciar os processos `web` e `worker`. A leitura tenta a chave atual e
   depois a anterior; a escrita usa somente a atual.
5. Recriptografar os registros antigos por procedimento deliberado e autorizado.
   Nao existe job automatico para isso.
6. So depois do passo 5, remover `CRIPTOGRAFIA_CHAVE_AES_256_ANTERIOR`.

O boot recusa `CRIPTOGRAFIA_CHAVE_AES_256_ANTERIOR` igual a chave atual ou com
menos de 32 bytes. Nunca descarte a chave anterior antes do passo 5: sem ela os
registros ainda nao reescritos ficam ilegiveis.

Para separar o material do indice cego de busca por PII, defina
`CRIPTOGRAFIA_CHAVE_INDICE_HMAC` e execute
`pnpm --dir octaclin-backend backfill:indices-busca` na mesma janela, com aceite
humano e ambiente identificado. Sem o backfill a busca por PII fica
inconsistente. Enquanto a variavel nao existir, o indice continua derivado da
chave-base, exatamente como antes do PR 39.

### Sessoes e rotacao de refresh token (PR 40 da governanca)

O PR 40 troca o modelo de sessao. Antes de implantar, leia esta secao inteira:
a mudanca e intencionalmente incompativel com os tokens ja em circulacao.

**Ordem operacional obrigatoria**

1. Conferir e, se preciso, definir `JWT_SEGREDO` e `JWT_REFRESH_SEGREDO` no
   provider **antes** do deploy. A partir deste PR os dois sao exigidos tambem em
   staging, precisam de pelo menos 32 bytes e precisam ser diferentes entre si.
   Gerar os valores fora do repositorio e fora de qualquer chat; nao reaproveitar
   o mesmo valor nos dois. Se hoje so `JWT_SEGREDO` estiver configurado, o boot
   passa a falhar: nao existe mais heranca para o refresh.
2. Aplicar a migration `1720000001036-CriarSessoesUsuario` fora de banda, com a
   role owner, pelo procedimento da secao `BANCO_EXECUTAR_MIGRACOES em producao`.
   Ela e aditiva: cria `sessoes_usuario` com RLS forcada, adiciona `sessao_id` e
   `consumido_em` em `refresh_tokens` e nao altera nenhuma linha existente.
3. So entao implantar o codigo. A ordem inversa derruba o boot ou faz toda
   renovacao falhar.

**Consequencia esperada e aceita: todo mundo precisa entrar de novo.** Os tokens
antigos nao tem `tipo`, `sid`, `iss` nem `aud`; a verificacao nova os recusa, e o
refresh antigo tambem nao renova. Isso e falha fechada, nao incidente. Combinar a
janela e avisar a equipe. Nao existe modo de compatibilidade: aceitar o formato
antigo reabriria exatamente o que este PR fecha.

**O que passa a valer**

- Cada login abre uma sessao (familia de refresh tokens) com linha propria em
  `sessoes_usuario`.
- Cada refresh token e de uso unico. A rotacao e uma escrita condicional na mesma
  transacao; duas renovacoes concorrentes do mesmo token nao produzem dois
  descendentes validos.
- Reuso de token ja consumido ou revogado revoga a familia inteira, invalida os
  descendentes e registra `auth.sessao.reuso_detectado` na auditoria, sem token,
  hash ou material derivado. Uma corrida real de renovacao cai nesta mesma regra
  e encerra a sessao: o usuario entra de novo.
- `POST /auth/sair` passa a encerrar a sessao inteira, nao apenas o refresh
  apresentado.
- O guarda de access token consulta `sessoes_usuario` a cada requisicao
  autenticada. E o que faz uma revogacao feita por uma instancia derrubar, na
  outra, um access token que ainda nao expirou. Custo: uma leitura indexada por
  chave primaria por requisicao.

**Diagnostico rapido**

| Sintoma | Causa provavel |
| --- | --- |
| Boot falha com `JWT_REFRESH_SEGREDO e obrigatorio` | Variavel ausente no provider; antes era herdada de `JWT_SEGREDO` |
| Boot falha com `deve ser diferente de JWT_SEGREDO` | Os dois segredos tem o mesmo valor |
| Toda renovacao devolve 401 logo apos o deploy | Migration nao aplicada, ou tokens do formato antigo |
| Usuarios caem sozinhos em massa | `JWT_EMISSOR`/`JWT_AUDIENCIA` divergentes entre instancias |

**Rollback**

Reimplantar o commit anterior. A migration pode permanecer aplicada: as colunas
novas sao anulaveis e a versao antiga as ignora. Os tokens emitidos pela versao
nova deixam de ser aceitos pela antiga (falha fechada, sem perda de dado) e todos
entram de novo. Reverter a migration (`down`) so e necessario para desfazer o
schema, e derruba as sessoes gravadas; nao ha dado clinico envolvido.

### MFA e reautenticacao privilegiada (PR 41 da governanca)

O PR 41 depende da migration aditiva
`1720000001037-CriarMfaEReautenticacao`. Ela cria as tabelas
`mfa_fatores_usuario`, `mfa_codigos_recuperacao` e `mfa_desafios`, adiciona
`sessoes_usuario.mfa_verificado_em` e inclui o motivo de revogacao
`mfa_obrigatorio`.

**Ordem operacional obrigatoria**

1. Criar uma branch de backup no Neon do ambiente alvo.
2. Confirmar explicitamente projeto, branch, banco e role `neondb_owner`. Nao
   usar a role runtime para aplicar a migration.
3. Manter `BANCO_EXECUTAR_MIGRACOES=false` no servico.
4. Definir `DATABASE_URL` somente na sessao local e executar:

   ```powershell
   pnpm --dir octaclin-backend migration:run
   pnpm --dir octaclin-backend run typeorm -- migration:show
   Remove-Item Env:DATABASE_URL
   ```

   Se `migration:run` tentar aplicar qualquer migration anterior a 1037, parar
   e conferir o banco. O `Remove-Item` e obrigatorio.
5. Verificar a migration antes do deploy:

   ```sql
   select relname, relrowsecurity, relforcerowsecurity
   from pg_class
   where relname in ('mfa_fatores_usuario', 'mfa_codigos_recuperacao', 'mfa_desafios')
   order by relname;

   select tablename, policyname
   from pg_policies
   where tablename in ('mfa_fatores_usuario', 'mfa_codigos_recuperacao', 'mfa_desafios')
   order by tablename, policyname;

   select indexname
   from pg_indexes
   where tablename in ('mfa_fatores_usuario', 'mfa_codigos_recuperacao', 'mfa_desafios')
   order by indexname;

   select column_name
   from information_schema.columns
   where table_name = 'sessoes_usuario' and column_name = 'mfa_verificado_em';
   ```

   As tres linhas de `pg_class` precisam retornar `t | t`. As policies esperadas
   sao `isolamento_tenant_mfa_fatores_usuario`,
   `isolamento_tenant_mfa_codigos_recuperacao` e
   `isolamento_tenant_mfa_desafios`. Os indices parciais esperados sao
   `idx_mfa_desafios_validos` e `idx_mfa_codigos_disponiveis`, alem dos indices
   criados por PK/unique constraints.
6. Implantar backend e depois web.
7. Fazer smoke somente com conta sintetica privilegiada: enrolment, novo login
   TOTP, um recovery code, reautenticacao e revogacao de sessoes. Confirmar que
   a auditoria nao contem segredo, URI `otpauth`, codigo ou token.

**Rollback**

Reimplantar o commit anterior mantendo a migration aditiva. Nao executar
`migration:revert` nem o `down` automaticamente: depois do enrolment, o down
apaga fatores e codigos de recuperacao. Reverter o schema exige aceite humano,
backup confirmado e plano explicito para recuperar o acesso privilegiado.

### BANCO_EXECUTAR_MIGRACOES em producao

`migrationsRun` fica ligado somente quando `BANCO_EXECUTAR_MIGRACOES` e
literalmente `'true'`. Variavel ausente ou `'false'` mantem o boot sem DDL; outro
valor faz o backend falhar explicitamente na configuracao. Nunca configure `true`
nos runtimes de staging ou producao: a role de runtime
`octaclin_app_producao` **nao tem `CREATE` no schema `public`**. Com o comportamento
antigo, toda migration com DDL que chegava na `main` sem ter sido aplicada antes
derrubava o deploy:

```
Migration "<Nome><timestamp>" failed, error: permission denied for schema public
ERROR [TypeOrmModule] Unable to connect to the database.
```

O Render mantem a instancia anterior servindo quando o boot novo falha, entao
nao ha indisponibilidade — mas o deploy entra em loop de falha e o sintoma so
aparece no painel, nunca no CI.

**Recomendacao: definir `BANCO_EXECUTAR_MIGRACOES=false` em
`octaclin-backend-producao` e no runtime de staging.** A ausencia tambem e
segura, mas o valor explicito torna o inventario operacional auditavel. Todas as
secoes de rollout abaixo ja pressupõem isso. Com a variavel em `false`, deploy
deixa de depender de estado de banco e aplicar migration vira ato deliberado, na
ordem certa.

Se um runtime ainda usar a versao anterior do backend, **aplicar a migration fora
de banda com `neondb_owner` antes do merge**, e nao depois. Depois desta mudanca,
o mesmo procedimento continua obrigatorio para toda migration com DDL.

#### Declaracao obrigatoria em cada migration

Ate 2026-09-04 nada no CI dizia que uma PR carregava migration com DDL, e o
sintoma da omissao nunca aparece no CI -- ele aparece no painel do Render, como o
loop de falha acima. Foi assim duas vezes: a licao de 2026-08-22 em
`docs/agents/LESSONS_LEARNED.md` e a secao 9 do
`docs/governance/RELATORIO_SEGURANCA_PR52_FASE2_2026-09-03.md`.

Toda migration declara, no comentario da classe, como e aplicada:

```ts
/** @aplicacao fora-de-banda */
export class CriarAlgumaCoisa1720000001039 implements MigrationInterface {
```

| Valor | Quando usar | O que ele obriga |
| --- | --- | --- |
| `fora-de-banda` | a migration executa DDL: `create`/`alter`/`drop` de tabela, funcao, gatilho, indice, tipo, view, sequence, policy ou extensao | aplicar com a role owner antes do merge, pelo procedimento desta secao |
| `somente-dados` | a migration so le e escreve linhas (`select`, `insert`, `update`, `delete`) | nada alem do fluxo normal; a role de runtime daria conta |

`pnpm test:migracoes-fora-de-banda` reprova a migration sem declaracao, a
declaracao com valor desconhecido, duas declaracoes no mesmo arquivo e -- o caso
que importa -- a migration que declara `somente-dados` e executa DDL. A
classificacao **nao** e aceita como afirmacao: o gate a deriva do SQL do proprio
arquivo e compara com o que ele declara.

`pnpm audit:migracoes-fora-de-banda` lista o inventario sem reprovar nada.

Dois limites que precisam ser lidos junto:

- **O gate nao prova que a migration foi aplicada.** Isso e estado operacional,
  vive fora do Git e nao pode ser inferido do repositorio. Ele prova que houve
  classificacao e que ela nao contradiz o SQL. A prova de aplicacao continua
  sendo `migration:show` contra o banco alvo, na sessao em que voce confirmou o
  alvo.
- **O criterio e privilegio, e nao risco.** `create index` nao ameaca dado
  nenhum e mesmo assim exige owner. Uma lista escrita por risco perderia
  exatamente esse caso.

### Paridade entre integracao e producao

Antes de comecar qualquer rollout, comparar a contagem de migrations dos dois
bancos. Se o `migration:show` da integracao listar qualquer coisa alem da
migration da vez, parar e reconciliar primeiro: ensaiar sobre um schema
diferente do de producao nao prova o que o ensaio diz provar.

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

### Uploads e storage clinico (PR 44 da governanca)

Endurece o fluxo acima sem mudar bucket, credenciais nem a regra de lifecycle
ja configurada na Fase 200. Nenhuma migration; nenhuma variavel nova.

**Estados do arquivo** (`arquivos_midia.status`, inalterado):
`pendente` (aguardando confirmacao) → `confirmado` (validado e disponivel
para download) → `excluido` (removido, terminal). Um motivo de rejeicao
(`validacao_conteudo`, `imagem_invalida` ou `antimalware`) fica registrado em
`metadados.motivoRejeicao` quando a transicao para `excluido` acontece por
falha na confirmacao, para diferenciar de uma exclusao pedida pelo usuario.

**Quarentena e criterio de promocao:** o objeto so passa a existir na chave
`confirmados/...` depois que o backend copia o objeto pendente para ela — o
cliente nunca recebeu URL assinada para escrever nessa chave, entao a copia e
imutavel a partir desse momento. A inspecao (magic bytes, hash, tamanho e,
para imagem, dimensao/pixels e remocao de metadado) roda sobre essa copia
imutavel, nunca sobre o objeto pendente. So depois de toda a cadeia passar o
banco marca `confirmado`; um arquivo `pendente` nunca gera URL de download
utilizavel.

**Scanner antimalware:** `ServicoAntimalware` e um mecanismo de referencia,
nao um antivirus real — ele so reconhece a assinatura de teste padrao EICAR.
Timeout (5s) ou erro do mecanismo sempre rejeitam a confirmacao; nunca liberam
por omissao. Ligar um scanner real (ClamAV local ou equivalente) exige decisao
operacional e infraestrutura fora do escopo deste PR — quando isso acontecer,
substituir a implementacao de `MecanismoAntimalware` sem mudar quem a chama.

**Limites de imagem:** largura e altura ate 12000 px cada, e ate
100.000.000 de pixels totais (dimensao real, lida da propria estrutura do
arquivo — JPEG/PNG/WEBP — nunca do valor declarado pelo cliente). Acima disso,
ou se a estrutura do arquivo nao puder ser lida, a confirmacao e rejeitada.

**Formatos permitidos:** inalterados desde a Fase 200 —
`image/jpeg`, `image/png`, `image/webp` (imagem); `audio/mpeg`, `audio/mp4`,
`audio/ogg`, `audio/wav` (audio); `video/mp4`, `video/webm` (video);
`application/pdf` (documento). Nenhum formato novo foi habilitado.

**Metadado removido:** para imagem, GPS/EXIF, comentarios e texto embutido
(APPn/COM no JPEG; `tEXt`/`zTXt`/`iTXt`/`eXIf`/`tIME` no PNG; `EXIF`/`XMP ` no
WEBP). Os pixels nao sao decodificados nem recodificados — so os blocos de
metadado sao removidos. Quando ha remocao, o objeto confirmado e reescrito
com o conteudo sanitizado e o hash persistido passa a ser o do conteudo
sanitizado, nunca o original.

**Hash:** SHA-256, sempre calculado pelo backend sobre o conteudo final
(apos eventual sanitizacao de imagem), nunca sobre o valor declarado pelo
cliente.

**Object key:** inalterado — `pendentes/{tenantId}/{pacienteId}/{tipo}/{uuid}`
e depois `confirmados/{tenantId}/{pacienteId}/{tipo}/{arquivoId}`. Sempre
gerado no backend; o cliente nunca escolhe bucket nem key.

**Download:** exige `status === 'confirmado'` e a mesma cadeia de
autorizacao por tenant/carteira/paciente da Fase 200, inalterada.

**Exclusao:** os dois fluxos de exclusao direta e permanente de arquivo
(`ServicoMobile.excluirArquivoMidia` e `ServicoEvolucoesFotograficas.excluir`)
so marcam o registro como `excluido` depois que um HEAD subsequente ao
DELETE confirma que o objeto deixou de existir no storage — nao basta o
DELETE retornar sucesso. Se o Backblaze B2 real nomear o erro de "objeto nao
encontrado" de forma diferente do modelado pelo SDK AWS (`NotFound`/
`NoSuchKey`/404 HTTP), a exclusao passa a ser recusada mesmo quando funcionou
de fato — validar esse comportamento em staging antes de depender dele em
producao; a falha e sempre no sentido seguro (nunca marca como excluido por
engano).

**Lifecycle:** a regra de 1 dia sobre `pendentes/` da Fase 200 continua
correta sem alteracao — este PR nao muda em qual prefixo os objetos pendentes
ficam, so a ordem entre promocao e inspecao.

**Rollback:** reverter o deploy. Sem migration, sem dado a reverter; a versao
anterior continua lendo qualquer arquivo ja confirmado normalmente.

Depois do deploy, validar com arquivo sintetico: solicitar URL, enviar,
confirmar (observar o log de auditoria `mobile.midia.upload_confirmar`),
abrir, excluir (observar `mobile.midia.excluir`) e confirmar no provedor que
o objeto foi removido. Para provar a rejeicao sem usar malware real, um
arquivo cujo conteudo seja a assinatura de teste EICAR deve ser recusado na
confirmacao com o log de auditoria `mobile.midia.upload_rejeitado`.

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

### Agenda publica segura (Fase 253)

O codigo da Fase 253 depende da migration aditiva
`ProtegerResolucaoAgendaPublica1720000001034`. Ela cria ou substitui apenas a
funcao `resolver_agenda_link_publico`, sem alterar dados nem desligar RLS. Como
`BANCO_EXECUTAR_MIGRACOES=false`, aplicar a migration antes do merge/deploy.

Confirmar explicitamente projeto, branch, banco `Octaclin-db-producao` e role
`neondb_owner`. Interromper se `migration:show` apontar qualquer pendencia alem
da `1034`.

```powershell
$url = '<URL owner de producao confirmada>'
try {
  $env:DATABASE_URL = $url
  pnpm --dir octaclin-backend run typeorm -- migration:show
  pnpm --dir octaclin-backend migration:run
  pnpm --dir octaclin-backend run typeorm -- migration:show
} finally {
  Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
  $url = $null
}
```

Verificar no SQL Editor, sem registrar token real:

```sql
select p.prosecdef, p.proconfig, pg_get_function_result(p.oid)
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname = 'resolver_agenda_link_publico';

select relrowsecurity, relforcerowsecurity
  from pg_class
 where relname = 'agenda_links_publicos';

select count(*)
  from resolver_agenda_link_publico(repeat('0', 64)::char(64));
```

Esperado: `prosecdef=true`, `search_path=public, pg_temp`, retorno limitado a
tenant/profissional/duracao, RLS e FORCE RLS verdadeiros e zero linha para o
hash sintetico. Em falha, nao executar `down` ou `migration:revert`; remover a
`DATABASE_URL` e diagnosticar antes do deploy.

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

### Aplicar a migration 1720000001038 (PR 52 da governanca, fase 2)

**Esta migration e DDL e nao sobe pelo deploy.** Ela cria a funcao de trigger
`rejeitar_mutacao_trilha_auditoria()` no schema `public`, e a role de runtime
nao tem `CREATE` ali -- de proposito, pelo PR 51. Se o runtime tentar aplica-la,
o boot falha com exatamente esta linha:

```
Migration "TornarTrilhaAuditoriaImutavel1720000001038" failed, error: permission denied for schema public
```

Isso **e o controle funcionando**, e nao defeito da migration. O Render mantem a
instancia anterior servindo, entao nao ha indisponibilidade -- o deploy entra em
loop de falha e o sintoma so aparece no painel. Nao "resolva" concedendo
`CREATE` a role de runtime: isso desfaz a separacao owner/runtime do PR 51, e
`ServicoMenorPrivilegioProviders` passa a reportar `violado`.

A ordem e **staging primeiro, producao depois**, e dentro de cada ambiente a
migration vem **antes** do deploy do codigo.

#### Etapa 1 -- confirmar que o runtime nao vai tentar aplicar

Em **cada** servico (staging e producao), confirmar
`BANCO_EXECUTAR_MIGRACOES=false` ou ausente. Se algum estiver `true`, corrigir
antes de qualquer outra coisa: enquanto estiver `true`, todo deploy novo entra
em loop de falha.

#### Etapa 2 -- staging: backup, migration, verificacao

1. Criar branch de backup no Neon de staging.
2. Confirmar projeto, branch, banco e role `neondb_owner` **de staging**.

```powershell
$url = '<URL owner do banco de STAGING confirmada>'
try {
  $env:DATABASE_URL = $url
  pnpm --dir octaclin-backend run typeorm -- migration:show
  # Parar se alguma migration alem da 1038 estiver pendente.
  pnpm --dir octaclin-backend migration:run
  pnpm --dir octaclin-backend run typeorm -- migration:show
} finally {
  Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
  $url = $null
}
```

3. Verificar o catalogo no SQL Editor do banco de staging:

```sql
select tgname, tgenabled
from pg_trigger
where tgrelid = 'user_action_logs'::regclass and not tgisinternal
order by tgname;
```

Esperado: `trg_trilha_auditoria_append_only` e
`trg_trilha_auditoria_sem_truncate`, os dois com `tgenabled = 'A'`. Qualquer
outro valor -- `'O'`, `'D'` ou ausencia -- significa que o controle nao esta
ativo.

4. Provar o comportamento, e nao so a existencia do gatilho:

```sql
begin;
update user_action_logs set acao = acao where id = (select id from user_action_logs limit 1);
rollback;
```

Esperado: `ERROR: user_action_logs e append-only: UPDATE rejeitado pela trilha
de auditoria.` com `SQLSTATE 42501`.

**O `begin`/`rollback` nao e zelo excessivo, e a razao inteira do teste.** Se o
gatilho estiver ausente, o `update` **funciona** e altera uma linha real de uma
tabela que nao admite correcao. A transacao existe para conter exatamente o caso
em que o controle falhou. Nao rode esta consulta sem ela.

Esta e a primeira prova em banco real da EXC-AUD-003 -- vale mais que o job de
testcontainers, porque exercita o Postgres do provedor.

#### Etapa 3 -- staging: deploy e validacao funcional

Deploy do codigo em staging e, depois:

```powershell
curl https://<backend-staging>/health/pronto
curl https://<backend-staging>/health/detalhado
```

`/health/pronto` deve responder `200`; `503` indica migration pendente ou banco
indisponivel. Em `/health/detalhado`, conferir que `checks.banco.mensagem` traz
vocabulario fechado, e nao mensagem de driver.

Depois, um login real no tenant de staging: ele grava `auth.login.sucesso`, o que
prova que **`INSERT` continua livre** com os gatilhos ativos -- o risco real
desta migration nao e ela barrar demais no papel, e sim barrar a propria escrita
legitima da trilha. Repetir o login dentro de 60 s para exercitar o teto: a
segunda vez nao deve gerar linha nova, e a terceira linha da mesma chave deve
trazer `loginsSuprimidos`.

#### Etapa 4 -- producao: mesma sequencia, janela deliberada

Repetir as etapas 2 e 3 contra o banco e o servico de producao, com
`neondb_owner` de producao e branch de backup propria. Confirmar o alvo de novo:
a URL de staging e a de producao diferem por poucos caracteres, e o erro nao e
reversivel do lado da trilha.

Antes de comecar, comparar `migration:show` dos dois bancos. Se staging listar
qualquer coisa que producao nao liste (ou o contrario), parar e reconciliar:
ensaiar sobre um schema diferente do de producao nao prova o que o ensaio diz
provar.

Em producao, **nao** inserir linha sintetica na trilha para testar. A consulta de
`update` da etapa 2 continua segura porque e rejeitada e esta dentro de
`begin`/`rollback`.

**Antes do deploy do web de producao**, conferir que o servico tem
`OCTACLIN_BACKEND_URL` e `OCTACLIN_TENANT_SLUG` definidas, e que
`OCTACLIN_API_ORIGENS_PERMITIDAS` contem exatamente a origem da primeira (sem
caminho e sem barra final). Em staging as duas estavam ausentes e o login
respondia "O servico de acesso do OctaClin esta configurado incorretamente",
enquanto as rotas publicas seguiam funcionando pelo fallback legado
`NEXT_PUBLIC_API_URL` -- entao a ausencia nao aparece em teste de rota publica
nem no `/health`.

#### Rollback

O `down()` derruba os dois gatilhos e a funcao e devolve `update, delete` as
roles nomeadas. Ele tambem exige `neondb_owner` e nao remove dado nenhum:
reverter o controle nao reverte a trilha.

### Trilha de auditoria append-only (PR 52 da governanca, fase 2)

A migracao `1720000001038-TornarTrilhaAuditoriaImutavel` faz o banco **rejeitar**
`UPDATE`, `DELETE` e `TRUNCATE` em `user_action_logs`. Isso e controle de
integridade da evidencia, e nao preferencia de estilo: ver
`docs/governance/POLITICA_TRILHA_AUDITORIA_E_REDACAO.md` secao 5.1.

**Como verificar que o controle esta ativo** (leitura, seguro em producao):

```sql
select tgname, tgenabled
from pg_trigger
where tgrelid = 'user_action_logs'::regclass and not tgisinternal;
```

Esperado: dois gatilhos, os dois com `tgenabled = 'A'` (`ENABLE ALWAYS`). `'O'`,
`'D'` ou ausencia significa que o controle caiu -- trate como incidente de
integridade, nao como divergencia de schema.

**O que muda no dia a dia:**

- Erro `42501` ao tentar alterar a trilha **e o comportamento correto**. Nao
  contorne desabilitando o gatilho.
- Correcao de linha errada na trilha nao existe. A trilha registra o que
  aconteceu, inclusive o que aconteceu errado; a correcao e um evento novo.
- **Pedido de eliminacao LGPD nao se resolve por `DELETE` na trilha.** O que
  mantem dado pessoal fora dela e a redacao de `metadados` aplicada na escrita.
  Se, ainda assim, uma linha precisar ser removida, isso exige decisao
  registrada de incidente ou juridica, role administrativa e desabilitacao
  temporaria do gatilho -- procedimento fora de banda, com dois responsaveis,
  registro da janela fora do Git e reativacao verificada pela consulta acima.
  A janela e registrada **antes** de o gatilho cair, e nao depois: desabilita-lo
  derruba `tgenabled` de `'A'`, que e o proprio sinal de incidente de
  integridade da secao "Incidente de auditoria e seguranca" -- sem o registro
  previo, a operacao legitima fica indistinguivel do ataque para quem ler o
  catalogo. **Com um unico responsavel, este procedimento nao e executavel**;
  ver "Escalonamento" naquela secao.
- Restore nao e afetado: `pg_restore` faz `INSERT`/`COPY`, e os gatilhos sao
  `ENABLE ALWAYS` justamente para nao dependerem de `session_replication_role`.

**Limites conhecidos**, registrados como EXC-AUD-008 na norma: o controle nao
protege contra o administrador do banco (`drop trigger` e possivel), nao ha
hash-chain -- ele impede a mutacao por SQL, nao prova ausencia de adulteracao --
e nao ha retencao WORM no armazenamento de backup.

## Redis e filas

Fornecedor: Redis gerenciado, definido por `REDIS_URL` no Render. A conta foi
trocada em 2026-08-22 apos estouro de cota; ver "Troca de provedor ou conta"
abaixo.

Usos:

- filas/outbox;
- cache quando aplicavel;
- processamento de comunicacoes.

Sinais de problema:

- comunicacoes nao processam;
- outbox cresce;
- timeouts no backend;
- erros de conexao Redis nos logs;
- `redis` em `falha` no `/health/detalhado`.

Acao:

1. Verificar `REDIS_URL`.
2. Verificar status e **cota de comandos** no painel do provedor.
3. Validar logs do backend.
4. Reprocessar outbox quando disponivel.

### Custo de comando com fila vazia

Em 2026-08-22 a cota gratuita de 500 mil comandos por mes estourou com consumo
de 1,2 a 1,5 milhao, **sem nenhum cliente em producao**. O consumo nao era uso,
era espera: os workers BullMQ usavam os defaults `drainDelay: 5` e
`stalledInterval: 30000`, entao cada worker ocioso reemitia o comando bloqueante
a cada 5 segundos — cerca de 52 mil comandos por dia com tres workers.

Os valores vivem em
`octaclin-backend/src/infraestrutura/processamento/opcoes-worker-bullmq.ts`,
com o calculo no comentario. Nao "limpar" esses numeros sem refazer a conta.

As opcoes precisam ir no segundo argumento de `@Processor`. `BullModule.forRoot`
recebe `BullRootModuleOptions`, que estende `Bull.QueueOptions` e **nao** aceita
opcao de worker: configurar la e ignorado em silencio.

Para verificar se um deploy pegou o ajuste, medir comandos por minuto no painel
do provedor com o sistema parado: cerca de 3 por minuto indica ajuste ativo,
cerca de 36 indica que ainda esta com os defaults.

### Troca de provedor ou conta

Requisitos do provedor, impostos pelo BullMQ:

- `maxmemory-policy` **precisa** ser `noeviction`. Outra politica faz o Redis
  descartar chave sozinho, e no BullMQ isso e job sumindo em silencio.
- Redis 6.2 ou maior. Valkey e Dragonfly sao compativeis.

Passos:

1. Criar a instancia e confirmar os dois requisitos acima.
2. Preferir janela de baixo movimento: filas em memoria se perdem na troca. As
   comunicacoes ficam persistidas no Postgres e sao reenfileiradas pelo
   `processador-outbox-comunicacoes`, entao a perda e recuperavel — confirmar
   depois que o outbox drenou.
3. Trocar `REDIS_URL` somente em `octaclin-backend-producao`. Producao roda com
   `OCTACLIN_PROCESSO=all` e nao ha worker dedicado a atualizar.
4. Aguardar o restart e conferir `redis` em `ok` no `/health/detalhado`.
5. Disparar o monitor de producao.

Cobranca por comando pune processo ocioso; cobranca por instancia, nao. Levar
isso em conta na escolha.

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

1. Antes do deploy, confirmar no backend do Render
   `META_WHATSAPP_WEBHOOK_VERIFY_TOKEN` e `META_WHATSAPP_APP_SECRET` com no
   minimo 32 bytes. Nao registrar os valores.
2. Enviar mensagem para o numero Meta.
3. Conferir webhook no backend.
4. Confirmar conversa na inbox.
5. Associar contato a paciente quando necessario.

O bootstrap de producao falha fechado quando a integracao Meta esta
parcialmente configurada. O POST exige `application/json`, assinatura
`X-Hub-Signature-256` sobre o corpo bruto e timestamp dentro da janela de
validade. Reentrega identica e reconhecida sem repetir efeitos.

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

- `checks.redis`: valida se o Redis esta configurado.
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
- deploy: metadados de release ausentes em producao;
- falha de gravacao da trilha de auditoria: contador do processo, `critico` a
  partir da primeira falha (PR 52 da governanca, fase 3);
- volume de negativa de autorizacao: contador do processo, `atencao` a partir de
  50 e `critico` a partir de 500 (PR 52 da governanca, fase 3).

As duas ultimas fontes sao do **processo que respondeu**, e nao do tenant que
abriu o painel -- como as de health e de deploy. Nao atribua o numero ao proprio
tenant.

Fluxo de resposta:

1. Abrir `/operacoes` e revisar alertas criticos primeiro.
2. Se houver alerta de health, validar `/health/detalhado`.
3. Se houver alerta de outbox, conferir Redis, worker/processador e central de falhas.
4. Se houver alerta de integracao, seguir o runbook especifico do provedor.
5. Se houver alerta de trilha ou de negativa de autorizacao, **parar aqui** e
   seguir `## Incidentes` -> "Incidente de auditoria e seguranca": o primeiro
   passo la e nao reiniciar o processo, e um deploy no meio apaga a medida.
6. Usar `requestId` dos logs da Fase 124 quando houver erro em uma requisicao especifica.

### Teste de alerta da trilha de auditoria (PR 52 da governanca, fase 3)

Dois alertas desta fase tornam visivel o que antes so existia em log: a **falha
de gravacao da trilha de auditoria** e o **volume de negativa de autorizacao**.
Este procedimento prova que eles disparam.

A dificuldade e propria deste par: **provar que o alerta dispara exige produzir
justamente o evento que ele existe para denunciar**. Falha de gravacao significa
trilha parada; volume de negativa significa linha nova numa tabela que e
append-only desde a migracao `1720000001038`. Nenhum dos dois pode ser fabricado
em producao sem estragar a evidencia que o alerta protege. Por isso o
procedimento e partido, e a divisao nao e conveniencia:

| Ambiente | O que se prova ali | Como |
| --- | --- | --- |
| Banco descartavel (container local ou branch efemera) | que o alerta aparece, com a severidade e o conteudo esperados | provocando a condicao |
| Staging | somente o alerta de negativa de autorizacao, com tenant e usuario sinteticos | provocando a condicao, e aceitando que as linhas ficam |
| Producao | que o alerta esta ausente **agora** e que o painel foi gerado agora | somente leitura |

A regra ja escrita na etapa 4 de "Aplicar a migration 1720000001038" continua
valendo sem excecao: **em producao, nao inserir linha sintetica na trilha para
testar.** Ela e append-only e entra em backup -- uma linha sintetica inserida em
producao e permanente.

#### Alerta de falha de gravacao da trilha

**Comportamento.** A fonte e o contador de falhas de gravacao de
`ServicoAuditoria`: por processo, em variavel de modulo, monotonico, e zera
somente no restart -- ver `docs/governance/POLITICA_TRILHA_AUDITORIA_E_REDACAO.md`
secao 7. O alerta aparece em `/operacoes`, na secao `Alertas operacionais`, a
partir da **primeira** falha, com severidade `critico` e sem degrau abaixo dela:
uma falha ja significa que existiu acesso sem registro, e nao ha volume de perda
de evidencia que seja aceitavel.

O limiar e o **total acumulado desde o boot**, e nao um delta por janela. A razao
e do mecanismo: o painel e aberto sob demanda por uma pessoa, entao nao existe
janela de leitura confiavel, e um "delta desde a ultima leitura" seria corrompido
pelo segundo leitor -- dois operadores abrindo `/operacoes` roubariam o delta um
do outro e o segundo veria zero. Em troca, o alerta fica **aceso ate o proximo
restart** depois de uma falha isolada. E deliberado: a evidencia perdida nao
volta a existir depois de uma janela de calmaria. A compensacao esta no payload,
que traz `total`, `uptimeSegundos`, `porHora` e o proprio limiar em `referencia`,
para que a conta possa ser refeita e um blip no boot possa ser separado de uma
trilha parada -- sem que a **deteccao** dependa dessa distincao.

O que ele **nao** carrega, de proposito: mensagem crua do erro, `metadados` do
call site e identificador de paciente. A mensagem de um erro de banco carrega
SQL, valor de parametro e as vezes host ou credencial; publicar isso no painel
seria vazar pelo alerta exatamente o que a redacao acabou de tirar da trilha.
Somente o nome da classe do erro chega ao log `auditoria.falha`.

**Prova em banco descartavel** -- nunca em staging, nunca em producao:

1. Subir o backend contra um banco descartavel e confirmar o alvo na mesma
   sessao com `select current_database();`.
2. Provocar a falha por um caminho que **nao** altere a trilha:

```sql
alter table user_action_logs rename to user_action_logs_teste_alerta;
```

   Renomear e preferivel a `REVOKE`: `REVOKE` contra o dono da tabela nao tem
   efeito nenhum, e o mesmo raciocinio que fez o `REVOKE` da `1038` ficar como
   reforco vale aqui. Derrubar o banco inteiro tambem nao serve -- levaria junto
   o `/operacoes`, que precisa do banco para exibir o alerta.
3. Executar **uma** acao auditada (um login). Uma so basta: o limiar e 1. A
   aplicacao continua respondendo, porque `ServicoAuditoria.registrar` engole o
   erro de gravacao por contrato -- e e exatamente esse silencio que o alerta
   existe para quebrar.
4. Abrir `/operacoes` e conferir o alerta: severidade, `metrica`, `valor` e que a
   mensagem usa vocabulario fechado, sem texto de driver.
5. Desfazer o rename, reiniciar o processo e confirmar que o alerta some. O
   contador zera no restart -- e por isso que o passo 5 nao prova recuperacao,
   so prova que o alerta acompanha o contador.
6. Descartar o banco.

**Em producao, somente leitura:**

1. Abrir `/operacoes` e registrar `geradoEm` junto com a ausencia do alerta.
   "Nao vi alerta" sem o horario de geracao nao e leitura, e sim lembranca.
2. Procurar `auditoria.falha` nos logs do backend no Render, na janela de
   interesse.
3. **Limite que precisa ser lido junto:** o contador e por processo, e
   `/operacoes` responde por uma instancia. Com mais de uma replica, "alerta
   ausente" prova a instancia que respondeu, e nao o servico. E a mesma limitacao
   por processo que a norma registra para a janela de deduplicacao e para o teto
   de login.
4. Nao provocar a falha. Renomear, revogar ou derrubar a tabela em producao
   pararia a trilha de verdade: o dano e o proprio evento.

#### Alerta de volume de negativa de autorizacao

**Comportamento.** A fonte **nao** e a trilha: e um contador por processo, em
variavel de modulo, monotonico desde o boot, incrementado na primeira instrucao
de `registrarAutorizacaoNegada`. O alerta aparece em `/operacoes` como `atencao`
a partir de **50** e como `critico` a partir de **500**, e cada um desses dois
limiares e avaliado contra duas grandezas: o **total** acumulado desde o boot e a
**taxa por hora** de uptime do processo. A taxa so vale depois de **15 minutos**
de uptime -- abaixo disso ela e instavel (13 eventos nos primeiros 10 s dariam
4.680/h e todo boot viraria alarme) e so o total decide. O payload traz
`total`, `uptimeSegundos`, `porHora` e os dois limiares em `referencia`.

O 500 nao foi escolhido no codigo do alerta: e a magnitude que a propria secao
6.2 da politica usa para descrever enumeracao ("sondar 500 pacientes
distintos"). O 50 e uma ordem de grandeza abaixo, o ponto em que "alguem esbarrou
numa rota proibida" deixa de explicar o volume. **Nao existe linha de base medida
em producao**: os dois numeros sao escolha, e nao medida, e este e o primeiro
item a rever quando houver base.

**O que ele conta, e por que isso diverge da trilha.** O contador mede **negativa
observada**, e nao linha gravada: o incremento acontece **antes** da janela de
deduplicacao da secao 6.2 e antes da checagem de tenant. A consequencia pratica
importa na triagem, porque as duas fontes vao discordar de proposito:

- Quem varre muitos alvos distintos aparece nos dois lugares: no contador e como
  uma linha por alvo na trilha.
- Quem martela **um** alvo aparece inteiro no contador e como cerca de **uma
  linha por minuto** na trilha, porque a janela colapsa as repeticoes. O alerta
  detecta esse caso; a trilha, sozinha, nao o dimensiona.
- Uma negativa sem tenant resolvido conta no alerta e **nao** existe na trilha.

Portanto: **contador maior que o numero de linhas nao e defeito de nenhum dos
dois**. A trilha guarda o que aconteceu com quem e onde; o contador guarda quanto
aconteceu. Ler um como conferencia do outro leva a conclusao errada nas duas
direcoes.

Alvo que nao e UUID canonico nunca entra na trilha: a linha recebe `alvoOpaco` e
o valor fica so na chave de deduplicacao (politica, secao 6.2). Numa
investigacao, **ausencia do alvo nao e ausencia de enumeracao**.

**Prova em banco descartavel ou em staging:**

1. Criar usuario sintetico de papel restrito, em tenant sintetico.
2. Chamar rota proibida **50 vezes** para chegar a `atencao`, ou 500 para chegar
   a `critico`. Use alvos UUID **distintos**: para o contador tanto faz -- ele
   conta antes da dedup --, mas alvos distintos produzem linha por alvo na
   trilha, e e o que permite conferir os dois lados no passo seguinte. Com alvo
   repetido o alerta sobe e a trilha guarda uma linha, e o exercicio deixa de
   mostrar a divergencia que a triagem precisa conhecer.
3. Abrir `/operacoes` e conferir o alerta: severidade, `valor` e a conta em
   `referencia`. Conferir a trilha em seguida e registrar a diferenca entre o
   contador e o numero de linhas.
4. Em staging, registrar que **as linhas ficam**: a trilha de staging tambem e
   append-only desde a `1038`, e nao ha limpeza posterior. Por isso tenant,
   usuario e alvos precisam ser sinteticos desde o primeiro passo.

**Em producao, somente leitura.** O console nao tem tela da trilha; a rota do
BFF e o caminho executavel, com sessao SuperAdmin autenticada no navegador:

```
GET /api/operacoes/auditoria/paginada?acao=auth.autorizacao.negada&inicio=<ISO>&fim=<ISO>&limite=50
```

Ela nao gera evento de auditoria. A exportacao CSV gera, e por isso ela e para
extrair artefato de evidencia, e nao para conferir volume -- ver "Preservacao de
evidencia" em `## Incidentes`.

#### Registro e limites do proprio teste

Registrar data, ambiente, alerta exercitado, quem executou e resultado. Host,
tenant e identificador ficam **fora do Git**; no repositorio entra apenas o
resultado sanitizado, no relatorio do ciclo em `docs/governance/`.

Este procedimento prova o **caminho operacional**: que a condicao produz alerta
visivel no painel, com o conteudo certo e sem o conteudo errado. Ele nao prova a
logica do alerta, que e coberta pelos testes automatizados do proprio codigo. Um
procedimento manual verde nao substitui gate, e nao deve ser citado como se
substituisse.

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

### Rollout interno e feature flags da Fase 242

1. Abrir `/operacoes`, selecionar `Rollout` e atualizar o snapshot.
2. Confirmar commit, ambiente e papel de processo esperados.
3. Conferir health e filas de notificacoes, Google Calendar e automacoes.
4. Aguardar ao menos 50 requisicoes representativas antes de promover um
   release pelo avaliador offline.
5. Manter duas leituras saudaveis separadas por pelo menos cinco minutos.

Limiar de `rollback`: health em falha, fila indisponivel/pausada ou taxa de 5xx
maior ou igual a 5%. Limiar de `observar`: health degradado, 5xx a partir de
1%, p95 acima de 1.500 ms, mais de 100 itens esperando/atrasados, falha
historica retida ou JSON de flags invalido. Falhas historicas do BullMQ exigem
triagem e nao provam isoladamente regressao do release atual.

Para um defeito restrito a IA ou sincronizacao mobile, o SuperAdmin pode
desabilitar a flag do tenant no mesmo painel antes de decidir rollback de
codigo. Alteracoes sao auditadas. As flags conhecidas sao `ia.clinica` e
`mobile.sync`; ambas ficam desabilitadas na ausencia de configuracao.

Para avaliar um snapshot sanitizado fora da aplicacao:

```powershell
node scripts/rollout-seguro.mjs .\snapshot-rollout.json
```

O arquivo aceita somente health e contadores documentados pelo script. Nao
salvar nele traces, emails, IDs de pacientes, corpos HTTP ou credenciais.

Rollback de codigo usa o ultimo deploy saudavel no Render. Nunca executar
`migration:revert`, `down`, restore sobre producao, `FLUSHDB` ou `FLUSHALL` para
corrigir uma regressao de aplicacao. Depois do rollback, repetir health e
snapshot duas vezes antes de declarar recuperacao.

A telemetria e limitada e local a cada processo; reiniciar o backend zera a
amostra. Nao escalar para multiplas instancias ate adotar agregacao externa ou
distribuida que preserve os mesmos limites de privacidade.

### Ativacao controlada da IA clinica

1. Criar um segredo aleatorio dedicado, com pelo menos 32 caracteres.
2. Configurar `IA_SERVICE_TOKEN` com o mesmo valor no backend e no servico IA;
   configurar `IA_SERVICE_URL` somente no backend e manter o timeout padrao.
3. Confirmar `/health` publico no servico IA e confirmar que um POST sem token
   retorna `401`, sem corpo clinico nos logs.
4. Manter `ia.clinica` desabilitada e validar com dados sinteticos: profissional
   proprio, SuperAdmin, midia confirmada, cache concorrente e revisao humana.
5. Habilitar a flag somente no tenant piloto, observar o painel Rollout e
   desabilitar imediatamente em caso de 5xx, timeout, fila degradada ou resposta
   de contrato invalida.

`Collaborator` nao acessa IA clinica. O reconhecimento aceita somente arquivo
privado confirmado e vinculado ao mesmo tenant/paciente; o backend gera a URL
assinada. Nunca inserir URL assinada, hash de arquivo ou texto clinico em logs.

## Incidentes

Para atendimento operacional detalhado de login, convites, recuperacao de senha, WhatsApp, email e agenda, use `RUNBOOK_SUPORTE.md`. As secoes de falha de produto abaixo sao apenas o resumo de resposta rapida.

Incidente de auditoria e seguranca tem procedimento proprio, na primeira subsecao: ele nao e resumo, e nao cabe no fluxo de suporte.

### Incidente de auditoria e seguranca (PR 52 da governanca, fase 3)

Aqui o que esta em risco e a **evidencia**, e nao a disponibilidade. Um
incidente de auditoria acontece com o sistema inteiro respondendo `200`, e e por
isso que ele precisa de deteccao propria -- ninguem liga para o suporte dizendo
que a trilha parou de gravar.

A norma esta em `docs/governance/POLITICA_TRILHA_AUDITORIA_E_REDACAO.md`. Esta
secao e o procedimento, e nao repete a norma.

#### Deteccao

| Sinal | Onde aparece | Piso de risco | Primeira acao |
| --- | --- | --- | --- |
| Alerta de falha de gravacao da trilha | `/operacoes`, `Alertas operacionais` | R4 | **nao reiniciar nem publicar deploy**; ler e registrar o contador antes de qualquer coisa |
| Alerta de volume de negativa de autorizacao | `/operacoes`, `Alertas operacionais` | R4 | identificar tenant, usuario e rota antes de mexer em papel ou permissao |
| `auditoria.falha` recorrente no log do backend | Render | R4 | mesmo caminho da primeira linha |
| `42501` fora do procedimento previsto | log do backend, saida de sessao SQL | R5 | alguem tentou mutar a trilha; preservar horario, origem e sessao |
| `pg_trigger.tgenabled` diferente de `'A'`, ou gatilho ausente | consulta de catalogo | R5 | o controle de imutabilidade caiu; tratar como integridade, e nao como divergencia de schema |
| Issue `[Alerta producao] Saude externa indisponivel` | GitHub, monitor externo | R3 | health primeiro; so vira incidente de auditoria se a trilha for a causa |
| Credencial ou dado sensivel em resposta de `/health/detalhado` | validacao pos-deploy | R5 | seguir `RUNBOOK_ROTACAO_SECRETS.md` |

Sobre `42501`: ele e **esperado** em dois lugares, e so nesses dois. No teste de
`update` dentro de `begin`/`rollback` do procedimento da migration `1038`, e nos
casos de imutabilidade da suite de Testcontainers. Em qualquer outro lugar ele
significa que um caminho tentou alterar a trilha, e e isso o incidente -- nao a
mensagem de erro em si.

#### Triagem e classificacao

Use `R0-R5` como o `AGENTS.md` define; nao ha escala nova aqui. O piso e o que
ja esta escrito la: trilha de auditoria, autorizacao, tenancy, PHI/PII e
producao sao **no minimo R4**.

A severidade do alerta (`critico`, `atencao`, `informativo`, como definidas em
`## Alertas operacionais`) e o **gatilho**; o risco `R` e a **classificacao**, e
ela nao desce abaixo de R4 quando o eixo for a trilha ou a autorizacao, ainda
que o alerta tenha chegado como `atencao`. O contrario tambem vale: um alerta
`critico` de integracao opcional nao vira R4 pela cor.

Tres perguntas resolvem a classificacao, nesta ordem:

1. **A trilha parou de gravar?** Se sim, existe um intervalo sem evidencia, e
   ele **nao e recuperavel**. R4, e o intervalo passa a ser item obrigatorio do
   encerramento.
2. **Alguem tentou alterar a trilha, ou o controle que a protege?** R5. Inclui
   `42501` inesperado, `tgenabled` fora de `'A'` e gatilho ausente.
3. **Ha suspeita de credencial valida em uso indevido?** R5, e o eixo do
   incidente passa a ser contencao antes de investigacao.

Para prazo de primeira resposta e criterio `P0-P3`, use `SLA_SUPORTE.md` e a
secao `## Escalonamento` do `RUNBOOK_SUPORTE.md`; suspeita de vazamento ou perda
de dados ja e `P0` la. Nao ha segundo criterio de prazo neste runbook.

#### Escalonamento

Hoje o OctaClin tem **um** responsavel: o proprietario. Este runbook nao
descreve plantao, rodizio nem segunda linha, porque nenhum dos tres existe -- e
um procedimento que aciona um time inexistente falha exatamente na hora em que
seria usado.

O que existe, e o que isso muda:

1. Quem detecta e quem responde e a mesma pessoa. Nao ha handoff a esperar; ha
   ordem a seguir, e a ordem e a unica defesa contra a pressa.
2. Nao ha revisor independente dentro da janela. A compensacao e o registro
   escrito: **toda acao irreversivel e escrita antes de ser executada**, com o
   alvo confirmado na mesma sessao (`select current_database();` antes de
   qualquer consulta de catalogo, pelo mesmo motivo da etapa 4 de "Aplicar a
   migration 1720000001038").
3. A exigencia de **dois responsaveis** que a secao "Trilha de auditoria
   append-only" impoe para remover linha da trilha nao e satisfeita por uma
   pessoa. Enquanto nao houver segundo responsavel, essa operacao **nao e
   executavel**, e nao ha atalho -- ver "Preservacao de evidencia" abaixo.
4. Quando o incidente envolver terceiro (provedor, titular de dados ou
   pesquisador externo), o canal e o do `SECURITY.md`, e nao issue publica.

#### Contencao de credencial suspeita

Antes de investigar, saber o que e possivel fazer. Este e o estado real hoje, e
ele limita o procedimento:

- **Nao existe endpoint operacional para revogar a sessao de outro usuario.** As
  rotas de `/auth/sessoes` agem sempre sobre as sessoes de quem chamou. Nao ha
  caminho de SuperAdmin para derrubar a sessao de terceiro.
- **Redefinicao de senha revoga todas as sessoes do usuario**, mas depende de o
  proprio usuario concluir o fluxo: nao e contencao imediata.
- **Arquivar um profissional** (`DELETE /profissionais/:id`) marca o usuario como
  inativo e revoga os refresh tokens, entao nenhum access token novo e emitido.
  Ele **nao** encerra a sessao corrente: o guarda de JWT consulta
  `sessoes_usuario`, que o arquivamento nao toca, e o access token ja emitido
  continua valido ate expirar (`JWT_EXPIRA_EM`, padrao `15m`, ver
  `VARIAVEIS_AMBIENTE.md`). Ha portanto uma janela residual, e ela entra no
  registro do incidente em vez de ser presumida como zero.
- Para papel que nao seja `Professional` nao existe nem esse caminho.

Consequencia: **a contencao imediata de uma sessao comprometida nao e executavel
hoje**. Trate isso como limite conhecido do procedimento, e nao improvise
`UPDATE` direto em `sessoes_usuario` durante o incidente -- alteracao manual em
banco durante investigacao destroi a leitura posterior do proprio caso.

#### Preservacao de evidencia

**O que nao se faz**, e por que:

1. **Nao "limpar" a trilha.** `UPDATE`, `DELETE` e `TRUNCATE` sao rejeitados com
   `42501` desde a `1038`. A rejeicao e o controle funcionando, e nao um
   obstaculo a contornar.
2. **Nao desabilitar o gatilho para consertar uma linha.**
   `alter table ... disable trigger` derruba `tgenabled` de `'A'`, que e o
   proprio sinal de deteccao da tabela acima: a partir dai a operacao legitima
   fica indistinguivel do ataque para quem ler o catalogo depois.
3. **Nao rodar `migration:revert` nem o `down()` da `1038`** para destravar uma
   escrita. Reverter remove o controle no meio do incidente e nao reverte a
   trilha. A proibicao geral ja escrita em "Rollout interno e feature flags"
   vale aqui inteira.
4. **Nao restaurar backup sobre producao** para "voltar" a trilha. Restore
   substitui evidencia por copia; e decisao registrada de incidente com plano de
   reversao, pelo `RUNBOOK_BACKUP_RESTORE.md`, e nunca reflexo.
5. **Nao reiniciar o backend, nem publicar deploy, antes de ler o contador de
   falhas.** Ele e por processo e monotonico, e **zera no restart** -- reiniciar
   apaga a unica medida do volume de falhas daquele processo. Deploy durante o
   incidente e um restart.
6. **Nao colar em issue, PR, commit ou chamado**: corpo de requisicao,
   `metadados`, e-mail, telefone, id de paciente, URL assinada, connection
   string, token ou trecho do CSV exportado. O repositorio e publico; ver
   `SECURITY.md` e `docs/agents/DATA_CLASSIFICATION.md`.
7. **Nao inserir linha sintetica na trilha** para "marcar" o incidente. A trilha
   registra o que aconteceu; anotacao de incidente vai para o registro fora do
   Git.

**O que se preserva, e nesta ordem:**

1. **Contador e alertas, antes de qualquer restart.** Abrir `/operacoes` e
   registrar `metrica`, `valor` e `geradoEm`.
2. **Correlacao.** `x-request-id` da requisicao afetada, horario com fuso,
   `tenantId` e `usuarioId`. Ver `## Logs estruturados e correlacao`.
3. **Estado do controle de imutabilidade**, com o alvo confirmado na mesma
   sessao:

```sql
select current_database();
select tgname, tgenabled
from pg_trigger
where tgrelid = 'user_action_logs'::regclass and not tgisinternal
order by tgname;
```

4. **Congelar o estado do banco sem tocar em producao**: criar branch de backup
   no Neon, como nas etapas 2 e 4 de "Aplicar a migration 1720000001038". A
   branch serve a leitura posterior e nao altera a trilha.
5. **A propria trilha: a preservacao e nao mexer.** Ela ja e append-only. Nao ha
   nada a "salvar", e toda acao sobre ela so pode piorar o estado.

**Por qual caminho a evidencia sai.** Sao dois, e eles nao sao equivalentes:

- **Leitura para triagem, sem gerar evento** -- com sessao SuperAdmin
  autenticada no navegador. O console nao tem tela da trilha hoje, entao a rota
  do BFF e o caminho executavel:

```
GET /api/operacoes/auditoria/paginada?acao=<acao>&inicio=<ISO>&fim=<ISO>&limite=50
```

- **Extracao de artefato de evidencia** -- exportacao CSV da trilha, que grava
  `operacoes.auditoria.exportar_csv`. **E de proposito que ela seja auditada:**
  quem leva o acervo precisa aparecer dentro dele (politica, secao 2). Use
  sempre filtro de acao, periodo ou alvo; exportacao sem filtro nenhum e
  registrada como varredura, que e o formato de quem esta levando o acervo e nao
  investigando um caso.

As duas rotas sao escopo do tenant do operador: nao ha leitura cruzada entre
tenants por elas. O CSV exportado carrega identificadores e nao entra no Git, em
issue, em PR nem em ferramenta externa.

**Custo operacional que a fase 2 criou, e que muda a resposta ao titular:**

- **Pedido de eliminacao LGPD nao se resolve mais por `DELETE` na trilha.** O
  que mantem dado pessoal fora dela e a redacao de `metadados` aplicada na
  escrita, e nao remocao posterior. Ver a politica, secao 5.1.
- Se ainda assim uma linha precisar sair, o procedimento fora de banda esta em
  "Trilha de auditoria append-only" e exige dois responsaveis. Como o projeto
  tem um, ele **nao e executavel hoje**: a resposta ao titular precisa descrever
  o que o sistema faz, e nao prometer o que ele nao faz.

#### Comunicacao e registro

- Canal de seguranca: `SECURITY.md` -- reporte privado do GitHub ou o e-mail
  indicado la. **Nao abra issue publica** para exposicao de segredo, falha de
  autorizacao, isolamento entre tenants ou acesso a dado clinico.
- A issue automatica do monitor externo e **publica** e deduplicada pelo proprio
  workflow. Se o incidente de auditoria for descoberto por ela, **nao enriqueca
  aquela issue com detalhe do incidente**: ela sinaliza indisponibilidade, o
  workflow a fecha sozinho na recuperacao, e o detalhe pertence ao canal
  privado.
- Registro operacional -- horario, alvo confirmado, acoes na ordem em que foram
  feitas, resultado -- fica **fora do Git**, sanitizado.
- No repositorio entram apenas a licao em `docs/agents/LESSONS_LEARNED.md`,
  quando houver defeito sistemico, e o relatorio do ciclo em `docs/governance/`,
  quando o incidente virar trabalho de governanca.

#### Encerramento

Cinco condicoes. Todas verdadeiras, ou o incidente continua aberto:

1. **Causa identificada e escrita.** "Parou de aparecer" nao e causa.
2. **Controle de imutabilidade verificado ativo depois da correcao**: dois
   gatilhos, os dois com `tgenabled = 'A'`, com `select current_database();` na
   mesma sessao.
3. **Contador de falhas estavel**: duas leituras de `/operacoes`, separadas por
   pelo menos **30 minutos**, com o mesmo `valor` e **sem restart no meio**. Sao
   30, e nao 5 como no rollout, porque o dobro do horizonte de 15 minutos que o
   proprio alerta usa como piso de uptime cobre uma falha que volta em rajada.
   O criterio e "nao subiu", e nao "sumiu": o contador e monotonico e o alerta
   fica aceso ate o restart. Restart zera o contador e produziria verde por ter
   parado de olhar -- por isso ele invalida a leitura em vez de encerra-la.
4. **O intervalo sem trilha esta declarado.** Se a gravacao parou, os eventos
   daquele intervalo nao existem e nao serao reconstruidos. O encerramento
   **nomeia** o intervalo; ele nao o cobre. Ausencia de registro e
   indistinguivel de ausencia de acesso, e fechar sem declarar o intervalo
   transforma a lacuna numa afirmacao falsa de cobertura.
5. **Licao registrada** em `docs/agents/LESSONS_LEARNED.md` quando o incidente
   revelou defeito sistemico, no formato daquele arquivo: problema, causa,
   correcao, como nao repetir, controle e status do controle.

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
