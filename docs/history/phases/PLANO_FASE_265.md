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
3. **265.3 - Recalculo idempotente** [IMPLEMENTADO NESTA BRANCH]
   - servico e job no worker, sem efeito externo;
   - claim/lock existente, tenant explicito e idempotencia por paciente,
     versao da formula e janela;
   - falha preserva o ultimo valor valido e fica observavel sem incluir PHI.
4. **265.4 - Leitura e override auditado** [backend implementado em
   `feat/fase265-leitura-override`; UI implementada em
   `feat/fase265-ui-prioridade-acompanhamento`, secao 11]
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
- [x] Revisao de seguranca confirma que fatores e justificativa nao vazam PHI
  em logs, auditoria, filas ou respostas sem permissao. **Fechado por
  265.4**: a rota de leitura devolve `fatores`/`score`/`faixa` (dado
  estruturado, sem texto livre) so para quem tem `pacientes.ler` e escopo
  de tenant/profissional ja revalidado; a justificativa do override nunca
  sai do banco (nem cifrada) em nenhuma resposta HTTP. Na trilha generica
  de auditoria (`user_action_logs`), o gate `validar-redacao-auditoria.mjs`
  reprovou a primeira tentativa por gravar `codigoMotivo` (texto livre sem
  enum fechado) em claro -- corrigido removendo esse campo do metadata da
  trilha generica (ele fica so no historico de dominio, que tem RLS
  proprio); `faixa` e `origemValorEfetivo` foram registrados como
  vocabulario fechado no gate, com justificativa escrita. A justificativa
  do override em si nunca aparece em nenhum dos dois logs.
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
- [x] Matriz de testes cobre tenant, profissional, override, expiracao,
  idempotencia e formula versionada. Isolamento por tenant e a forma "tudo
  ou nada" do override (com expiracao obrigatoria) sao garantidos no schema
  e testados automaticamente pelo gate de RLS exaustivo (265.2);
  idempotencia por paciente, versao da formula e janela (dia UTC) tem 9
  testes dedicados no servico de recalculo (265.3); escopo por profissional
  (paciente fora do escopo nao pode ler nem alterar override), criacao,
  alteracao (`override_alterado` != `override_criado`), remocao e expiracao
  lazy na leitura (com evento `override_expirado` no historico) tem 10
  testes dedicados no servico de leitura/override (265.4). Cada incremento
  fechou a parte da matriz que dependia dele existir.

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

## 9. Incremento 265.3 - implementacao e evidencia

`ServicoRecalculoPrioridadeAcompanhamento`
(`octaclin-backend/src/modulos/pacientes/aplicacao/`) le os sinais de cada
paciente ativo do tenant (faltas em `agenda_consultas` nos ultimos ~100 dias,
ultima consulta concluida e proxima consulta futura, ultimo registro de
habitos decifrado), chama o calculador puro de 265.1
(`calcularPrioridadeAcompanhamento`) e persiste o resultado nas tabelas de
265.2. `ProcessadorRecalculoPrioridadeAcompanhamento` agenda isso uma vez por
dia (`@Cron('0 9 * * *')`, mesmo horario do recall de inatividade) usando
`executarPorTenantAtivo` -- o claim/lock por advisory lock Postgres ja
existente (`rodada-por-tenant.ts`), reaproveitado tal como esta, sem nenhum
mecanismo de trava novo. So roda no processo `worker`/`all`
(`deveExecutarProcessadores()`), nunca no `web`, mesmo padrao dos demais
processadores agendados do repositorio.

### Gap real encontrado: sinal `formulario_vencido` nao foi wireado

A formula 265.1 pontua "formulario obrigatorio vencido ha mais de 7 dias",
mas nenhuma entidade do modulo de questionarios (`QuestionarioOrm`,
`EnvioQuestionarioOrm`, `AgendamentoQuestionarioOrm`) tem hoje um campo que
diga se um questionario e obrigatorio -- o conceito simplesmente nao existe
no schema atual. Assumir que todo envio conta (ou que nenhum conta) seria
inventar uma decisao de produto que ainda nao foi tomada, o mesmo cuidado ja
registrado para `override_codigo_motivo` na migration 265.2. Este incremento
**wireia os outros tres sinais normalmente** (faltas recentes, sem retorno
programado, adesao declarada baixa) e **omite `formularios` de proposito**
na chamada ao calculador -- o campo e opcional no contrato de 265.1 e
contribui zero pontos quando ausente, entao o job nunca calcula um score
errado, so um score que ainda nao inclui esse sinal. Fechar esse gap exige
decisao de produto explicita (por exemplo, um campo `obrigatorio` em
`QuestionarioOrm` com sua propria migration) antes de qualquer codigo.

