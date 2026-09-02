# Politica de providers e menor privilegio do OctaClin

> Norma duravel. Estado observado fica em `STATUS_ATUAL_PROJETO.md` e a
> evidencia do ciclo em `docs/governance/RELATORIO_SEGURANCA_PR51_2026-09-02.md`.

Esta politica cobre os quatro providers externos que sustentam o OctaClin em
producao: Render (execucao), Neon (Postgres), Redis gerenciado (filas) e
Backblaze B2 (anexos e backup). Ela define quem pode o que, o que precisa
trafegar cifrado, como os ambientes ficam separados e o que serve como prova.

Principio: **configuracao declarada nao e privilegio verificado**. O
repositorio ja dizia, em `VARIAVEIS_AMBIENTE.md`, que `DATABASE_URL` usa "papel
sem `BYPASSRLS`". Ate o PR 51 nada media isso no processo em execucao -- as
unicas verificacoes de papel viviam em scripts de E2E que nao rodam em
producao.

---

## 1. Inventario de providers

| Provider | O que guarda | Credencial | Onde a credencial vive |
| --- | --- | --- | --- |
| Render | processos `web`, `worker`, web Next e FastAPI de IA | variaveis de ambiente do servico | painel Render, por servico e por ambiente |
| Neon | PHI/PII cifrada, dados clinicos, auditoria | `DATABASE_URL` (runtime), role owner (migrations), role de backup | Render (runtime) e GitHub Environment `production-backup` (backup) |
| Redis gerenciado | filas BullMQ, outbox, cache, state OAuth | `REDIS_URL` | Render |
| Backblaze B2 | anexos clinicos (bucket de midia) e dumps (bucket de backup) | `ARMAZENAMENTO_S3_*` e `B2_BACKUP_*` | Render (midia) e GitHub Environment `production-backup` (backup) |

Os dois buckets B2 sao distintos e as chaves nao se cruzam: a chave de midia
nao alcanca o bucket de backup, e a de backup nao alcanca o de midia.

---

## 2. Separacao owner/runtime no Postgres

Esta e a regra mais importante do documento, porque dela depende todo o
isolamento entre tenants provado no PR 43.

| Papel | Role | Pode | Nao pode |
| --- | --- | --- | --- |
| Runtime (`web`, `worker`) | role de aplicacao | `SELECT`/`INSERT`/`UPDATE`/`DELETE` sob RLS | `SUPERUSER`, `BYPASSRLS`, DDL, `CREATE` no schema `public` |
| Migrations | role owner | DDL, fora de banda, pelo procedimento do runbook | servir trafego HTTP |
| Backup | role dedicada de leitura | dump logico | escrita |

**Por que `BYPASSRLS` e o ponto de falha silencioso.** A policy de RLS
simplesmente nao e avaliada para uma role que tem o atributo. Colar a URL da
role owner no painel do Render nao produz erro nenhum: a aplicacao sobe, o
`/health` responde `200`, os smokes passam, e o isolamento entre tenants deixa
de existir sem um unico sinal.

**Pertinencia conta como privilegio.** `BYPASSRLS` e `SUPERUSER` sao atributos
de role e nao sao herdados pela associacao, nem com `INHERIT`. Mas a associacao
concede `SET ROLE`, e depois do `SET ROLE` os atributos valem. Por isso a
verificacao usa `pg_has_role(current_user, oid, 'MEMBER')`, e nao `'USAGE'`.

A direcao inversa e segura e existe de proposito: o owner e membro da role de
runtime, como registra o `AUDITORIA_FINAL_FASE_235_2026-08-13.md`. Owner que
pode assumir o runtime nao e escalonamento; runtime que pode assumir o owner e.

**DDL fora de banda.** A licao de 2026-08-22 em
`docs/agents/LESSONS_LEARNED.md` registra um deploy que tentou migration com a
role de runtime e falhou por falta de `CREATE`. A correcao foi tornar migrations
opt-in (`BANCO_EXECUTAR_MIGRACOES`) e executa-las fora de banda com a role
owner. Devolver `CREATE` no schema `public` a role de runtime desfaz aquela
separacao sem que nada reclame -- por isso ela tambem e verificada.

---

## 3. TLS por provider

| Provider | Regra em staging e producao | Onde e imposta |
| --- | --- | --- |
| Neon | TLS obrigatorio, cadeia e hostname sempre verificados; `sslmode` permissivo derruba o boot | `ssl-postgres.ts`, falha fechada desde o PR 39 |
| Redis | TLS obrigatorio (`rediss://` ou `REDIS_TLS=true`) | verificado e relatado desde o PR 51; falha fechada pendente de evidencia |
| Backblaze B2 | endpoint HTTPS | verificado e relatado desde o PR 51; falha fechada pendente de evidencia |
| Render -> navegador | HTTPS, cookie `Secure`, CORS sem `*` | `main.ts` e BFF, falha fechada desde a Fase 229 |

O Redis merece nota porque o payload de fila carrega identificador de tenant e
conteudo de comunicacao, e a URL carrega usuario e senha. Sem TLS, tudo isso
trafega em claro entre o Render e o provedor.

---

## 4. Separacao de ambientes

- Staging e producao usam **projeto Neon, instancia Redis, bucket B2 e servico
  Render distintos**. Nao ha credencial compartilhada entre ambientes.
- `APP_AMBIENTE` declara o ambiente real. `NODE_ENV` sozinho nao serve: o Render
  usa `production` para staging e para producao.
