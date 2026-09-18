# Plano da Fase 265 - prioridade de acompanhamento explicavel

## 1. Estado e decisao de sequencia

Fase iniciada em 2026-09-17 pela definicao do contrato de produto e arquitetura.
O proprietario aceitou explicitamente a semantica e a formula apos o merge do
PR GitHub `#256` e autorizou a continuidade. O Incremento 265.1 implementa
somente o calculador de dominio puro: nenhuma migration, persistencia, consulta,
job, UI, automacao ou configuracao externa faz parte dele.

O PR 55 continua pendente como gate externo para venda publica. O proprietario
decidiu adiar sua contratacao para evitar custo neste momento. Isso nao converte
o pentest em `PASS`, nao concede GO de seguranca e nao bloqueia trabalho de
produto independente. O PR 56 continua reservado para uma futura distribuicao
do aplicativo nativo.

## 2. Problema observado

`pacientes.score_risco` e `pacientes.status_adesao` nascem com valores padrao e
podem ser digitados manualmente. Mesmo sem uma origem calculada ou explicacao,
esses campos ja influenciam lista de pacientes, prontuario, dashboard, filas de
retorno e o gatilho planejado `paciente.risco_alto`.

O nome atual permite uma interpretacao clinica que o produto nao consegue
sustentar. O calculo nao deve diagnosticar, prescrever, substituir triagem
profissional nem usar IA. A capacidade proposta mede somente **prioridade de
acompanhamento operacional**, com sinais objetivos de engajamento que o sistema
ja registra.

## 3. Decisao proposta para aceite humano

### 3.1 Semantica

- Nome visivel novo: **Prioridade de acompanhamento**.
- Finalidade: ordenar trabalho da equipe e explicar por que um paciente merece
  contato ou revisao mais cedo.
- Nao finalidade: estimar gravidade clinica, prognostico, diagnostico, urgencia
  medica ou risco de vida.
- A classificacao nunca executa mensagem, tarefa, conduta ou alteracao clinica
  automaticamente.
- O paciente nao recebe o score bruto; o portal continua sem expor
  `scoreRisco`.

### 3.2 Formula inicial recomendada

Janela de observacao: 90 dias. Resultado: inteiro entre 0 e 100, com versao da
formula registrada em cada calculo.

| Sinal objetivo | Pontos | Limite | Explicacao exibivel |
| --- | ---: | ---: | --- |
| Falta em consulta nos ultimos 90 dias | 30 por falta | 60 | `faltas_recentes` |
| Sem consulta futura e ultima consulta concluida ha mais de 60 dias | 25 | 25 | `sem_retorno_programado` |
| Formulario obrigatorio vencido ha mais de 7 dias | 10 | 10 | `formulario_vencido` |
| Ultimo registro de habitos dos ultimos 30 dias com adesao declarada abaixo de 50% | 15 | 15 | `adesao_declarada_baixa` |

O total e limitado a 100. Faixas existentes ficam preservadas no primeiro
rollout: baixa de 0 a 39, media de 40 a 69 e alta de 70 a 100.

Os sinais usam apenas datas, status e valores estruturados que ja existem.
Ficam proibidos no calculo inicial: diagnostico, texto livre, exames, medidas
antropometricas, medicacoes, conteudo de mensagens, inferencia estatistica e
qualquer modelo de IA.

### 3.3 Override humano

- Somente papel e permissao que hoje podem editar o paciente podem solicitar
  override; o servico deve revalidar tenant e escopo profissional.
- O override exige faixa escolhida, codigo de motivo fechado e justificativa
  curta. A justificativa e dado clinico protegido e nao entra em log comum.
- O override tem expiracao obrigatoria, com maximo inicial de 90 dias.
- O valor calculado continua sendo atualizado em paralelo e visivel para quem
  tem permissao, mas o valor efetivo informa que esta sob override.
- Criar, alterar, expirar ou remover override gera auditoria com ator, paciente,
  instante, faixa anterior/nova, codigo de motivo e versao da formula, sem
  copiar texto clinico para metadata.
