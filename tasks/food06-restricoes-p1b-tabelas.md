# FOOD06 P1b — tabelas de restrições alimentares (migration 1083, R4)

**Status:** migration aditiva, tabelas **vazias**, entidades ORM e provas em PostgreSQL descartável. **Sem serviço, rota, DTO, UI, flag, dado ou consumidor.**
A migration **nunca foi aplicada em ambiente real** (staging, produção ou Neon); aplicar exige autorização específica por ambiente, banco, branch e role (DEV-4, ATV-8).
B04 e M11-C2 **continuam abertos**.

- Contrato: `tasks/food06-m11-restricoes-contrato-v3.md` (§2, §2.1, §4, §6) sobre `tasks/food06-m11-restricoes-contrato-v2.md` (§4.1–§4.9, §6 linha C).
- Domínio já mergeado que estas tabelas servem: `octaclin-backend/src/modulos/planos-alimentares/dominio/` (`restricoes-alimentares.ts`, `reconfirmacao-restricao.ts`,
  `inativacao-restricao-protegida.ts`, `solicitacao-restricao-paciente.ts`).
- Auditoria Q5: `docs/governance/AUDITORIA_Q5_RESPOSTAS_QUESTIONARIO_2026-11-12.md` (fluxos novos em tabelas próprias, cifrados, sem reutilizar `resposta_valores`).
- Risco: **R4** (dado de saúde, RLS, tenancy, cifragem, DDL). Dados: só sintéticos (canários).

## Tabelas

| Tabela | Papel | Mutabilidade | Em claro | Cifrado (aplicação) |
| --- | --- | --- | --- | --- |
| `restricoes_pacientes` | estado atual de cada restrição | UPDATE com revisão +1; identidade imutável; `inativa` terminal; decisão não volta a `pendente`; sem DELETE | ids, `origem`, `estado`, `confirmacao`, quem/quando confirmou, `revisao` | `conteudo_criptografado` (natureza, subtipo, alvo, gravidade, observação) |
| `restricoes_pacientes_revisoes` | histórico numerado (CAS) | append-only | `evento`, `motivo_inativacao`, `confirmacao_dois_passos` | snapshot, `justificativa_criptografada` |
| `avaliacoes_restricoes_pacientes` | avaliação global (uma por paciente) | UPDATE com revisão +1; sem DELETE | `situacao`, quem/quando, `vence_em` | — |
| `avaliacoes_restricoes_revisoes` | histórico da avaliação | append-only | `situacao`, `vence_em` | — |
| `reconfirmacoes_restricoes` | **Q10**: atestação com paciente, profissional, data e hora, meio, resultado, revisão da avaliação | append-only | `meio`, datas, revisões | `resultado_criptografado` |
| `solicitacoes_restricoes_pacientes` | **D7-a**: pedido do paciente | máquina de estados do domínio no banco; pedido imutável; encerrada terminal; sem DELETE | `tipo`, `estado`, quem/quando decidiu | pedido, **`explicacao_paciente_criptografada`** (visível), **`justificativa_interna_criptografada`** (nunca exibida) |
| `mapeamentos_alimento_alvo_locais` | **Q9 nível 1**: mapeamento local versionado | append-only | ids, `relacao`, `granularidade`, **`origem`**, `cobertura`, versão | evidência, justificativa |

Todas: `tenant_id` com RLS `ENABLE` + `FORCE`, policies de SELECT/INSERT (e UPDATE só nas três de estado) por `app.tenant_id`, nenhuma policy de DELETE, FKs compostas
por tenant com `RESTRICT`, DELETE/TRUNCATE recusados por trigger por instrução `ENABLE ALWAYS` (padrão 1082) e `REVOKE` nas roles conhecidas como defesa em profundidade.

## Decisões que ESPECIFICAM ou divergem do contrato (confirmar com o proprietário)