### Idempotencia e tratamento de falha

Idempotencia por paciente, versao da formula e janela (dia UTC, a mesma
cadencia do `@Cron` diario): antes de gravar um evento `calculo` no
historico, o servico busca o ultimo evento `calculo` para o mesmo
(`tenantId`, `pacienteId`, `versaoFormula`) e so grava um novo se esse
ultimo nao for de hoje. O estado atual (`prioridades_acompanhamento_paciente`)
e sempre atualizado (e um cache), mas o historico nunca ganha uma segunda
linha de `calculo` por dia, mesmo que o job rode duas vezes (retry,
redeploy). Os campos de override do estado atual nunca sao tocados pelo job:
o registro e lido inteiro do banco, so os campos calculados sao
reatribuidos, e `save()` grava os campos de override de volta exatamente
como estavam. Expirar override e o fluxo de leitura com o "valor efetivo"
continuam fora deste incremento, atribuidos a 265.4.

Falha por paciente (dado corrompido, excecao do calculador de dominio por
entrada invalida) e isolada num `try/catch` por paciente dentro do loop do
tenant: o paciente seguinte continua sendo processado, o log de falha traz
so `tenantId`, `pacienteId` e `erro.name` -- nunca conteudo decifrado nem
`fatores`/`score` -- e o ultimo valor valido em
`prioridades_acompanhamento_paciente` permanece intacto (nenhuma escrita
parcial chega ao banco quando o catch dispara). Uma falha ao decifrar
`valorCriptografado` do registro de habitos e tratada separadamente e de
forma mais branda, no mesmo padrao ja usado por `lerTituloTimeline`/
`lerValorDiario` em `ServicoPacientes`: o sinal de adesao fica ausente, mas
o restante do calculo do paciente continua normalmente -- um humor
ilegivel nao deveria apagar o calculo inteiro do paciente.

Validacoes desta branch:

- `PASS` - TDD RED: as duas specs novas falharam por ausencia dos modulos
  antes da implementacao (`Cannot find module`);
- `PASS` - `servico-recalculo-prioridade-acompanhamento.spec.ts`, 9/9 testes
  (tenant explicito sem vazar para outro tenant; grava estado + historico na
  primeira vez; idempotencia no mesmo dia; novo evento no dia seguinte;
  override preservado; falha em um paciente nao interrompe os demais e
  preserva o ultimo valor valido; ausencia deliberada do fator
  `formulario_vencido`; adesao baixa calculada a partir do registro
  decifrado; registro de habitos ilegivel so remove aquele sinal, sem
  derrubar o paciente);
- `PASS` - `processador-recalculo-prioridade-acompanhamento.spec.ts`, 1/1
  teste (recalcula todos os tenants ativos via `executarPorTenantAtivo`);
- `PASS` - `modulo-pacientes.spec.ts` (modulo continua carregando com as
  duas novas entidades, servico e processador registrados);
- `PASS` - typecheck do backend;
- `PASS` - build e verificacao do artefato (`dist/main.js`);
- `PASS` - suite completa do backend, 190 suites e 1.776 testes; 31 skips
  preexistentes;
- `NA` - migration, DDL ou schema novo (nenhum: 265.3 so consome o schema
  que 265.2 ja criou);
- `NA` - UI, rota HTTP ou leitura do valor calculado por um cliente (265.4).

## 10. Incremento 265.4 - implementacao e evidencia (so backend)

Tres metodos novos em `ServicoPacientes`
(`octaclin-backend/src/modulos/pacientes/aplicacao/servico-pacientes.ts`),
reaproveitando `garantirPacienteExiste` (mesma fronteira de tenant/escopo
profissional de todo o resto do modulo, ja provada nos testes existentes) e
tres rotas novas em `ControladorPacientes`:

- `GET /pacientes/:id/prioridade-acompanhamento` (permissao padrao da
  classe, `pacientes.ler`): devolve `valorCalculado` (score, faixa,
  fatores, versao, data do calculo -- o que 265.3 persistiu, nunca
  recalculado aqui) e `valorEfetivo` (a faixa que deve orientar o trabalho
  da equipe agora: a do override quando ha um em vigor, senao a calculada).
  Sem calculo ainda (job nao rodou para o paciente), devolve o mesmo
  default que o calculador produz sem sinais (`score 0`, `baixa`) em vez de
  404 -- ausencia de calculo e um estado valido de paciente novo, nao um
  erro.
- `POST /pacientes/:id/prioridade-acompanhamento/override` (`pacientes.gerenciar`,
  a mesma permissao de toda mutacao de paciente -- secao 3.3 do plano):
  cria ou substitui o override em vigor. `expiraEm` e obrigatorio e limitado
  a 90 dias (`BadRequestException` fora da janela ou no passado). A
  justificativa e cifrada antes de tocar o banco. O evento gravado no
  historico e `override_criado` na primeira vez e `override_alterado`
  quando ja havia um override ativo (nao expirado) no momento da troca --
  a distincao que a secao 3.3 pede ("Criar, alterar, expirar ou remover
  override gera auditoria").
- `DELETE /pacientes/:id/prioridade-acompanhamento/override` (`pacientes.gerenciar`):
  remove o override em vigor, `404` se nao houver nenhum. O valor efetivo
  volta ao calculado sem apagar o historico ja gravado -- mesmo principio
  do rollback assimetrico da migration 265.2.

**Expiracao lazy na leitura**: a rota `GET` verifica se o override
armazenado ja passou de `overrideExpiraEm`; se sim, grava `override_expirado`
no historico, limpa os cinco campos de override do estado atual e devolve o
valor calculado como efetivo -- tudo na mesma chamada de leitura, sem
precisar de um job dedicado so para isso. Nao existe outro ponto no plano
responsavel por essa transicao (265.3 deliberadamente nao mexe em override),
entao a leitura e o lugar certo: e onde o sistema primeiro percebe, de
qualquer jeito, que o override venceu.

### Auditoria: dois caminhos, dois papeis

O historico de dominio (`prioridades_acompanhamento_historico`, RLS
proprio, append-only) grava o motivo em texto curto (`codigoMotivo`) porque
e a fonte de verdade operacional para reconstruir "por que esta faixa
estava em vigor". A trilha generica (`user_action_logs`, usada por todo o
resto do backend) **nao** grava `codigoMotivo`: a primeira tentativa foi
reprovada pelo gate `validar-redacao-auditoria.mjs` porque `codigoMotivo`
ainda nao tem enum fechado no DTO (secao 3.3: "codigo de motivo fechado"
que o produto nunca definiu -- mesmo gap ja registrado na migration 265.2) e
o gate ja tem um precedente explicito para exatamente este caso
(`motivotecnico`, cujo comentario diz que `motivo` livre "continua virando
`possuiMotivo`" para nao liberar texto digitado por pessoa em call sites
futuros com o mesmo nome de chave). A correcao seguiu o mesmo padrao: a
trilha generica so recebe `faixa` (enum fechado) e `expiraEm` (timestamp,
ja um padrao existente); `codigoMotivo` e a justificativa ficam
exclusivamente no historico de dominio, nunca na trilha generica.

### O que ficou fora deste incremento, de proposito

- **UI ("trocar o rotulo Risco por Prioridade de acompanhamento")**: o
  texto "Risco" hoje em `octaclin-web/components/pacientes/prontuario-paciente.tsx:953`
  mostra `pacientes.score_risco` (o campo legado, digitado a mao, que este
  incremento nao apaga nem sobrescreve). Uma troca literal do texto
  mantendo a mesma fonte de dado deixaria a tela mais enganosa, nao menos:
  chamaria o numero manual de "Prioridade de acompanhamento", o nome que a
  Fase 265 existe para reservar a um valor de verdade calculado. Fazer essa
  troca direito exige buscar o DTO novo (BFF + cliente + componente), que e
  trabalho de frontend a parte, nao uma renomeacao de uma linha. Registrado
  aqui como pendencia explicita, nao escondido.
- Gatilho de automacao (`paciente.risco_alto`) continua desligado, como em
  todo o resto da fase -- nenhum codigo deste incremento o aciona.
- Fechar o enum de `codigoMotivo` -- ainda depende de decisao de produto,
  mesmo gap do 265.3.

Validacoes desta branch:

- `PASS` - TDD RED: os testes novos falharam por metodo inexistente em
  `ServicoPacientes` antes da implementacao;