- Expirado o override, o valor efetivo volta ao calculado sem apagar o historico.

## 4. Contrato tecnico proposto

Implementar em incrementos separados, cada um em branch e PR proprios:

1. **265.1 - Dominio puro e explicacao** [IMPLEMENTADO NESTA BRANCH]
   - calculador deterministico, sem banco e sem efeitos;
   - versao literal da formula;
   - testes de limite, janela, combinacao, cap em 100 e ausencia de sinais;
   - nenhuma integracao com dashboard ou automacoes.
2. **265.2 - Persistencia e RLS** [IMPLEMENTADO NESTA BRANCH]
   - migration aditiva para estado calculado, versao, instante e override;
   - historico append-only protegido por tenant e `FORCE ROW LEVEL SECURITY`;
   - rollback limitado: consumidores podem voltar a ignorar os campos, mas o
     historico ja criado nao deve ser apagado automaticamente;
   - migration executada somente fora de banda com role owner, apos ensaio em
     banco descartavel.
3. **265.3 - Recalculo idempotente**
   - servico e job no worker, sem efeito externo;
   - claim/lock existente, tenant explicito e idempotencia por paciente,
     versao da formula e janela;
   - falha preserva o ultimo valor valido e fica observavel sem incluir PHI.
4. **265.4 - Leitura e override auditado**
   - DTO minimo com valor efetivo, calculado, faixa, fatores fechados, versao,
     data do calculo e estado do override;
   - UI troca o rotulo ambiguo `Risco` por `Prioridade de acompanhamento`;
   - testes positivos e negativos cross-tenant/cross-profissional;
   - nenhum gatilho de automacao habilitado.

`paciente.risco_alto`, executor de automacoes e qualquer efeito automatico
continuam fora desta fase ate os incrementos PB-02/PB-03 correspondentes. O
campo legado `score_risco` nao deve ser sobrescrito antes de existir migration,
compatibilidade de leitura e rollback aprovados.

## 5. Gates da fase

- [x] Proprietario aceita explicitamente a semantica de prioridade operacional,
  e nao risco clinico.
- [x] Proprietario aceita pesos, janelas e faixas da formula inicial.
- [ ] Revisao de seguranca confirma que fatores e justificativa nao vazam PHI
  em logs, auditoria, filas ou respostas sem permissao. **Ainda nao aplicavel
  de verdade**: nenhum servico le ou escreve `prioridades_acompanhamento_*`
  neste incremento (265.2 e so schema), entao nao ha fluxo de dado para
  revisar ainda. Revisitar quando 265.3/265.4 introduzirem o job e a leitura.
- [x] Desenho da migration confirma RLS/FORCE RLS, role owner e rollback,
  **para o schema criado no incremento 265.2**: `enable row level security` +
  `force row level security` + policy `ALL`/`public` isolando por
  `tenant_id` nas duas tabelas novas (prova automatica no gate exaustivo
  `rls-isolamento-tenant.integracao.spec.ts`, que inventaria toda tabela com
  `tenant_id` a partir do catalogo do banco -- as duas tabelas novas entram
  nele sem edicao manual); migration marcada `@aplicacao fora-de-banda`
  (`validar-migracoes-fora-de-banda.mjs`); rollback assimetrico documentado
  (`down()` remove so o estado atual, nunca o historico). Execucao real fora
  de banda com role owner em producao continua pendente, fora do escopo
  desta migration em si.
- [ ] Matriz de testes cobre tenant, profissional, override, expiracao,
  idempotencia e formula versionada. **Parcialmente coberto por 265.2**:
  isolamento por tenant e a forma "tudo ou nada" do override (com expiracao
  obrigatoria) ja sao garantidos no schema e teste automaticamente pelo gate
  de RLS exaustivo. Escopo por profissional, idempotencia do job e leitura
  versionada continuam pendentes ate 265.3/265.4.

