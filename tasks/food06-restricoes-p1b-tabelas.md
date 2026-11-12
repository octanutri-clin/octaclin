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
| Cifra pertence à linha e à revisão | **não** | **só** o vínculo do codec |
| Mapeamento do tenant nunca `global`; liberação com evidência | `check` | motor (`exige_confirmacao`) |
| Permissão clínica específica (Q6) | **não** | Auth (pendente) |

## Revisão `tenant-security-reviewer` (2026-11-12, NÃO independente)

Subagente do mesmo tipo de modelo do autor, somente leitura, sobre `a794aee` e `beda2b1`. Veredito: sem achado crítico ou alto, sem caminho cross-tenant;
não bloqueia o merge. Não substitui a revisão R4 independente (ATV-9).

| Achado | Severidade | Tratamento |
| --- | --- | --- |
| Depois de confirmada, a restrição aceitava trocar `confirmado_por`/`confirmado_em` e passar `confirmada` ↔ `rejeitada` | MÉDIA | **Corrigido nesta PR:** a decisão de confirmação é imutável (contrato v2 §4.3 só admite `pendente` → `confirmada` ou `rejeitada`); testes e mutações |
| `down` fora de transação: `set local` sem efeito e contagem enganosa sob FORCE para owner sem BYPASSRLS | BAIXA | **Corrigido nesta PR:** recusa se `row_security` não ficou `off` |
| Demais `bytea` (justificativas, resultado da reconfirmação, pedido, explicação, desfecho, evidência) cifrados **sem vínculo** de linha/tenant | MÉDIA | **Condição de entrada da P2:** codec com vínculo (novas finalidades) para esses campos e guarda estendida antes do primeiro consumidor |
| Guarda estática contornável (aspas duplas, `require`, barrel, nome da tabela em SQL cru, só 2 de 7 entidades) | BAIXA | **P2:** allowlist nominal por entidade e nome de tabela, mais teste comportamental do repositório |
| Revisão do vínculo exige recifrar o conteúdo a cada UPDATE de estado | INFO | **P2:** documentar e testar no serviço (falha fechada se esquecer) |
| Autor da solicitação não é amarrado ao próprio paciente no banco; PK global pode virar oráculo se o DTO aceitar `id` do cliente | INFO | **P2/Auth:** negativo de paciente do portal pedindo por outro; DTO nunca aceita `id` |
| Metadados em claro com sinal clínico (`situacao`, `motivo_inativacao`, `origem`, `tipo`, `meio`) | BAIXA | Registrar na classificação de dados (Q4/ATV-2); decisão documentada de manter estados em claro |
| Avaliação: `revisao` não amarrada a uma linha de histórico | BAIXA | **P2:** gravar estado e histórico na mesma transação, com teste |

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
