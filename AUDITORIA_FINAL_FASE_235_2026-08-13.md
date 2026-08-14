# Auditoria final da Fase 235 - 2026-08-13

## Decisao

A Fase 235 permanece **em execucao**. Os 18 incrementos registrados construiram
a navegacao do prontuario, o cadastro progressivo e a base paginada da linha do
tempo, mas ainda nao satisfazem todos os criterios de aceite da especificacao.

Esta auditoria foi apenas de codigo e documentacao. Ela nao altera schema, nao
executa migration e nao modifica producao.

## Evidencia revisada

- especificacao e checklist da Fase 235;
- `octaclin-web/components/pacientes/prontuario-paciente.tsx`;
- `octaclin-web/components/pacientes/perfil-cadastro-paciente.tsx`;
- `octaclin-backend/src/modulos/pacientes/aplicacao/servico-pacientes.ts`;
- DTOs, controladores e testes de pacientes e convites;
- entregas posteriores das Fases 236, 237 e 239.

## Matriz de conformidade

| Area | Situacao | Evidencia e lacuna |
| --- | --- | --- |
| Navegacao em seis areas | Entregue | Resumo, Atendimentos, Avaliacoes, Plano, Documentos e Financeiro estao agrupados; Financeiro depende de permissao. |
| Cabecalho persistente | Entregue | Nome, risco e contato permanecem visiveis; consulta futura, plano atual, mensagens, financeiro e criacao clinica aparecem somente conforme permissao e estado. O contexto transversal de SuperAdmin identifica o profissional responsavel sem expor IDs. |
| Resumo orientado a conduta | Entregue | Uma unica acao operacional priorizada vem do backend; plano publicado, ultimo atendimento, tarefa vencida e falha de comunicacao respeitam permissoes. A serie antropometrica possui seletor e tabela acessivel, e adesao/sintomas so aparecem com fonte e data. |
| Timeline paginada | Entregue | Cursor estavel, limite, periodo, tipo, responsavel, RLS e projecao sem conteudo cifrado cobrem as fontes longitudinais previstas. |
| Cobertura longitudinal | Entregue | Planos publicados, antropometrias, documentos emitidos, anexos confirmados, exames, fotos e eventos financeiros autorizados entram por metadados, com autor/origem/responsavel uniformizados. |
| Cadastro progressivo | Entregue | Identificacao, contato/endereco, operacao, portal e fiscal estao separados e cifrados. A ficha indica completude e campos faltantes sem bloquear legado e sugere possiveis duplicidades apenas no escopo autorizado, sem fusao automatica. |
| Ciclo de acesso ao portal | Entregue | Estado, ultimo acesso, canal preferido e aceites autorizados sao exibidos sem token antigo. Reemissao invalida o convite pendente anterior e a revogacao explicita e auditada. |
| Modulos clinicos conectados | Entregue parcialmente por fases posteriores | Antropometria, plano, documentos, exames/fotos e condutas possuem telas e contratos. A Fase 238 gestacional continua separada e pendente; os modulos posteriores ainda precisam entrar no resumo/timeline da 235. |
| Autorizacao e isolamento | Entregue | A leitura reutiliza `ExecutorTenant`, RLS e escopo de carteira. A regressao confirma que Professional recebe `NotFound` fora da propria carteira e que somente SuperAdmin recebe a identificacao transversal na interface. |
| Responsividade e estados | Base entregue | Existem estados de carga, vazio e erro, e a Fase 239 validou jornadas sinteticas. As alteracoes residuais precisam repetir teclado, leitor de tela, desktop/mobile e permissao negada. |
| Desempenho | Pendente | Nao foi encontrado benchmark dedicado para resumo/timeline com massa sintetica nem criterio registrado de N+1/latencia. |

## Escopo ja absorvido por fases posteriores

- Fase 236: exames laboratoriais e evolucao fotografica;
- Fase 237: condutas terapeuticas versionadas;
- Fase 239: validacao clinica e de usabilidade ja realizada para o recorte que
  existia naquele momento.

Essas entregas nao devem ser refeitas. Elas devem ser integradas ao resumo e a
timeline por referencia e metadados autorizados, mantendo suas fontes de verdade.
A Fase 238 continua sendo um modulo especializado independente.

## Incrementos residuais obrigatorios

### Incremento 15 - timeline longitudinal completa

Concluido em 2026-08-13.

- a consulta paginada agrega planos publicados, antropometrias, documentos,
  anexos confirmados, exames, fotos e eventos financeiros sem criar fonte de
  verdade paralela;
- plano e financeiro so entram quando o papel possui a permissao da fonte;
  tenant e carteira continuam validados antes da consulta consolidada;
- tipo, data, autor, responsavel, origem, status e deep link foram
  normalizados sem selecionar ou descriptografar conteudo clinico;
- o filtro por responsavel atravessa DTO, backend, BFF e interface; o cursor
  aceita tambem os IDs compostos dos eventos financeiros;
- a revisao confirmou indices nas series principais. Nenhuma migration foi
  criada sem `EXPLAIN`; fontes legadas e anexos serao medidos no benchmark do
  Incremento 19 antes de eventual indice aditivo;
- evidencias: 130 suites/871 testes backend, 20/20 Playwright do prontuario em
  desktop/mobile, typechecks, lint, builds, authz, seguranca BFF, secrets e
  audits de dependencias zerados.