O merge do plano, isoladamente, nao substituiu o aceite. O aceite foi dado na
instrucao posterior do proprietario para seguir com a implementacao.

## 6. Validacao deste incremento

- `NA` - testes de aplicacao: nenhum codigo de producao foi alterado.
- `NA` - migration e banco: nenhuma migration foi criada ou executada.
- `PASS` - revisao/aceite humano da semantica e da formula, confirmado pelo
  proprietario apos o merge do PR `#256`.
- Obrigatorios antes do push: validacao documental, `git diff --check` e
  `pnpm security:secrets`.

## 7. Incremento 265.1 - implementacao e evidencia

Implementado em
`octaclin-backend/src/modulos/pacientes/dominio/prioridade-acompanhamento.ts`,
sem dependencias de NestJS, TypeORM, relogio global ou infraestrutura. O
chamador fornece explicitamente o instante de referencia e somente estruturas
minimas: ids opacos, datas, obrigatoriedade e percentual de adesao declarado.

Propriedades do contrato:

- versao literal `1.0.0` acompanha todo resultado;
- janelas moveis avaliadas por instante UTC, com limites de 90 e 30 dias
  inclusivos; `mais de 60` e `mais de 7` permanecem estritos;
- faltas e formularios vencidos sao deduplicados por identificador;
- fatores saem em ordem estavel, com codigos fechados e sem texto livre;
- score limitado a 100 e faixas preservadas (`0-39`, `40-69`, `70-100`);
- datas invalidas e adesao fora de `0-100` falham explicitamente;
- nenhum valor e persistido, publicado, exibido ou usado para efeito externo.

Validacoes desta branch:

- `PASS` - TDD RED: spec falhou por ausencia do modulo antes da implementacao;
- `PASS` - spec focada, 7/7 testes;
- `PASS` - typecheck do backend;
- `PASS` - build e verificacao do artefato do backend;
- `PASS` - suite completa do backend, 186 suites e 1.749 testes; 37 skips
  preexistentes;
- `NA` - banco, migration, RLS, job, UI e ambiente externo, fora do incremento.

## 8. Incremento 265.2 - implementacao e evidencia

Migration `1720000001046-AdicionarPrioridadeAcompanhamento` (classe
`AdicionarPrioridadeAcompanhamento1720000001046`), registrada em
`opcoes-typeorm.ts` junto com duas entidades TypeORM novas
(`PrioridadeAcompanhamentoPacienteOrm`,
`PrioridadeAcompanhamentoHistoricoOrm`) em
`octaclin-backend/src/modulos/pacientes/infraestrutura/`. So schema: nenhum
servico, controlador ou job le ou escreve estas tabelas neste incremento --
decisao deliberada para manter o risco desta migration isolado do risco de
logica de negocio, que chega em 265.3/265.4.

Duas tabelas:

- `prioridades_acompanhamento_paciente`: uma linha por paciente
  (`unique (tenant_id, paciente_id)`) com o ultimo estado calculado (`score`
  entre 0 e 100, `faixa` em `baixa/media/alta`, `fatores` jsonb, `versao_formula`,
  `calculado_em`) e o override humano em vigor, se houver. Os cinco campos de
  override (`override_faixa`, `override_codigo_motivo`,
  `override_justificativa_criptografada`, `override_expira_em`,
  `override_ator_usuario_id`, `override_criado_em`) sao protegidos por uma
  check constraint "tudo ou nada": existem juntos ou nenhum, tornando
  mecanismo o requisito do plano de que "o override tem expiracao
  obrigatoria" (secao 3.3). A justificativa e cifrada (`bytea`), nunca texto
  livre em coluna legivel. Indice parcial em `override_expira_em` para o
  futuro job de expiracao (265.3) nao precisar de table scan.
- `prioridades_acompanhamento_historico`: append-only, uma linha por evento
  (`calculo`, `override_criado`, `override_alterado`, `override_expirado`,
  `override_removido`). Protegida pelo mesmo mecanismo de trigger de
  `user_action_logs` (migration 1038): uma funcao que rejeita `update` e
  `delete` por linha e `truncate` por statement, com `enable always` para
  continuar valendo mesmo em `session_replication_role = 'replica'`. Nem o
  dono da tabela consegue mutar por SQL comum.