| # | Decisão | Por quê | Onde confirmar |
| --- | --- | --- | --- |
| 1 | Natureza, subtipo, alvo, gravidade e observação ficam **dentro** de `conteudo_criptografado`, não em colunas. | v2 §4.1 manda cifrar "todos os dados de saúde ou de convicção"; coluna em claro diria "paciente X tem alergia a Y" a quem ler o banco, e `escolha` pode revelar convicção. O motor recebe a entrada decifrada; até 200 restrições por paciente (`LIMITE_RESTRICOES_AVALIACAO`) não exigem índice por alvo. Custo: os invariantes de natureza/subtipo/gravidade ficam só no domínio. | v2 §4.1 e §4.2 (inv. 1) |
| 2 | Estados da solicitação seguem o **domínio mergeado** (`criada`, `em_analise`, `atendida`, `recusada`, `cancelada_pelo_paciente`), não a lista do v3 §2.1.6 (`aberta`, `em_revisao`, `em_analise`, `aceita`, `recusada`, `parcial`). | O banco precisa servir o código que existe. **Fato novo:** o domínio não tem `parcial` ("Sua informação foi atualizada parcialmente"). Acrescentar estado depois exige migration nova (troca do `check`). | v3 §2 (D7-a) e §2.1.6 |
| 3 | Reconfirmação aponta **sempre** a avaliação e sua revisão real (FK) e, **opcionalmente**, uma restrição e sua revisão. | O v3 (Q10) fala da revisão da avaliação; o domínio `registrarReconfirmacao` recebe `restricaoId` e `revisaoRestricao`. A tabela aceita os dois sem escolher por eles. | v3 Q10 |
| 4 | Só existe a tabela de mapeamento **local** do tenant, com `check (origem = 'local_profissional')`. O catálogo global (Q9 nível 2) **não** foi criado. | Uma tabela por tenant que aceitasse `global` deixaria um tenant forjar a origem que o motor trata como validada. O global precisa de outro modelo de acesso (sem tenant, escrita só pela curadoria), que é decisão da PR da curadoria (ATV-5). | v3 Q9 e §2.1.1 |
| 5 | A revisão de **toda** inativação exige motivo, justificativa cifrada e confirmação em dois passos; sem reautenticação. | `avaliarInativacao` já exige as três para qualquer inativação (`permitida = completo`); o banco repete isso. Proteção mais estrita que o mínimo do Q3. | v3 Q3 |
| 6 | `down` só reverte com as sete tabelas **vazias**; com qualquer linha, recusa sem tocar em nada (`row_security = off` faz a contagem falhar em vez de mentir sob `FORCE`). | v2 §6 linha C: "reverter a migration antes de haver dado; depois só desligar consumidores". Padrão da 1068. | v2 §6 |

## Fora de escopo (sem tabela nesta PR)

Taxonomia (`TaxonomiaAlvo`), regras clínicas (`RegraClinicaRestricao`), decisões de aplicação (`DecisaoAplicacaoRestricao`, P4), pedidos de curadoria (`PedidoCuradoria`,
Q9/ATV-5), catálogo global de mapeamento, auditoria específica (a P2 usa `user_action_logs` com `redacao-auditoria.ts`), permissão por usuário (Q6, PR própria antes da P2),
serviço, rotas, UI, flags e a migração histórica do Q5.

## Banco usado na prova

PostgreSQL 15 (`postgres:15-alpine` obtida pelo espelho `mirror.gcr.io` porque o Docker Hub devolveu 429), contêiner Testcontainers efêmero em tmpfs, criado e destruído pelo teste.
Owner = superusuário do contêiner; runtime = `food06_runtime` sem superuser, sem BYPASSRLS e sem ownership. Nenhuma conexão a Neon, staging ou produção.

## Limites

- O owner do banco ainda pode desabilitar triggers no catálogo: não é imutabilidade contra o administrador (mesmo limite da 1082). Eliminação por direito do titular exige procedimento fora de banda.
- A mutação "UPDATE sem `with check`" é detectada só pelo spec estático: no banco, a trigger de identidade recusa a troca de `tenant_id` antes do RLS (defesa redundante).
- Nada aqui valida conteúdo clínico (Q1), privacidade (Q4) ou textos (ATV-7).