- As credenciais de backup vivem no GitHub Environment `production-backup` e
  **nao** sao copiadas para o Render nem para o backend.
- Nenhuma credencial de producao entra em `.env` versionado, log, ticket, PR ou
  ferramenta externa.

A separacao foi aceita na Fase 131, com rotacao de credenciais. Ela nao e
verificavel a partir do repositorio: exige a evidencia da secao 6.

---

## 5. O que e verificado automaticamente

`ServicoMenorPrivilegioProviders` mede o processo real no bootstrap e sob
demanda em `GET /operacoes/providers` (SuperAdmin, permissao
`operacoes.auditoria.ler`):

| Verificacao | Veredicto quando falha |
| --- | --- |
| role de runtime sem `SUPERUSER` | `violado` |
| role de runtime sem `BYPASSRLS` | `violado` |
| role de runtime nao e membro de role privilegiada | `violado` |
| role de runtime sem `CREATE` no schema `public` | `violado` |
| Redis com TLS | `violado` em staging/producao |
| endpoint de armazenamento HTTPS | `violado` em staging/producao |

Tres regras de leitura importam:

1. **`nao-verificado` nao e aprovacao.** Provider ausente do processo, consulta
   negada ou `DataSource` nao inicializado produzem `nao-verificado`, e o
   veredicto geral so vira `conforme` se ao menos uma verificacao passou de
   fato.
2. **Motivos nao carregam segredo.** Nem host, nem credencial, nem nome de
   role aparecem no relatorio ou no log. Ha teste negativo para isso.
3. **O relatorio nao esta em `/health/detalhado`.** Aquele endpoint e publico e
   nao autenticado; dizer a um anonimo que a role do runtime tem `BYPASSRLS`
   seria entregar o mapa.

### Por que ainda nao derruba o boot

Por decisao registrada no PR 51 e pela licao de 2026-08-22 em
`docs/agents/LESSONS_LEARNED.md`: um check novo avaliado contra configuracao
presumida, e nao contra o ambiente real, ja degradou a saude de producao uma
vez. A conversao para falha fechada acontece **depois** da evidencia da secao 6,
em PR proprio e curto. Ate la, uma violacao aparece como `error` no log do
deploy e como `violado` no endpoint de operacoes.

---

## 6. Coleta de evidencia (operacao humana)

Estado real de provider so se prova no provider. Nenhum comando abaixo altera
configuracao; todos sao de leitura. Execute-os na sessao do proprietario,
registre o resultado **redigido** no relatorio do ciclo e nunca cole valor de
credencial.

### 6.1 Neon -- privilegio da role de runtime

Rode contra o banco de **producao**, com a `DATABASE_URL` que o Render usa:

```sql
select
  current_user,
  rolsuper,
  rolbypassrls,
  has_schema_privilege(current_user, 'public', 'CREATE') as pode_criar
from pg_roles
where rolname = current_user;

select alvo.rolname
from pg_roles alvo
where (alvo.rolsuper or alvo.rolbypassrls)
  and alvo.rolname <> current_user
  and pg_has_role(current_user, alvo.oid, 'MEMBER');
```

Esperado: `rolsuper=false`, `rolbypassrls=false`, `pode_criar=false` e segunda
consulta sem linhas. Registre apenas os booleanos e a contagem de linhas.

O mesmo resultado sai pelo proprio backend, sem abrir o banco:

```bash
curl -H "Authorization: Bearer <token SuperAdmin>" \
  https://<backend-render-url>/operacoes/providers
```

### 6.2 Neon -- separacao de ambientes

Confirme no painel que staging e producao sao **projetos** distintos, e nao
branches do mesmo projeto, e que a role de backup existe apenas no projeto de
producao. Registre os nomes dos projetos, nunca a connection string.

### 6.3 Redis -- TLS e politica de memoria

```bash
redis-cli --tls -u "$REDIS_URL" config get maxmemory-policy
```

Esperado: `noeviction`. Qualquer outra politica deixa o Redis descartar chave
sozinho, e no BullMQ isso e job sumindo em silencio. Provedores gerenciados
costumam restringir `CONFIG`; se o comando for negado, obtenha o valor no painel
e registre a origem da evidencia.

Confirme tambem que a URL configurada no Render comeca com `rediss://`.

### 6.4 Backblaze B2 -- escopo das chaves

No painel, para cada Application Key, registre bucket alvo e capabilities.
Esperado:

- chave de midia: apenas o bucket de midia, sem `deleteFiles` e sem
  `listBuckets` global;
- chave de backup: apenas o bucket de backup;
- nenhum dos dois buckets com acesso publico;
- CORS do bucket de midia liberando somente a origem web do ambiente.

### 6.5 Render -- separacao e superficie

Para cada servico (backend, worker, web, IA), registre:

- ambiente declarado em `APP_AMBIENTE`;
- se o servico de staging aponta para recursos de staging;
- quais variaveis estao marcadas como secret;
- se o worker esta sem dominio publico e sem health check HTTP.

### 6.6 Rotacao

`RUNBOOK_ROTACAO_SECRETS.md` continua sendo o procedimento. Registre a data da
ultima rotacao de cada credencial da secao 1. Credencial sem data conhecida
deve ser rotacionada.

---

## 7. Excecao

Divergencia desta politica precisa de entrada datada, com owner e prazo, no
relatorio do ciclo, e de referencia no PR que a introduz. Excecao sem prazo nao
e excecao: e a politica mudando sem review.
