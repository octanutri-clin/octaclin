# FOOD06 P1b — tabelas de restrições alimentares (migration 1083, R4)

**Status:** migration aditiva, tabelas **vazias**, entidades ORM, alinhamento do domínio pedido pelas decisões D1–D4 do proprietário sobre a
PR #531 e provas em PostgreSQL descartável. **Sem serviço, rota, DTO, UI, flag, dado ou consumidor.**
A migration **nunca foi aplicada em ambiente real** (staging, produção ou Neon); aplicar exige autorização específica por ambiente, banco, branch e
role (DEV-4, ATV-8). B04, M11-C2, ATV-1 a ATV-9 **continuam abertos**.

- Contrato: `tasks/food06-m11-restricoes-contrato-v3.md` (§2, §2.1, §4, §6) sobre `tasks/food06-m11-restricoes-contrato-v2.md` (§4.1–§4.9, §6 linha C).
- Domínio que estas tabelas servem: `octaclin-backend/src/modulos/planos-alimentares/dominio/` (`restricoes-alimentares.ts`, `reconfirmacao-restricao.ts`,
  `inativacao-restricao-protegida.ts`, `solicitacao-restricao-paciente.ts`, `conteudo-restricao.ts`) e o codec
  `infraestrutura/codec-conteudo-restricao.ts`.
- Auditoria Q5: `docs/governance/AUDITORIA_Q5_RESPOSTAS_QUESTIONARIO_2026-11-12.md` (fluxos novos em tabelas próprias, cifrados, sem reutilizar `resposta_valores`).
- Risco: **R4** (dado de saúde, RLS, tenancy, cifragem, DDL). Dados: só sintéticos (canários).

## Tabelas

| Tabela | Papel | Mutabilidade | Em claro | Cifrado (aplicação) |
| --- | --- | --- | --- | --- |
| `restricoes_pacientes` | estado atual de cada restrição | UPDATE com revisão +1; identidade imutável; `inativa` terminal; decisão não volta a `pendente`; sem DELETE | ids, `origem`, `estado`, `confirmacao`, quem/quando confirmou, `revisao` | `conteudo_criptografado` (natureza, subtipo, alvo, gravidade, observação), só pelo codec |
| `restricoes_pacientes_revisoes` | histórico numerado (CAS) | append-only | `evento`, `motivo_inativacao`, `confirmacao_dois_passos` | snapshot (codec, finalidade `revisao_restricao`), `justificativa_criptografada` |
| `avaliacoes_restricoes_pacientes` | avaliação global (uma por paciente) | UPDATE com revisão +1; sem DELETE | `situacao`, quem/quando, `vence_em` | — |
| `avaliacoes_restricoes_revisoes` | histórico da avaliação | append-only | `situacao`, `vence_em` | — |
| `reconfirmacoes_restricoes` | **Q10/D4** | append-only; avaliação + revisão obrigatórias; restrição + revisão opcionais e juntas; individual sem `vence_em` | `meio`, datas, revisões | `resultado_criptografado` |
| `solicitacoes_restricoes_pacientes` | **D7-a/D1** | máquina de estados do domínio no banco (com `parcial`); pedido imutável; encerrada terminal; sem DELETE | `tipo`, `estado`, quem/quando decidiu | pedido, `explicacao_paciente_criptografada` (visível), `justificativa_interna_criptografada` (nunca exibida), `desfecho_criptografado` |
| `mapeamentos_alimento_alvo_locais` | **Q9 nível 1** | append-only | ids, `relacao`, `granularidade`, `origem` (só `local_profissional`), `cobertura`, versão | evidência, justificativa |

Todas: `tenant_id` com RLS `ENABLE` + `FORCE`, policies de SELECT/INSERT (e UPDATE só nas três de estado) por `app.tenant_id`, nenhuma policy de DELETE,
FKs compostas por tenant com `RESTRICT`, DELETE/TRUNCATE recusados por trigger por instrução `ENABLE ALWAYS` (padrão 1082) e `REVOKE` nas roles conhecidas.

## Decisões do proprietário sobre a PR #531 (2026-11-12) e como foram implementadas

