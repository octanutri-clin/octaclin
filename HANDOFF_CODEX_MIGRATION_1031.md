# Handoff - aplicar a migration 1031 (modelos de plano alimentar)

Documento autocontido para outro agente (Codex) ou desenvolvedor humano executar
a parte de banco da Fase 234, Incremento 5. Nao depende do historico da conversa
que gerou o codigo.

- Aberto em: 2026-08-18
- Solicitado por: responsavel do projeto
- Origem do codigo: PR #53, branch `feat/fase-234-incremento-5-modelos-plano`
- Estado: **aplicada e verificada na integracao em 2026-08-18. Producao pendente,
  e aplica sozinha no deploy (ver Passo 2).**

## O que precisa ser feito

Aplicar a migration `1720000001031-CriarModelosPlanoAlimentar` primeiro na
integracao e depois em producao, nesta ordem, e confirmar o resultado.

## Contexto minimo

A migration cria `modelos_plano_alimentar`, tabela por tenant que guarda modelos
reutilizaveis de plano alimentar (origem `pessoal` ou `clinica`). E **aditiva**:
apenas `create table` e indices, sem alterar nem reescrever tabela existente.

O conteudo do modelo fica num snapshot criptografado (`conteudo_criptografado`),
e nao em tabelas relacionais de refeicao e item. `total_refeicoes` e
`total_itens` ficam em claro para a listagem mostrar o tamanho do modelo sem
descriptografar linha por linha.

Nao ha carga de dados, nao ha importador, nao ha fonte externa envolvida. TBCA,
IBGE/POF e Tucunduva continuam desabilitadas e nada neste incremento as toca.

## Estado esperado antes de comecar

| Banco | Migrations aplicadas hoje |
| --- | --- |
| `octaclin_test_fase150b` (integracao) | 43/43, ultima e a `1030` |
| `Octaclin-db-producao` (producao) | 43/43, ultima e a `1030` |

A `1031` e a unica pendente. Depois dela, ambos devem ficar em **44/44**.

## Sobre privilegios: integracao e producao divergem

**Correcao de 2026-08-18.** A versao anterior deste documento afirmava que nao
havia nada a fazer sobre privilegios, porque "migrations rodam como
`neondb_owner`, que e a mesma role de conexao da aplicacao". Isso vale na
integracao e **nao vale em producao**. O deploy falhou por causa dessa
generalizacao.

| Ambiente | Role de conexao da aplicacao | Pode criar tabela? |
| --- | --- | --- |
| `octaclin_test_fase150b` | `neondb_owner` | sim |
| `Octaclin-db-producao` | role runtime restrito | **nao** |

Em producao o backend conecta com uma role runtime deliberadamente sem
privilegio de DDL — o mesmo desenho que a auditoria da Fase 235 registra
("role runtime sem `SUPERUSER`/`BYPASSRLS`"). Quando `migrationsRun` tenta
criar a tabela no boot, o Postgres recusa:

    ERROR 42501: permission denied for schema public
    routine: aclcheck_error

O container sai com status 1 e o deploy falha inteiro.

### Consequencia para qualquer migration com DDL

`migrationsRun` no boot **nao consegue** aplicar migration que cria ou altera
tabela em producao. Migrations de DDL precisam ser aplicadas fora de banda, com
`neondb_owner`, antes do deploy — foi assim que a `1027` entrou na integracao e
como as `1028`/`1029`/`1030` entraram em producao.

O isolamento por tenant continua sem depender de privilegio: vem de
`force row level security`, que a migration aplica.

## Passo 1 - integracao (`octaclin_test_fase150b`)

Com `DATABASE_URL` apontando para a integracao:

```bash
cd octaclin-backend
git fetch origin
git checkout feat/fase-234-incremento-5-modelos-plano
pnpm install --frozen-lockfile=false
pnpm migration:run
```

Esperado: a `1031` executa e o total vai para 44/44.

### Verificacao obrigatoria

```sql
-- 1. RLS habilitada E forcada. Sem o `force`, o dono da tabela ignora a policy
--    e o isolamento por tenant nao existe na pratica.
select relrowsecurity, relforcerowsecurity
from pg_class where relname = 'modelos_plano_alimentar';
-- esperado: t | t

-- 2. Policy de isolamento presente
select policyname from pg_policies where tablename = 'modelos_plano_alimentar';
-- esperado: isolamento_tenant_modelos_plano_alimentar

-- 3. Constraints de integridade
select conname from pg_constraint
where conrelid = 'modelos_plano_alimentar'::regclass and contype = 'c';
-- esperado incluir: modelos_plano_alimentar_origem_profissional_check

-- 4. Indices de listagem
select indexname from pg_indexes where tablename = 'modelos_plano_alimentar';
-- esperado incluir: idx_modelos_plano_alimentar_listagem
--                   idx_modelos_plano_alimentar_profissional
```

### Prova de que a constraint funciona

As duas insercoes abaixo **devem falhar**. Se alguma passar, pare e reporte: a
regra de origem nao esta valendo.

```sql
begin;
-- modelo da clinica NAO pode ter profissional: preso a um, ele deixaria de ser
-- compartilhado no dia em que esse profissional fosse desligado
insert into modelos_plano_alimentar
  (tenant_id, origem, profissional_id, nome_criptografado, conteudo_criptografado,
   total_refeicoes, total_itens, criado_por_usuario_id)
values (gen_random_uuid(), 'clinica', gen_random_uuid(), '\x00', '\x00', 1, 1, gen_random_uuid());
rollback;

begin;
-- modelo pessoal PRECISA de profissional
insert into modelos_plano_alimentar
  (tenant_id, origem, profissional_id, nome_criptografado, conteudo_criptografado,
   total_refeicoes, total_itens, criado_por_usuario_id)
values (gen_random_uuid(), 'pessoal', null, '\x00', '\x00', 1, 1, gen_random_uuid());
rollback;
```

