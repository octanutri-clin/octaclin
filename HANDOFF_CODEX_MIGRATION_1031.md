# Handoff - aplicar a migration 1031 (modelos de plano alimentar)

Documento autocontido para outro agente (Codex) ou desenvolvedor humano executar
a parte de banco da Fase 234, Incremento 5. Nao depende do historico da conversa
que gerou o codigo.

- Aberto em: 2026-08-18
- Solicitado por: responsavel do projeto
- Origem do codigo: PR #53, branch `feat/fase-234-incremento-5-modelos-plano`
- Estado: **migration escrita, testada e NAO aplicada em banco nenhum**

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

## Sobre privilegios: nada a fazer

Ja foi verificado e **nao e necessario nenhum `grant`** para esta tabela.

Migrations rodam como `neondb_owner`, que e a mesma role de conexao da
aplicacao, entao a tabela nasce acessivel. O isolamento por tenant nao depende de
privilegio: depende de `force row level security`, que a migration aplica e que
faz a policy valer **inclusive para o dono da tabela** — sem `force`, o dono
ignoraria a policy.

E o mesmo padrao de `condutas_terapeuticas` (migration `1026`), que ja roda em
producao sem grant explicito. Os grants explicitos que aparecem nas migrations
`1028` e `1030` sao para `octaclin_app_producao` e `octaclin_runtime_integracao`
nas tabelas **globais de catalogo**, que precisam ser somente leitura. Nao se
aplicam a uma tabela por tenant como esta.

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

## Passo 2 - producao (`Octaclin-db-producao`)

**So depois de o Passo 1 passar inteiro.**

Pre-requisitos, todos obrigatorios:

1. Backup de `Octaclin-db-producao` feito e validado
2. Passo 1 concluido sem erro
3. PR #53 mergeado em `main`

### Nao rode `migration:run` manualmente em producao

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

- [ ] Integracao em 44/44, com as quatro verificacoes conferidas
- [ ] As duas insercoes de prova falharam como esperado
- [ ] Backup de producao confirmado
- [ ] PR #53 mergeado
- [ ] Deploy feito e `checks.migracoes` sem drift
- [ ] Producao em 44/44, com as quatro verificacoes conferidas

## Observacao sobre CI

Os creditos do GitHub Actions foram restabelecidos em 2026-08-18 e o CI voltou a
executar de verdade. O PR #53 teve sua primeira verificacao real: **os seis jobs
principais passaram** — `Backend NestJS`, `Web Next.js`, `Mobile Expo`,
`AI FastAPI`, `Rollout seguro` e `Operacao de lancamento`. `Monitor producao` e
`Backup producao` tambem voltaram a rodar com sucesso, entao o monitoramento de
producao deixou de estar cego.

**Falha conhecida e pre-existente, nao bloqueante para esta tarefa**: o job
`Demo local smoke` (Playwright visual) falha com 34 testes no PR #53. A mesma
suite falha com 35 testes em `main` (commit `6b38203`), e a comparacao dos
conjuntos mostra que **nenhum teste falha apenas no PR** — todos ja falhavam
antes. O job vinha sendo `skipped` em todo run desde 2026-08-14 porque depende
dos jobs anteriores, que falhavam por cobranca, entao a quebra passou semanas
sem ser vista. Investigar essa suite e trabalho separado, fora deste handoff e
fora do Incremento 5.