| Decisão | Estado | Implementação nesta PR | Fica para outra PR |
| --- | --- | --- | --- |
| **D1** estados da solicitação: nomenclatura do domínio **mais `parcial`** | IMPLEMENTADO | Domínio: `ESTADOS_SOLICITACAO`, ação `atender_parcialmente` só do profissional e só a partir de `em_analise`, `parcial` terminal, chave `restricoes.solicitacao.parcial`; `validarDesfechoSolicitacao` (parcial exige ≥1 alterado com `restricaoId` + `revisaoResultante` e ≥1 inalterado, disjuntos; atendida só alterados; recusada só inalterados). Banco: `parcial` no `check`, na transição, na lista terminal e nas exigências de decisor, explicação e `desfecho_criptografado`; o pedido continua sem alterar a restrição. Contrato v3 §2.1.6 harmonizado. | P2: verificar que cada `revisaoResultante` existe e veio de operação clínica autorizada; auditoria da decisão. P3: textos do D7-a por chave. |
| **D2** conteúdo clínico cifrado em bloco, com salvaguardas | IMPLEMENTADO | `validarConteudoRestricao` (validação única: estrutura, tipos, vocabulário, combinações, versão `schemaVersao: 1`, campos fechados, sem `razao`); `codec-conteudo-restricao.ts` (valida antes de cifrar com AES-GCM autenticado; envelope com formato e versão próprios e **vínculo** a finalidade, tenant, paciente, restrição e revisão; qualquer falha lança `ConteudoRestricaoIlegivelError` genérico, sem causa nem eco, e nunca devolve vazio); guarda estática `guarda-escrita-restricoes.spec.ts` (todo consumidor das entidades precisa importar o codec). | P2: serviço usa o codec em criação, edição e revisão; auditoria e logs sem conteúdo; motor trata ilegível como erro, nunca como ausência. |
| **D3** catálogo global fora desta PR | MANTIDO | Só a tabela local, `check (origem = 'local_profissional')`. | PR de curadoria (ATV-5) com os nove requisitos da decisão. |
| **D4** avaliação global obrigatória na reconfirmação | IMPLEMENTADO | Domínio `registrarReconfirmacao`: exige paciente, avaliação e revisão, autor, meio, resultado (`sem_alteracao`, `alteracao_informada`, `sem_restricoes_declaradas`, `pendencia_mantida`) e atestação; restrição opcional `{ id, revisao }`; só global com `sem_alteracao` ou ausência explicitamente confirmada renova (180 dias); individual nunca renova nem declara ausência; pendência mantida sem declaração falsa; formato antigo só por restrição é recusado. Banco: `vence_em` nulo permitido, `check (restricao_id is null or vence_em is null)`, FKs compostas para avaliação, revisão da avaliação, restrição do mesmo paciente e revisão da restrição. | Auth (Q6): permissão clínica específica antes da P2. P2: gravar a revisão da avaliação na mesma transação. |

Invariantes já aprovados preservados: restrição confirmada não vence (motor, `restricoes-alimentares.spec.ts`); avaliação vencida gera
`indeterminado`/pendência sem apagar conflito conhecido (motor); Q3 sem reautenticação; a solicitação nunca altera a restrição.

## Invariantes: onde cada um é garantido (D2.10)

| Invariante | Banco (1083) | Aplicação |
| --- | --- | --- |
| Isolamento por tenant | RLS FORCE, FKs compostas | `ExecutorTenant`, carteira do paciente (P2) |
| Histórico imutável; estado nunca apagado | triggers por instrução `ENABLE ALWAYS` | — |
| Revisão +1, identidade imutável, `inativa` e solicitação encerrada terminais, transições da solicitação | triggers por linha | domínio (`transicionarSolicitacao`, `avaliarInativacao`) |
| Confirmação exige quem e quando; avaliação confirmada exige vencimento | `check` | domínio do motor |
| Q3: motivo, justificativa e dois passos na inativação | `check` na revisão | `avaliarInativacao` |
| Decisão da solicitação exige explicação e desfecho | `check` (presença) | `validarDesfechoSolicitacao` (conteúdo) |
| Reconfirmação ligada à revisão real; individual sem vencimento | FKs e `check` | `registrarReconfirmacao` (resultado, ausência explícita) |
| Natureza, subtipo, gravidade, alvo e combinações clínicas | **não** (cifrado) | **só** `validarConteudoRestricao` |
| Cifra pertence ao campo, à linha, à revisão, ao paciente e ao tenant (10 campos) | **não** | **só** o vínculo do codec (`CAMPOS_CIFRADOS`) |
| Mapeamento do tenant nunca `global`; liberação com evidência | `check` | motor (`exige_confirmacao`) |
| Permissão clínica específica (Q6) | **não** | Auth (pendente) |

