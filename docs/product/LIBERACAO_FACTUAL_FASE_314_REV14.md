# Fase 314 — entrega factual e classificadores separados (REV14)

## Estado e autoridade

Decisão do proprietário em 2026-10-11; anexo original preservado com SHA256 em
`../history/phases/reviews/fase-314-rev14/`. Este contrato atualiza a REV11 sem
substituir seus originais ou reabrir CL01–10/G02 REV9 já ratificados.

Main consultada nesta rodada: `2e06bcded890826d04a61cbbb8835c5f0b6af9b6`.
PR #392 mergeada; PR Draft #394 OPEN, não integrada. Worktree inicial
`feat/fase-314-validacao-rev11`, HEAD `db4f317a0c28466aec37c8f002c14f049e902079`, limpa.
A entrega factual usa a PR394 existente, com escopo e gates A explicitados,
sem criar uma segunda PR concorrente. Candidatos B e evidências existentes são
preservados isolados, sem conexão assistencial.
A divergência CL08 da main é explicada pela PR394 ainda aberta: os seis métodos
já estão ratificados/implementados na branch. Não presumir deploy/migrations.

## Trilha A — candidata à liberação factual

Medidas originais e contexto explicitamente confirmado, idades aritméticas
informativas, snapshot cifrado v1/v2, histórico paginado, tabela e gráfico
somente de medidas originais. Sem ajuste clínico de altura, aplicação de política
de idade corrigida, curva de referência, escore Z, percentil, faixa pediátrica,
classificação/diagnóstico ou compartilhamento pediátrico no portal.

CL08 é independente de G01 pediátrico: Pollock3, Pollock7, Faulkner, Guedes,
cintura e RCQ desde18 completos, com dados/domínios/avisos de população próprios.
Sem sexo/idade não inferir; gestação conserva bloqueios; menor18 conserva medidas
sem interpretações adultas. IMC adulto permanece desde20; aos18–19 apenas IMC
factual, sem usar curvas pediátricas bloqueadas. Legados nunca recalculados.
A liberação de métodos existentes não incorpora novas tabelas/textos OMS/SISVAN.

Interface: protocolo ratificado, referências/classificações ainda não habilitadas.
Motivos v1 históricos preservados no snapshot; texto da interface descreve o
bloqueio histórico sem afirmar falta de ratificação atual. Motivos v2 não mudam.

## Trilha B — classificadores bloqueados

T04/T05/T07–T10, curvas clínicas, normalização clínica, correção/transição,
LMS/SISVAN/INTERGROWTH continuam isolados, sem consumidor assistencial ou flag
que habilite o serviço. Sem coeficientes de pesquisa/datasets pendentes no runtime.
Provas e scripts sintéticos existentes preservados. G01 não concluído.

## Gates operacionais exclusivos de A

| Gate | Estado nesta rodada | Condição de saída / evidência exigida |
| --- | --- | --- |
| A00 escopo/base | PASS | Base/HEAD/PR e anexo conferidos; sem nova migration ou dependência |
| A01 contratos e regressões | PASS local | CL08 seis métodos/17–20/sexo/ausências/gestação; snapshots, autorização, replay, projeção e gráfico factual |
| A02 CI | Conferir checks do HEAD na PR394 | Todos checks exigidos no commit candidato; CI anterior38161961023 PASS é histórico, não aprova novo HEAD |
| A03 R4 independente | BLOCKED | Revisor humano independente identificado; comentário/registro da revisão e resolução de achados. Auto-revisão, CodeQL, Semgrep, Trivy e testes não substituem |
| A04 banco local | PASS local,31 testes | PostgreSQL descartável: tenant/carteira, FORCE RLS/runtime sem BYPASSRLS/ownership, concorrência/replay, retenção e rollback |
| A05 ambientes-alvo | PARTIAL / BLOCKED | Produção: diário1068/1069, FORCE RLS/policies, triggers e role prevista conferidos somente por leitura; vínculo efetivo da aplicação, branch staging e teste integrado continuam pendentes |
| A06 autorização operacional | BLOCKED | Aceite explícito do proprietário antes de merge/migrations externas/deploy/liberação de usuários |

A é `FASE_314_ENTREGA_FACTUAL_APTA_APOS_GATES_OPERACIONAIS`, condição de
liberação e não declaração de gates PASS. Não chamar a fase clínica completa.

## Gates científicos/jurídicos exclusivos de B

G00-direitos e G01 BLOCKED: direitos OMS/INTERGROWTH/reprodução editorial SISVAN,
precisão/procedência primária e divergência55s. G02 ratificado pelo usuário;
formalização institucional é processo separado, sem inventar assinatura.
G03 desenvolvimento autorizado, G03 ativação de B BLOCKED. G04 provas técnicas
conforme relatório; G05 liberação clínica/produção BLOCKED. Pendências em
`PENDENCIAS_LIBERACAO_FASE_314_REV11.md`; não incluir G01 como pré-requisito de A.