- `PASS` - 10/10 testes novos em `servico-pacientes.spec.ts` (sem calculo
  ainda; sem override o efetivo e o calculado; com override ativo o
  efetivo e o override e o calculado continua visivel; override expirado
  expira sozinho na leitura e registra o evento; cria override cifrando a
  justificativa e sem vaza-la; alterar override ativo registra
  `override_alterado`; rejeita expiracao alem de 90 dias; rejeita
  expiracao no passado; remove override e registra `override_removido`;
  paciente fora do escopo do profissional nao le nem altera);
- `PASS` - 4/4 testes novos em `controlador-pacientes.spec.ts` (audita
  leitura sem vazar codigo de motivo/justificativa; audita override sem
  gravar codigoMotivo/justificativa na trilha generica; audita remocao;
  as duas mutacoes protegidas por `pacientes.gerenciar`, leitura na
  permissao padrao da classe);
- `PASS` - `pnpm test:redacao-auditoria` (24/24, incluindo a cobertura das
  duas chaves novas);
- `PASS` - `node --test scripts/validar-guardas-controladores.spec.mjs`
  (11/11);
- `PASS` - typecheck do backend;
- `PASS` - build e verificacao do artefato (`dist/main.js`);
- `PASS` - suite completa do backend, 190 suites e 1.821 testes; 31 skips
  preexistentes;
- `NA` - migration, DDL ou schema novo;
- `NA` - UI, BFF ou cliente web (pendencia explicita acima).

## 11. Incremento 265.4 - fechamento da pendencia de UI

Fecha a pendencia explicita registrada na secao 10: a troca do rotulo
"Risco" pela "Prioridade de acompanhamento" no prontuario do paciente,
buscando o valor efetivo real do endpoint de leitura do 265.4 em vez de
renomear o texto sobre o campo legado `score_risco`. Implementado em
2026-09-18 em branch dedicada `feat/fase265-ui-prioridade-acompanhamento`.

Escopo:

- Novo BFF `octaclin-web/app/api/pacientes/[id]/prioridade-acompanhamento/route.ts`
  (`GET` apenas), no mesmo padrao das demais rotas do prontuario:
  `requisitarBackendAutenticado` para a chamada ao backend com sessao, e
  `ErroSessaoAusente` mapeado para `401` sem vazar detalhe interno.
- `obterPrioridadeAcompanhamento` novo em `octaclin-web/lib/prontuario-api.ts`,
  tipado (`PrioridadeAcompanhamentoApi`, `FaixaPrioridadeAcompanhamentoApi`),
  seguindo o padrao dos demais clientes de sub-recurso desta tela
  (`cache: 'no-store'`, `lancarErroApi` em resposta nao-ok).
- `ProntuarioPaciente` (`components/pacientes/prontuario-paciente.tsx`)
  troca a linha "Risco {score} pontos - {statusAdesao}" por "Prioridade de
  acompanhamento: {faixa} - {statusAdesao}", com o sufixo "(ajustada
  manualmente)" quando `valorEfetivo.origem === 'override'`.

Decisao de arquitetura relevante: a busca da prioridade **nao** entra no
`Promise.all` do `carregar()` principal. Uma primeira versao fazia isso e
quebrou o padrao ja estabelecido nesta tela (cada sub-recurso --
materiais, anexos, evolucoes, tarefas -- tem seu proprio `carregarX` com
estado de falha independente, para uma falha isolada nao derrubar o
prontuario inteiro). Bundlar a chamada nova no `carregar()` principal fazia
qualquer mock ou resposta ausente para o endpoint novo virar uma falha de
carregamento da tela inteira -- confirmado ao rodar a suite Playwright
existente, onde `fase-249-densidade-responsividade.spec.mjs` tem um
catch-all de rota que devolve `[]` para qualquer caminho nao mapeado
explicitamente, e o componente tentava ler `valorEfetivo.faixa` de um
array, quebrando o render (`TypeError: Cannot read properties of
undefined`). Corrigido de duas formas, as duas necessarias: (1)
`carregarPrioridadeAcompanhamento` virou um efeito independente, com o
proprio estado, que nunca marca `falhaCarregamento` -- uma falha ou
ausencia de mock mostra "-" no lugar da faixa; (2) o render tambem passou a
usar encadeamento opcional ate `valorEfetivo` (`prioridadeAcompanhamento?.valorEfetivo`),
para tolerar uma resposta 200 com formato inesperado sem lancar excecao --
o endpoint e um limite de sistema (rede), nao uma garantia interna.