### Incremento 16 - resumo clinico acionavel

Concluido em 2026-08-13.

- o backend projeta plano atual publicado, ultimo atendimento, tarefa vencida,
  falha de comunicacao e uma unica proxima acao operacional deterministica;
- plano e falha so aparecem com as permissoes de seus modulos, sem
  descriptografar conteudo do plano ou da mensagem;
- a serie antropometrica existente foi incorporada com seletor de metrica,
  grafico e tabela HTML equivalente para tecnologia assistiva;
- adesao e sintomas so aparecem quando declarados em check-in rapido, sempre
  com fonte e data, sem inferencia ou diagnostico automatico;
- evidencias locais: 130/130 suites e 872/872 testes backend, builds
  backend/web, lint, typecheck, autorizacao BFF, scan de segredos, 22/22
  Playwright do prontuario e 10/10 no gate de acessibilidade. O GitHub Actions
  nao foi executado porque a cota da conta estava esgotada; essa ausencia nao
  foi tratada como aprovacao de CI.

### Incremento 17 - qualidade cadastral e acesso ao portal

Concluido em 2026-08-14.

- a ficha calcula completude por identificacao, contato/endereco, operacao e
  fiscal autorizado, mostrando campos recomendados sem bloquear pacientes
  legados;
- possiveis duplicidades usam nome/nascimento ou contato e permanecem limitadas
  ao tenant e, para Professional, a propria carteira. A decisao e sempre
  manual e nenhum cadastro e fundido automaticamente;
- o estado do portal consolida convite, acesso ativo/desativado, ultimo login,
  canal preferido e os aceites legais permitidos, sem retornar o hash ou o
  token anterior;
- criar/reenviar exige `pacientes.gerenciar`, valida o escopo profissional e
  revoga o convite pendente anterior. A revogacao explicita possui confirmacao
  e auditoria, sem desativar uma conta que ja concluiu o primeiro acesso;
- evidencias locais: 130/130 suites e 874/874 testes backend, builds
  backend/web, lint, typecheck, autorizacao e seguranca BFF, 24/24 Playwright
  do prontuario e 10/10 no gate de acessibilidade. O GitHub Actions continua
  indisponivel por cota; CI ausente nao foi considerado aprovado.

### Incremento 18 - contexto, acoes e autorizacao

Concluido em 2026-08-14.

- o prontuario identifica `Contexto SuperAdmin`, mostra o nome do profissional
  responsavel e informa que as acoes continuam auditadas no usuario atual;
- nao foi criado seletor de impersonacao nem endpoint transversal novo. Os
  demais papeis nao recebem o aviso ou qualquer controle de troca de contexto;
- nova evolucao, tarefa, agendamento, consulta futura, plano atual,
  formularios, mensagens, anexos, financeiro e cadastro aparecem conforme a
  permissao e, quando aplicavel, somente quando existe o estado correspondente;
- o cabecalho deixa de ser fixo no celular e organiza as acoes em grade de duas
  colunas, com alvos de 44 px e sem transformar o prontuario em tabela;
- evidencias locais: backend 130/130 suites e 874/874 testes; escopo de
  Professional e excecao SuperAdmin validados; builds backend/web, lint,
  typecheck, authz e seguranca BFF; 28/28 Playwright do prontuario em
  desktop/mobile e 10/10 no gate de acessibilidade. Sem migration. O GitHub
  Actions segue indisponivel por cota e nao foi tratado como aprovado.

### Incremento 19 - aceite tecnico de encerramento

Em execucao desde 2026-08-14.

- [x] benchmark sintetico compara 1 e 30 registros por fonte. O resumo mantem
  11 operacoes de repositorio nos dois cenarios; a timeline pagina 50 de 51
  eventos com uma query consolidada mais a validacao do paciente, sem N+1;
- [x] suites completas locais: backend 131/131 suites e 876/876 testes,
  builds backend/web, typechecks, lint, authz e seguranca BFF;
- [x] Playwright 30/30 do prontuario em desktop/mobile, incluindo papel sem
  permissao, teclado, foco visivel, contraste WCAG AA e ausencia de overflow;
  o gate transversal de acessibilidade passou 10/10;
- [ ] jornada mutavel em ambiente efemero: workflow, alvo e fixtures passaram
  seus testes estaticos. O banco `octaclin_test_fase150b` foi confirmado e
  inspecionado em 2026-08-14, com 39/40 migrations e a role de login
  `neondb_owner` assumindo automaticamente `octaclin_runtime_integracao`. A
  migration `AdicionarCicloVidaTenants1720000001027` nao foi aplicada sem uma
  sessao owner efetiva; o Actions continua sem executar jobs por falta de cota;
- [x] Penpot conectado e validado por exportacao. O arquivo
  `ddb7145f-a1be-80bb-8008-682e4779bea2` recebeu as pranchas desktop 1440,
  mobile 390 e especificacao de aceite, com a versao
  `Fase 235 - pranchas validadas`;
- [ ] documentos de encerramento e mudanca de `[~]` para `[x]` somente apos os
  a jornada mutavel acima.

## Ordem recomendada

Concluir a jornada mutavel do Incremento 19. A Fase 235 so pode
mudar de `[~]` para `[x]` depois do Incremento 19 e do registro das evidencias.