## Revisão R4 necessária (sem atribuir independência ao autor)

Revisor deve confrontar diff completo main..PR, não só avisos REV14:
ExecutorTenant, guarda/carteira atual sob lock antes de replay, autor/role/permissão,
cifragens/fingerprint interno, allowlists de DTO/projeções e erros, cursor opaco
por último registro examinado, soft delete/transferência/revogação de acesso,
portal sem projeção pediátrica e cache `private, no-store`. Confirmar ausência de
PHI em logs/auditoria/URLs/cache, role sem bypass e retenção1069. Registrar
artefatos sanitizados em canal apropriado; não publicar dados clínicos reais.

## Banco e rollback — leitura de metadados, sem alteração externa

### Conferência de produção — 2026-10-11

Alvo confirmado pelo usuário: projeto Octaclin-produção, branch production,
banco Octaclin-db-producao. Consultas SELECT via conector Neon; nenhum acesso a
linhas de pacientes, escrita, migration, mudança de role ou infraestrutura.

- Diário `public.migrations`: AcompanhamentoGestacional1720000001068 e
  ProtegerRetencaoAvaliacoes1720000001069 presentes.
- `avaliacoes_antropometricas`, `gestacoes_pacientes`, `referencias_gestacao` e
  `consentimentos_gestacao`: RLS e FORCE RLS ativos; uma policy ALL por tabela,
  USING com coluna tenant_id/contexto app.tenant_id e WITH CHECK com esse contexto.
  Essas verificações de catálogo não substituem testes comportamentais das policies.
- Triggers trg_avaliacao_confirmada_retencao, trg_avaliacao_gestacional_imutavel e
  trg_referencia_gestacao_imutavel habilitados no catálogo.
- Role prevista `octaclin_app_producao`: LOGIN, sem SUPERUSER/BYPASSRLS, sem
  ownership das quatro tabelas, grants efetivos SELECT/INSERT/UPDATE/DELETE.
  Não comprova que o backend está conectado usando essa role; binding efetivo e
  composição das policies/funções seguem sujeitos à revisão operacional/R4.
- Staging: usuário confirmou banco neondb, mas ainda falta confirmar qual branch
  do projeto octaclin-staging: production ou Produção-real. Não consultar alvo
  ambíguo nem inferir aplicação de migrations a partir de produção.

A05 permanece incompleto. Para reproduzir, consultar somente public.migrations,
pg_class/pg_namespace, pg_policy/pg_get_expr, pg_trigger e pg_roles com
has_table_privilege, restringindo aos nomes acima. Não versionar credenciais,
IDs de infraestrutura ou registros clínicos.

Em cada alvo autorizado, obter leitura de migrations reais (1068: acompanhamento
gestacional;1069: retenção de avaliações), catálogo de tabelas/policies FORCE RLS,
role runtime sem ownership/SUPERUSER/BYPASSRLS, grants DML e trigger de retenção.
Registro na configuração/merge/CI não comprova aplicação. Validar funcionalmente
em staging autorizado com dados sintéticos; sem inserir pacientes reais como teste.
Se1068/1069 estiverem pendentes, aplicar somente fora de banda com autorização
separada e role owner, seguindo runbook existente. Nenhuma nova migration nesta rodada.

Rollback de aplicação mantém leitura v1/v2 e histórico cifrado; não retornar a
versão que perde interpretação do v2.1069.down recusa snapshots confirmados;
1068.down recusa histórico gestacional. Não remover triggers ou apagar histórico
para viabilizar rollback. Reverter somente código/interface preservando contratos
compatíveis, com plano revisado antes do rollout.

## Continuidade de fases independentes

G01 bloqueia somente consumidores das referências.315 (`score_risco` legado)
pode ser planejada/desenvolvida sem esperar G01, mantendo seus gates próprios e
compatibilidade/migration segura.316–320 também mantêm seus gates específicos;
nenhuma fase é automaticamente autorizada a implementar/ativar só por esta nota.
Fases dependentes de Z/percentis/classificações devem aguardar B. Contratos neutros
admitem ausências reais e estados bloqueados, nunca números aproximados artificiais.

## Rastreabilidade T01–T18

| Trilha | Tarefas | Limite |
| --- | --- | --- |
| A factual | Parte factual T03/T06/T12–T15, CL08 T11, T16–T18 | Gates A00–A06, revisão/CI/banco/aceite próprios |
| B clínico | G01/T01, T04/T05/T07–T10 e partes clínicas de T03/T14–T15 | G01/direitos/ativação; desenvolvimento sintético isolado permitido |
| G02 | T02 | Ratificado REV9; não reabrir com checkboxes históricos |

Checklist T01–T18 original preservado em `../../tasks/todo-fase-314.md`;
esta separação prevalece sobre frases históricas de bloqueio global.