## Parecer R4 independente (Codex, 2026-11-12, HEAD `f6121c0`)

Revisor sem participação na implementação. Veredito sobre `f6121c0`: **BLOQUEAR MERGE**, só pelo R4-01. RLS, FKs com MATCH SIMPLE,
histórico, estado, constraints, privilégios, registro e os 10 campos cifrados foram confirmados sem achado.

| Achado | Severidade | Tratamento |
| --- | --- | --- |
| **R4-01:** a checagem de tabelas vazias do `down` não serializava com escritores; uma linha confirmada depois da checagem era apagada pelo DROP. A guarda de transação também era contornável com `row_security=off` na sessão | ALTA | **Corrigido:** transação explícita obrigatória e `LOCK TABLE … IN ACCESS EXCLUSIVE MODE` nas 7 tabelas antes da checagem, mantido até o commit. Testes em PostgreSQL descartável com duas conexões (a escrita espera o lock e falha depois do DROP, sem confirmar nada que depois some) e com sessão em `row_security=off` sem transação |
| **R4-02:** o codec aceitava um pedido (200 × 1000) cuja cifra (205.641 bytes) a coluna recusa (`octet_length ≤ 65536`) | MÉDIA | **Corrigido agora** (o parecer admitia a P2): o codec recusa com erro de domínio cifras acima de `LIMITE_BYTES_CIFRA`, conferido contra a migration, com teste de fronteira em Unicode |
| Owner sem BYPASSRLS recusa o rollback vazio com 42501 | INFO | Falha fechada, sem falso zero; registrado no procedimento (R2) |
| **R4-01 (reverificação, HEAD `98555e3`):** o lock fechava a janela só em READ COMMITTED; em REPEATABLE READ e SERIALIZABLE o snapshot fixado antes do lock escondia uma linha confirmada, e o DROP a apagava. R4-02 e a guarda de transação foram confirmados corrigidos | ALTA | **Corrigido:** `SHOW transaction_isolation` (não fixa snapshot) é a primeira consulta; qualquer isolamento diferente de READ COMMITTED é recusado. Testes em PostgreSQL descartável reproduzem a prova do revisor nos dois isolamentos (escrita confirmada logo depois da consulta que fixa o snapshot): o `down` recusa e a tabela e a linha sobrevivem |
| O banco não obriga histórico por atualização de estado | INFO | R8, na P2, para avaliação e restrição |
| Falha do teste do catálogo TACO no checkout Windows (CRLF) | NA | Ambiente do revisor; o blob é idêntico na base e no HEAD, não é regressão do diff |

## Revisão `tenant-security-reviewer` (2026-11-12, NÃO independente)

Subagente do mesmo tipo de modelo do autor, somente leitura, sobre `a794aee` e `beda2b1`. Veredito: sem achado crítico ou alto, sem caminho cross-tenant;
não bloqueia o merge. Não substitui a revisão R4 independente (ATV-9).