Fora do escopo desta branch, de proposito: nenhuma UI de criacao, edicao
ou remocao de override. O plano so pede a troca do rotulo; criar uma
interface para o fluxo de override (`POST`/`DELETE .../override`) e
decisao de produto separada, nao incluida aqui.

Validacoes desta branch:

- `PASS` - `pnpm typecheck` (sem erros);
- `PASS` - `pnpm lint` (0 erros; os avisos pre-existentes de
  `react-hooks/set-state-in-effect` no arquivo seguem o mesmo padrao ja
  presente nos demais `useEffect` desta tela, nenhum novo introduzido);
- `PASS` - TDD do BFF novo: `test-prioridade-acompanhamento-bff.mjs` /
  `prioridade-acompanhamento-bff.spec.ts` (2/2 -- sessao ausente recusada
  com `401` antes de chamar o backend; paciente com barra no id codificado
  corretamente na URL de encaminhamento), seguindo o mesmo padrao de
  `test-prontuario-timeline-bff.mjs`;
- `PASS` - `pnpm test:authz` completo (cadeia com o teste novo incluido);
- `PASS` - suite Playwright `console-regression.spec.mjs`, bloco
  "prontuario do paciente" completo (54/54; mock novo do endpoint
  adicionado a `prepararProntuarioMockado`, asserção do texto antigo
  "Risco 82 pontos" atualizada para "Prioridade de acompanhamento: Alta");
- `PASS` - `fase-249-densidade-responsividade.spec.mjs` completo (6/6, apos
  adicionar o mock explicito do endpoint novo e a correcao defensiva no
  render -- via as duas correcoes, nao uma so);
- `PASS` - `acessibilidade.spec.mjs` completo (268/268, incluindo o teste
  de detalhe do paciente que roda checagem de axe);
- `PASS` - `fase-248-estados-recuperacao.spec.mjs`,
  `fase-252-navegacao-descoberta.spec.mjs`, `fase-254-pacientes.spec.mjs`,
  `reflow-visual.spec.mjs` e `aviso-acesso-negado.spec.mjs` (92/92 no
  conjunto);
- `PASS` - `jornadas-criticas.spec.mjs` (roda dentro do conjunto acima,
  sem regressao);