Ambas com `enable row level security` + `force row level security` e policy
unica `using`/`with check (tenant_id = nullif(current_setting('app.tenant_id',
true), '')::uuid)` -- a mesma expressao que
`rls-isolamento-tenant.integracao.spec.ts` reconhece automaticamente. Esse
teste inventaria **toda** tabela publica com coluna `tenant_id` a partir do
catalogo do Postgres (`pg_class`/`pg_attribute`), entao as duas tabelas novas
entram no gate exaustivo de RLS sem precisar editar o arquivo de teste.

Rollback deliberadamente assimetrico: `down()` remove
`prioridades_acompanhamento_paciente` (projecao recomputavel, sem perda real),
mas nunca `prioridades_acompanhamento_historico` -- cumprindo literalmente "o
historico ja criado nao deve ser apagado automaticamente" (secao 4, item 2 do
plano). Revertida a migration, o historico fica orfa (sem escritor), nao
vazia.

`override_codigo_motivo` permanece `varchar` livre nesta migration: o
conjunto fechado de codigos de motivo ainda nao foi definido pelo produto
(secao 3.3 so diz "codigo de motivo fechado", sem enumerar os valores).
Fechar esse conjunto e validar contra ele e trabalho de aplicacao do
incremento 265.4, quando o fluxo de escrita do override for implementado --
nao antecipado aqui para nao inventar decisao de produto que ainda nao foi
tomada.

### Por que nenhuma migration foi executada nesta sessao

Confirmando banco, branch e role alvo antes de qualquer execucao (regra do
`AGENTS.md`): o ambiente de execucao remoto usado para este incremento nao
tem daemon Docker nem instancia Postgres disponiveis, entao a migration nao
foi rodada aqui contra banco nenhum -- nem descartavel nem de qualquer outro
tipo. O "ensaio em banco descartavel" que o plano exige acontece de forma
real no job `Backend NestJS` do OctaClin CI: ele sobe um Postgres
`timescale/timescaledb-ha:pg15` descartavel como service container, roda
`pnpm run migration:run` contra ele (aplica esta migration de verdade) e em
seguida `pnpm test:rls:testcontainers`, que confirma RLS/FORCE RLS e a policy
de isolamento com uma role restrita (sem `BYPASSRLS`, sem ownership). A
aplicacao real em producao continua exigindo o procedimento fora de banda com
role owner do `RUNBOOK_PRODUCAO.md`, que nao foi executado e nao faz parte
deste incremento.

Validacoes desta branch:

- `PASS` - TDD RED: spec da migration falhou por ausencia do arquivo antes da
  implementacao (`Cannot find module`);
- `PASS` - spec da migration, 11/11 testes (estrutura das duas tabelas,
  constraint de score, constraint "tudo ou nada" do override, indice parcial
  de expiracao, RLS/FORCE RLS e policy nas duas tabelas, trigger append-only,
  declaracao `@aplicacao fora-de-banda`, reversibilidade assimetrica do
  `down()`);
- `PASS` - `node scripts/validar-migracoes-fora-de-banda.mjs` (59 migrations
  declaradas, a nova entra nas 57 que exigem role owner);
- `PASS` - typecheck do backend;
- `PASS` - build e verificacao do artefato (`dist/main.js`);
- `PASS` - suite completa do backend, 188 suites e 1.766 testes; 31 skips
  preexistentes;
- `NA` - execucao real da migration contra qualquer banco (sem Docker/Postgres
  neste ambiente); fica para o `Backend NestJS` do OctaClin CI e, em
  producao, para o procedimento fora de banda do runbook;
- `NA` - servico, job, UI e RLS aplicado a um fluxo de leitura/escrita real,
  fora deste incremento (chegam em 265.3/265.4).
