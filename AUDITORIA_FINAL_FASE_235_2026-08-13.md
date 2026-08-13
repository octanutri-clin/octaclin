# Auditoria final da Fase 235 - 2026-08-13

## Decisao

A Fase 235 permanece **em execucao**. Os 14 incrementos registrados construiram
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
| Cabecalho persistente | Parcial | Nome, risco, contato e acoes frequentes existem. Faltam responsavel/proxima consulta no cabecalho, contexto explicito de SuperAdmin e parte das acoes previstas, como iniciar atendimento, abrir plano e registrar pagamento. |
| Resumo orientado a conduta | Parcial | Ha proxima conduta, proxima consulta e contadores. Faltam plano publicado, ultimo atendimento, tarefa vencida, falha de comunicacao, serie temporal com tabela acessivel e leitura de adesao/sintomas com fonte identificada. |
| Timeline paginada | Parcial | Cursor estavel, limite, periodo, tipo, RLS e projecao sem conteudo cifrado estao implementados. A uniao atual cobre somente consultas, envios/respostas de formulario, check-ins, mensagens, evolucoes e tarefas. |
| Cobertura longitudinal | Pendente | Planos publicados, antropometrias, documentos emitidos, anexos confirmados, exames, fotos e eventos financeiros autorizados nao entram na timeline. Autor/origem nao sao uniformes e nao ha filtro por responsavel. |
| Cadastro progressivo | Parcial | Identificacao, contato/endereco, operacao, portal e fiscal estao separados, cifrados e salvos por secao. Faltam indicador de completude, deteccao assistida de duplicidade no cadastro e validacao de qualidade apresentada ao usuario. |
| Ciclo de acesso ao portal | Parcial | Convite seguro e reemissao com revogacao do convite pendente anterior existem. A ficha nao mostra estado atual, ultimo acesso, revogacao explicita, preferencias ou aceites. |
| Modulos clinicos conectados | Entregue parcialmente por fases posteriores | Antropometria, plano, documentos, exames/fotos e condutas possuem telas e contratos. A Fase 238 gestacional continua separada e pendente; os modulos posteriores ainda precisam entrar no resumo/timeline da 235. |
| Autorizacao e isolamento | Base entregue | A leitura reutiliza `ExecutorTenant`, RLS e escopo de carteira. A conclusao exige regressao explicita para cada nova origem da timeline e para o contexto transversal exclusivo de SuperAdmin. |
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

- adicionar planos publicados, antropometrias, documentos, anexos, exames,
  fotos e financeiro somente quando o papel tiver permissao na fonte;
- padronizar tipo, data, autor, origem, status e deep link sem descriptografar
  conteudo clinico;
- adicionar filtro server-side por responsavel e testes de tenant, carteira,
  papel, cursor e periodo;
- confirmar plano de consulta e indices antes de qualquer migration.

### Incremento 16 - resumo clinico acionavel

- incluir plano atual publicado, ultimo atendimento, tarefa vencida e falha de
  comunicacao;
- incorporar a serie antropometrica existente com seletor de metrica e tabela
  alternativa acessivel;
- mostrar adesao e sintomas apenas com fonte e data identificadas;
- manter uma unica proxima conduta, sem inferencia ou diagnostico automatico.

### Incremento 17 - qualidade cadastral e acesso ao portal

- indicar campos faltantes por secao sem bloquear pacientes legados;
- detectar possiveis duplicidades somente no mesmo tenant, sem fusao automatica;
- listar estado do acesso, ultimo acesso, preferencias e aceites autorizados;
- permitir reenvio/revogacao auditados sem reexibir token antigo.

### Incremento 18 - contexto, acoes e autorizacao

- identificar visualmente quando SuperAdmin acompanha o contexto de outro
  profissional;
- completar as acoes rapidas previstas e condicionar cada uma a permissao e
  estado do dominio;
- adaptar as acoes para mobile sem comprimir o prontuario em tabela;
- testar que nenhum outro papel troca ou consulta o painel de outro profissional.

### Incremento 19 - aceite tecnico de encerramento

- benchmark de resumo/timeline com massa sintetica e verificacao de N+1;
- suites completas de backend/web, authz, secrets e build;
- Playwright desktop/mobile, teclado, foco, contraste e estados de permissao;
- jornada mutavel em ambiente efemero com dados sinteticos;
- atualizar Penpot e documentos vivos somente depois das evidencias.

## Ordem recomendada

Executar os incrementos 15, 16, 17, 18 e 19 nessa ordem. A Fase 235 so pode
mudar de `[~]` para `[x]` depois do Incremento 19 e do registro das evidencias.