| Achado | Severidade | Tratamento |
| --- | --- | --- |
| Depois de confirmada, a restrição aceitava trocar `confirmado_por`/`confirmado_em` e passar `confirmada` ↔ `rejeitada` | MÉDIA | **Corrigido nesta PR:** a decisão de confirmação é imutável (contrato v2 §4.3 só admite `pendente` → `confirmada` ou `rejeitada`); testes e mutações |
| `down` fora de transação: `set local` sem efeito e contagem enganosa sob FORCE para owner sem BYPASSRLS | BAIXA | **Corrigido nesta PR:** recusa se `row_security` não ficou `off` |
| Demais `bytea` (justificativas, resultado da reconfirmação, pedido, explicação, desfecho, evidência) cifrados **sem vínculo** de linha/tenant | MÉDIA | **Corrigido nesta PR (R3):** o mesmo codec cobre os 10 campos (`CAMPOS_CIFRADOS`), com vínculo de campo, tenant, registro, revisão e paciente; teste confere o registro contra as colunas da 1083 |
| Guarda estática contornável (aspas duplas, `require`, barrel, nome da tabela em SQL cru, só 2 de 7 entidades) | BAIXA | **Corrigido nesta PR (R4):** 7 entidades, 7 tabelas, listas nominais com motivo e testes de regressão dos contornos; o teste comportamental dos serviços fica na P2 |
| Revisão do vínculo exige recifrar o conteúdo a cada UPDATE de estado | INFO | **P2:** documentar e testar no serviço (falha fechada se esquecer) |
| Autor da solicitação não é amarrado ao próprio paciente no banco; PK global pode virar oráculo se o DTO aceitar `id` do cliente | INFO | **P2/Auth:** negativo de paciente do portal pedindo por outro; DTO nunca aceita `id` |
| Metadados em claro com sinal clínico (`situacao`, `motivo_inativacao`, `origem`, `tipo`, `meio`) | BAIXA | **Decidido (R7):** mantidos em claro, justificados e classificados como derivados protegidos em `docs/agents/DATA_CLASSIFICATION.md`; não é parecer jurídico (ATV-2) |
| Avaliação: `revisao` não amarrada a uma linha de histórico | BAIXA | **P2:** gravar estado e histórico na mesma transação, com teste |

## Acompanhamento único (prompt mestre FOOD06, §18)

Estados: RESOLVIDO · EM IMPLEMENTAÇÃO · AGUARDA VALIDAÇÃO HUMANA · AGUARDA AUTORIZAÇÃO OPERACIONAL · BLOQUEADO.