- `PASS` - `git diff --check`;
- `PASS` - `pnpm security:secrets` ("Nenhum secret real identificado pelos
  padroes locais");
- `NA` - migration, DDL, RLS ou schema (nenhuma mudanca de backend nesta
  branch);
- `NA` - UI de override (fora do escopo, secao acima).

Nota de ambiente: os testes Playwright locais precisaram apontar
`launchOptions.executablePath` para o binario Chromium ja presente no
ambiente (`/opt/pw-browsers/chromium`), porque a versao do
`@playwright/test` do projeto esperava um `chromium_headless_shell` mais
novo que nao estava pre-instalado. Usado um `playwright.config.mjs` local,
descartavel, apenas para rodar a suite; nao versionado nesta branch.

## 12. Incremento 265.5 - enum fechado de motivo e formula v1.1.0

Decisao de produto explicita do dono (2026-09-18), fechando dois gaps
documentados desde 265.2/265.3: o enum de `codigoMotivo` do override e o
sinal `formulario_vencido` da formula. Implementado em branch dedicada
`feat/fase265-enum-motivo-formula-v2`, so backend.

### Enum fechado de `codigoMotivo`

Vocabulario aprovado, exportado como
`CODIGOS_MOTIVO_OVERRIDE_PRIORIDADE_ACOMPANHAMENTO` em
`prioridade-acompanhamento.ts` (dominio, mesmo arquivo da formula, por ser
vocabulario do dominio de prioridade, nao so do DTO):

- `evento_recente_nao_capturado`
- `informacao_externa_relevante`
- `acompanhamento_intensificado`
- `acompanhamento_reduzido`
- `correcao_de_dado`
- `outro`

`SolicitarOverridePrioridadeAcompanhamentoDto.codigoMotivo` trocou
`@IsString/@MinLength/@MaxLength` por `@IsIn(CODIGOS_MOTIVO_...)`, tipado
com o union `CodigoMotivoOverridePrioridadeAcompanhamento` -- a mesma
fronteira (`ValidationPipe` global do Nest) que ja rejeita `faixa` fora de
`baixa/media/alta` agora rejeita `codigoMotivo` fora do enum, incluindo
`outro` mal-empregado como se fosse um campo de texto (`outro` e uma
categoria fechada como as demais; o detalhe continua exclusivamente na
`justificativa`, cifrada). Nao houve mudanca na coluna do banco
(`override_codigo_motivo varchar(60)`, migration 1046): o enum aprovado
cabe folgado nesse tamanho e a validacao de aplicacao ja e a fronteira
correta, sem ganho em duplicar como `check` de banco. Os tipos TypeScript
das duas entidades ORM (`PrioridadeAcompanhamentoPacienteOrm`,
`PrioridadeAcompanhamentoHistoricoOrm`) e da resposta
(`PrioridadeAcompanhamentoRespostaDto.override.codigoMotivo`) foram
estreitados do `string` livre anterior para o union fechado.

Como agora e vocabulario fechado (nao mais texto livre sem enum), o gate
`validar-redacao-auditoria.mjs` passou a aceitar `codigoMotivo` na trilha
generica (`user_action_logs`) -- chave `codigomotivo` adicionada a
`CHAVES_SEGURAS` com a justificativa escrita. O controlador
(`solicitarOverridePrioridadeAcompanhamento`) agora inclui `codigoMotivo`
no `metadados` do evento `override_solicitado`, junto de `faixa` e
`expiraEm`; a `justificativa` continua nunca entrando ali, exclusivamente
cifrada no historico de dominio.

TDD: `dtos.spec.ts` novo (arquivo nao existia para o modulo de pacientes),
usando `validate()` do `class-validator` direto na classe do DTO -- mesmo
padrao ja usado em `dtos-agendamento-publico.spec.ts`. Três testes:
aceita cada um dos seis codigos do enum; rejeita um codigo plausivel fora
do enum (`decisao_clinica`, o codigo livre usado nos fixtures antes desta
branch); rejeita string vazia. Os fixtures de `servico-pacientes.spec.ts`
e `controlador-pacientes.spec.ts` que usavam codigos inventados
(`decisao_clinica`, `motivo_anterior`, `motivo_novo`, `motivo`) foram
atualizados para codigos reais do enum aprovado.

### Formula v1.1.0: remocao de `formulario_vencido`

`VERSAO_FORMULA_PRIORIDADE_ACOMPANHAMENTO` mudou de `1.0.0` para `1.1.0`.
O fator `formulario_vencido`, o tipo `FormularioParaPrioridadeAcompanhamento`,
o campo `formularios` de `EntradaPrioridadeAcompanhamento` e a funcao
`contarFormulariosVencidos` foram removidos do calculador. Decisao de
produto explicita: o dominio de questionarios nao tem hoje o conceito de
"obrigatorio" que o fator exigia, e criar esse campo so para alimentar a
formula seria modelar comportamento novo por conveniencia de calculo, nao
por necessidade real do dominio. Pode voltar numa formula futura (`1.2.0`
ou posterior) se e quando o produto adquirir esse conceito.

Formula efetiva em `1.1.0`:

- faltas recentes: 30 por falta unica na janela de 90 dias, maximo 60;
- sem retorno programado (>60 dias sem consulta concluida e sem proxima
  agendada): 25;
- adesao declarada baixa (<50% no registro mais recente dos ultimos 30
  dias): 15;
- total continua limitado a 100;
- faixas inalteradas: baixa 0-39, media 40-69, alta 70-100.

`ServicoRecalculoPrioridadeAcompanhamento` (265.3) ja nunca passava
`formularios` ao calculador (gap documentado desde 265.3), entao nenhuma
mudanca de codigo foi necessaria ali alem do comentario, que foi reescrito
para nao descrever mais um gap que deixou de existir.

**Compatibilidade com historico existente**: um registro em
`prioridades_acompanhamento_historico` com `versaoFormula: '1.0.0'` pode
ter pontuado `formulario_vencido`; um registro `1.1.0` nunca pontua esse
fator. A leitura (`obterPrioridadeAcompanhamento`, 265.4) devolve o que
esta persistido em `prioridades_acompanhamento_paciente.versaoFormula` sem
recalcular, entao um paciente cujo ultimo calculo seja `1.0.0` (produzido
antes deste deploy) so mostra a formula nova depois do proximo
`@Cron` do job de recalculo (265.3) rodar para ele -- nenhuma migration de
dado foi feita nem pedida para forcar isso, por decisao explicita ("nao
crie migration de questionario" nesta autorizacao, e nenhuma outra
migration foi pedida para o historico).

TDD: `prioridade-acompanhamento.spec.ts` -- removido o teste dedicado a
`formulario_vencido` e a asserção equivalente no teste de rejeição de
formularios invalidos; o teste "combina fatores" recalculado sem o fator
(a combinacao que antes somava faltas+formulario para 70 agora usa
faltas+adesao para 75, mesma cobertura de cruzar o limiar de `alta` com
dois fatores). Novo teste garante o vocabulario exportado do enum de
motivo. `servico-recalculo-prioridade-acompanhamento.spec.ts` teve os
fixtures de `versaoFormula` atualizados de `1.0.0` para `1.1.0` (mesmo
comportamento testado, versao real).

Validacoes desta branch:

- `PASS` - TDD dos itens acima;
- `PASS` - suite completa do backend: 191 suites, 1.793 testes, 31 skips
  preexistentes (nenhum novo skip);
- `PASS` - `pnpm --dir octaclin-backend typecheck`;
- `PASS` - `pnpm --dir octaclin-backend build` (`dist/main.js` validado);
- `PASS` - `pnpm test:redacao-auditoria` (24/24, incluindo a chave nova
  `codigomotivo`);
- `PASS` - `node --test scripts/validar-guardas-controladores.spec.mjs`
  (11/11);
- `PASS` - `git diff --check`;
- `PASS` - `pnpm security:secrets`;
- `NA` - migration, DDL ou schema novo (nenhuma coluna mudou de tipo ou
  tamanho; a validacao e inteiramente de aplicacao).

## 13. Incremento 265.6 - UI de gerenciamento de override

Decisao de produto explicita do dono (2026-09-18): o profissional pode
gerenciar o override de prioridade de acompanhamento pela interface, nao
so pela API. Implementado em branch dedicada
`feat/fase265-ui-override-prioridade-acompanhamento`, consumindo
inteiramente as rotas ja existentes do backend (265.4/265.5) -- nenhuma
mudanca de backend nesta branch.

### Escopo

Novo componente `octaclin-web/components/pacientes/prioridade-acompanhamento.tsx`
(`SecaoPrioridadeAcompanhamento`), renderizado na aba "Resumo" do
prontuario, logo apos "Contexto operacional". Mostra, sempre separados:

- prioridade calculada (faixa + score + lista de fatores que explicam o
  calculo, com quantidade quando aplicavel);
- prioridade efetiva, com origem explicita ("calculada automaticamente" ou
  "ajustada manualmente");
- validade do override quando um esta em vigor.

Acao "Ajustar prioridade" (visivel somente com `pacientes.gerenciar`, a
mesma condicao ja usada para as demais mutacoes desta tela) abre um
`Modal` (`components/ui/modal.tsx`, o mesmo componente generico ja usado
por `PerfilCadastroPaciente` -- nao um painel inline, para nao competir por
espaco na faixa de acoes sticky) com: select de faixa (baixa/media/alta),
select de motivo usando exclusivamente o enum fechado aprovado na 265.5
(`CODIGOS_MOTIVO_OVERRIDE_PRIORIDADE_ACOMPANHAMENTO`, reexportado do
cliente web), textarea de justificativa e campo de data de expiracao
(`type="date"`, `min`/`max` client-side refletindo a regra de 1 a 90 dias
que o backend ja aplica -- client-side e so UX, o backend continua a
fronteira autoritativa). Nao ha campo para score, fatores ou versao da
formula: esses continuam somente-leitura, exibidos fora do formulario.
Com override ja ativo, o botao de submissao muda de "Aplicar ajuste" para
"Salvar alteração" e aparece "Remover ajuste", que abre uma
`ModalConfirmacao` separada antes de chamar o `DELETE`.

Microcopy seguiu a sugestao do dono do produto: "A prioridade ajuda a
organizar quais pacientes podem precisar de acompanhamento mais cedo. O
ajuste manual e temporario e nao altera o calculo automatico do sistema."
-- presente tanto na secao quanto na descricao do modal. Nenhum texto
trata o ajuste como decisao clinica automatizada nem usa "risco clinico".

### BFF e cliente

Novo `POST`/`DELETE` em
`app/api/pacientes/[id]/prioridade-acompanhamento/override/route.ts`,
mesmo padrao das demais rotas do prontuario
(`requisitarBackendAutenticado`, `ErroSessaoAusente` -> 401), com a
adicao de `exigirPermissaoBff('pacientes.gerenciar')` antes de chamar o
backend -- mesmo padrao ja usado em
`tarefas-acompanhamento/[tarefaId]/route.ts` (`PATCH`), a unica outra
rota de pacientes que faz essa checagem no BFF. `solicitarOverridePrioridadeAcompanhamento`
e `removerOverridePrioridadeAcompanhamento` novos em `lib/prontuario-api.ts`,
seguindo o padrao dos demais clientes desta tela.

### Decisao de arquitetura: estado compartilhado com o cabecalho

`SecaoPrioridadeAcompanhamento` recebe `prioridade` e `aoAtualizar` como
props, em vez de buscar seus proprios dados (diferente do padrao de
`ResumoAntropometrico`, que se auto-busca). Motivo: o cabecalho sticky do
prontuario (fechado no incremento da UI do 265.4) ja mantem seu proprio
estado `prioridadeAcompanhamento` e mostra um resumo compacto da mesma
prioridade em todas as abas. Se a secao nova buscasse os dados de forma
independente, criar ou remover um override pela secao deixaria o
cabecalho desatualizado ate o proximo reload -- uma inconsistencia visivel
(cabecalho dizendo "calculada", secao dizendo "ajustada manualmente" para
o mesmo paciente, na mesma tela). Levantar o estado para o componente pai
(`ProntuarioPaciente`) e passar `aoAtualizar={setPrioridadeAcompanhamento}`
mantém uma unica fonte de verdade e corrige os dois pontos de exibicao com
a mesma chamada.

### O que ficou fora deste incremento, de proposito

- Nenhuma mudanca de backend: as rotas `POST`/`DELETE`
  `/pacientes/:id/prioridade-acompanhamento/override` ja existiam (265.4),
  com `pacientes.gerenciar` preservado.
- Nenhuma UI para o enum de `codigoMotivo` alem do que a 265.5 aprovou --
  a lista de opcoes do select vem diretamente do vocabulario fechado, sem
  texto livre adicional.

Validacoes desta branch:

- `PASS` - `pnpm typecheck`;
- `PASS` - `pnpm lint` (0 erros; avisos pre-existentes de
  `react-hooks/set-state-in-effect` inalterados, nenhum novo introduzido
  pelos arquivos desta branch);
- `PASS` - TDD do BFF novo: `test-override-prioridade-acompanhamento-bff.mjs`
  / `override-prioridade-acompanhamento-bff.spec.ts` (6/6 -- sessao
  ausente recusada com 401 antes do backend, tanto no POST quanto no
  DELETE; sessao sem `pacientes.gerenciar` recusada com 403 antes do
  backend, tanto no POST quanto no DELETE; POST encaminha corpo e
  paciente codificado corretamente; DELETE encaminha paciente codificado
  corretamente), incluido em `pnpm test:authz`;
- `PASS` - `pnpm test:authz` completo;
- `PASS` - suite Playwright nova em `console-regression.spec.mjs`, bloco
  "prontuario do paciente" (66/66 no total, incluindo as 6 novas):
  cria ajuste mantendo calculado e efetivo separados; altera ajuste ja
  ativo; remove ajuste e volta ao calculado; trata falha de rede (500) ao
  salvar sem quebrar a tela; trata paciente fora do escopo (404) com a
  mensagem apropriada; oculta a acao sem `pacientes.gerenciar` mas
  mantem a leitura visivel;
- `PASS` - `acessibilidade.spec.mjs` completo (268/268, incluindo o teste
  de detalhe do paciente com checagem de axe sobre a secao nova);
- `PASS` - `fase-249-densidade-responsividade.spec.mjs` completo (6/6,
  incluindo o teste de prontuario no celular);
- `PASS` - `git diff --check`;
- `PASS` - `pnpm security:secrets`;
- `NA` - migration, DDL, RLS ou schema (nenhuma mudanca de backend nesta
  branch).

Nota de ambiente: mesma observacao da secao 11 sobre
`launchOptions.executablePath` para rodar Playwright localmente com o
Chromium ja presente no ambiente; config local descartavel, nao
versionada.