### Registro de execucao - 2026-08-18

O Passo 1 esta concluido. A `1031` **ja constava aplicada** na integracao antes
desta verificacao: `migration:show` trouxe
`[X] 44 CriarModelosPlanoAlimentar1720000001031` e a tabela `migrations` tem o
registro `id 44 / timestamp 1720000001031`. Nenhum `migration:run` foi
disparado por este handoff.

Resultado das verificacoes contra `octaclin_test_fase150b`:

| Verificacao | Resultado |
| --- | --- |
| RLS habilitada e forcada | `t` e `t` |
| Policy de isolamento | `isolamento_tenant_modelos_plano_alimentar` |
| Check constraints | 4, incluindo `modelos_plano_alimentar_origem_profissional_check` |
| Indices | `pkey`, `ux_..._tenant_id_id`, `idx_..._listagem`, `idx_..._profissional` |
| Linhas na tabela | 0 |
| Prova "clinica com profissional" | recusada, `23514` na constraint de origem |
| Prova "pessoal sem profissional" | recusada, `23514` na constraint de origem |

Cuidado ao repetir as provas: passar o `bytea` como literal no texto do SQL
derruba a conexao com `08P01 invalid message format` **antes** de a constraint
ser avaliada, e a prova parece passar pelo motivo errado. Passe o valor como
parametro (`$1`) com um `Buffer`, e confira que o erro e `23514` com
`constraint = modelos_plano_alimentar_origem_profissional_check`.

## Passo 2 - producao (`Octaclin-db-producao`)

**So depois de o Passo 1 passar inteiro.**

Pre-requisitos, todos obrigatorios:

1. Backup de `Octaclin-db-producao` feito e validado
2. Passo 1 concluido sem erro
3. PR #53 mergeado em `main`

### Rode `migration:run` com `neondb_owner` ANTES do deploy

O backend tem `migrationsRun` ligado por padrao
(`process.env.BANCO_EXECUTAR_MIGRACOES !== 'false'` em
`src/infraestrutura/banco-dados/opcoes-typeorm.ts`), entao ele aplica as
migrations pendentes sozinho ao subir. Foi assim que as migrations 1015 a 1019
entraram em producao no deploy da Fase 210.

Aplicar a mao antes do deploy deixaria o schema a frente do codigo implantado,
que e exatamente o descasamento que a Fase 210 expos. O caminho e:

1. Merge do PR #53
2. Deploy do backend
3. A `1031` aplica no boot

### Verificacao pos-deploy

- `GET /health/detalhado` deve trazer `checks.migracoes` sem drift
- Repetir no banco de producao as quatro consultas de verificacao do Passo 1

Nao inferir sucesso por status HTTP de outra rota: um `401` vem do guard de
autenticacao antes de qualquer acesso ao banco.

## Rollback

A migration tem `down` implementado
(`drop table if exists modelos_plano_alimentar cascade;`).

Como e aditiva e a tabela nasce vazia, reverter na integracao e seguro. **Em
producao, so reverter se a tabela ainda estiver vazia** — depois que
profissionais salvarem modelos, o `drop` perde dado clinico. Confirme antes:

```sql
select count(*) from modelos_plano_alimentar;
```

## Limites deste handoff

Nao faz parte desta tarefa, e nao deve ser feito por conta propria:

- alterar codigo da aplicacao (o PR #53 ja esta pronto e revisado)
- rodar seed, importador ou carga de catalogo
- habilitar qualquer fonte externa (TBCA, IBGE/POF, Tucunduva seguem bloqueadas)
- aplicar qualquer migration alem da `1031`
- commitar connection string, senha ou `.env` real em qualquer arquivo

## Criterio de aceite

- [x] Integracao em 44/44, com as quatro verificacoes conferidas
- [x] As duas insercoes de prova falharam como esperado
- [ ] Backup de producao confirmado
- [ ] PR #53 mergeado
- [ ] Deploy feito e `checks.migracoes` sem drift
- [ ] Producao em 44/44, com as quatro verificacoes conferidas

## Observacao sobre CI

Os creditos do GitHub Actions foram restabelecidos em 2026-08-18 e o CI voltou a
executar de verdade. `Monitor producao` e `Backup producao` tambem voltaram a
rodar com sucesso, entao o monitoramento de producao deixou de estar cego.

**O PR #53 esta verde nos sete jobs**, incluindo `Demo local smoke`, sobre a
branch ja atualizada com o `main`. Nao ha falha conhecida pendente.

Contexto util para quem executar: quando o CI voltou, o `Demo local smoke`
acusou quatro testes de prontuario quebrados. A causa era um mock da regressao
visual que ainda devolvia a listagem de planos como array cru, depois que o
Incremento 3 mudou o contrato para `{ itens, total, pagina, limite }`. Corrigido
e mergeado no PR #54. Em seguida, o PR #55 passou a rodar `test:authz` e
`test:next15` no job web do CI, que ate entao eram gates apenas locais — foi essa
ausencia que deixou a quebra chegar ao `main` sem sinal.