| ID | Estado | O que foi resolvido | Evidência | O que falta |
| --- | --- | --- | --- | --- |
| R1 | RESOLVIDO | Decisão de confirmação imutável (quem, quando, `confirmada`↔`rejeitada`, volta a `pendente`) | Trigger da 1083; integração "estado: UPDATE…"; mutações `r4_decisao_reescrita`, `r4_volta_pendente`, `volta_pendente` | — |
| R2 | RESOLVIDO (aguarda conferência do revisor) | `down` exige transação explícita (`isTransactionActive`), isolamento READ COMMITTED (`SHOW transaction_isolation`, antes de qualquer outra consulta), trava as 7 tabelas em `ACCESS EXCLUSIVE` antes da checagem de existência (corrige a corrida R4-01 do parecer independente) e só remove com tabelas vazias | Specs estático e de integração do `down`, inclusive duas conexões com escrita concorrente, sessão com `row_security=off` sem transação e escrita confirmada entre o snapshot e o lock em REPEATABLE READ e SERIALIZABLE; mutações `sem_lock`, `lock_fraco`, `sem_transacao_explicita`, `down_sem_guarda`, `sem_guarda_isolamento`, `aceita_repeatable_read` | Procedimento: o rollback vazio exige owner superusuário ou com BYPASSRLS, fora de banda; owner sem bypass recusa com 42501 (falha fechada). Nunca conceder esse poder ao runtime |
| R3 | RESOLVIDO | Um codec para os 10 campos cifrados, vínculo de campo/tenant/registro/revisão/paciente, falha fechada | `codec-conteudo-restricao.spec.ts` (registro × colunas da 1083, cópias, versão, adulteração); integração "R3 (#531)"; mutações `r3_*` | — |
| R4 | RESOLVIDO (escopo P1b) | Guarda cobre 7 entidades e 7 tabelas, aspas, `require`, `import()`, barrel e SQL cru; listas nominais | `guarda-escrita-restricoes.spec.ts`; mutações `r4_*` | P2: testes comportamentais dos serviços reais (validar, cifrar, autorizar, sem entidade crua por HTTP) |
| R5 | EM IMPLEMENTAÇÃO (P2) | — | — | Recifrar na mesma transação ao avançar a revisão; testes de conflito e rollback |
| R6 | EM IMPLEMENTAÇÃO (Auth/P2) | — | — | Identidade e carteira pelo servidor; negativos de outro paciente/tenant; resposta idêntica para inexistente e não autorizado |
| R7 | RESOLVIDO | Metadados em claro mantidos, justificados e classificados | `docs/agents/DATA_CLASSIFICATION.md` | Parecer jurídico segue no ATV-2 |
| R8 | EM IMPLEMENTAÇÃO (P2) | — | — | Estado e histórico na mesma transação, para a avaliação **e para a restrição** (revisões, eventos e Q3): o banco não obriga uma linha de histórico por atualização de estado |
| B04 | EM IMPLEMENTAÇÃO | Persistência cifrada, transições, origem e evidência de mapeamento, falha fechada, histórico (P1b) | Esta PR | Auth (Q6), P2 (serviços e integração com o motor), depois AGUARDA VALIDAÇÃO HUMANA (Q1, Q4) |
| M11-C2 | EM IMPLEMENTAÇÃO | Base de dados e domínio | Esta PR, #526, #529 | Jornada integrada (P2–P4) e prova dos critérios |
| ATV-1 | AGUARDA VALIDAÇÃO HUMANA | Motor inerte sem regra validada | #526 | Ficha clínica e aprovação real do responsável clínico |
| ATV-2 | AGUARDA VALIDAÇÃO HUMANA | Classificação de dados (R7) | `DATA_CLASSIFICATION.md` | Matriz LGPD preenchida e revisada por jurídico/privacidade |
| ATV-3 | EM IMPLEMENTAÇÃO | Fluxos novos com cifragem autenticada e vínculo, RLS FORCE | Esta PR | Autorização (P2); plano do histórico do questionário; avaliação de privacidade |
| ATV-4 | AGUARDA VALIDAÇÃO HUMANA | — | — | Registro regulatório atualizado em fonte oficial |
| ATV-5 | EM IMPLEMENTAÇÃO | Tabela local separada; tenant não forja `global` | Esta PR | Fluxo mínimo da curadoria global e teste ponta a ponta |
| ATV-6 | EM IMPLEMENTAÇÃO (P2/P3) | — | — | Negar o novo fluxo do portal quando a representação não for suportada, com negativos |
| ATV-7 | EM IMPLEMENTAÇÃO (P3) | — | — | Interface; depois testes com pessoas reais |
| ATV-8 | AGUARDA AUTORIZAÇÃO OPERACIONAL | Ensaios só em PostgreSQL descartável | Integração da 1083 | Checklist por ambiente e execução autorizada |
| ATV-9 | EM IMPLEMENTAÇÃO | Parecer (HEAD `f6121c0`) e reverificação (HEAD `98555e3`) do Codex recebidos, ambos BLOQUEAR por R4-01; R4-02 confirmado corrigido; R4-01 completado com a guarda de isolamento | Seção "Parecer R4 independente" abaixo | Confirmação do revisor sobre as correções; UX B/C quando houver interface |

## Fora de escopo (sem tabela nesta PR)

Taxonomia, regras clínicas, decisões de aplicação (P4), pedidos de curadoria e catálogo global (D3, ATV-5), auditoria específica (a P2 usa
`user_action_logs` com `redacao-auditoria.ts`), permissão por usuário (Q6), serviço, rotas, UI, flags e a migração histórica do Q5.

## Banco usado na prova

PostgreSQL 15 (`postgres:15-alpine`, obtida pelo espelho `mirror.gcr.io` porque o Docker Hub respondeu 429), contêiner Testcontainers efêmero em tmpfs,
criado e destruído pelo teste. Owner = superusuário do contêiner; runtime = `food06_runtime` sem superuser, sem BYPASSRLS e sem ownership. Nenhuma
conexão a Neon, staging ou produção.

## Limites

- O owner pode desabilitar triggers no catálogo; não é imutabilidade contra o administrador (mesmo limite da 1082). Eliminação por direito do titular
  exige procedimento fora de banda.
- A mutação "UPDATE sem `with check`" só é detectada pelo spec estático: no banco, a trigger de identidade já recusa trocar `tenant_id` antes do RLS.
- O banco não consegue provar que uma `revisaoResultante` do desfecho veio de operação clínica autorizada nem que o profissional tem a permissão Q6.
- Nada aqui valida conteúdo clínico (Q1), privacidade (Q4) ou textos (ATV-7).
