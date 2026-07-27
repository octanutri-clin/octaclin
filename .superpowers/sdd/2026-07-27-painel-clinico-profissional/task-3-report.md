# Task 3 - Resumo clinico agregado e isolamento de acesso

## Status

Concluida.

## Escopo entregue

- Agregado `ServicoDashboardClinico` com:
  - contexto proprio obrigatorio para `Professional`;
  - selecao explicita de profissional para `SuperAdmin`;
  - recusa defensiva de outros papeis tambem na camada de servico;
  - filtros por tenant e profissional para consultas, pacientes, tarefas,
    formularios, solicitacoes e comunicacoes;
  - pacientes sem retorno a partir de 30 dias sem consulta concluida;
  - priorizacao por risco e faixas `30`, `60` e `90+`;
  - exclusao de pacientes inativos, arquivados ou fora do escopo;
  - indicadores de consultas e filas clinicas;
  - alertas ordenados, com alertas de risco alto nao ocultaveis.
- Endpoint `GET /dashboard/clinico` protegido por:
  - `GuardaJwt`;
  - papeis `SuperAdmin` e `Professional`;
  - permissao `dashboard.ler`.
- Endpoint `POST /dashboard/clinico/alertas/:alertaId/ocultar`:
  - ocultacao individual por usuario por 24 horas;
  - validacao do profissional codificado no alerta;
  - bloqueio de ocultacao para risco alto.
- Auditoria de selecao de contexto terceiro feita somente para `SuperAdmin`,
  com IDs operacionais e periodo, sem nomes, contato, conteudo clinico, IP ou
  user-agent.
- Auditoria de ocultacao sem nomes ou conteudo clinico.
- Entidade `DashboardAlertaOcultoOrm` com unicidade por
  `(tenantId, usuarioId, alertaId)`.
- Migration `1720000001004` com:
  - tabela e indice para ocultacoes ativas;
  - RLS habilitada e forcada;
  - policy tenant-aware com `using` e `with check`;
  - rollback restrito a tabela do dashboard.
- `ModuloDashboard` registrado em `ModuloAplicacao`.
- Entidades de leitura, auditoria e ocultacao registradas no modulo Nest.
- Entidade do dashboard registrada na configuracao global do TypeORM.
- Migrations `1002`, `1003` e `1004` registradas em ordem no TypeORM.
- Teste de regressao garante o registro da entidade e das migrations.
- Nenhuma dependencia adicionada e nenhum push realizado.

## Seguranca

- `Professional` ignora qualquer `profissionalId` solicitado e resolve apenas
  o profissional associado ao proprio usuario.
- Somente `SuperAdmin` pode selecionar profissional terceiro dentro do mesmo
  tenant.
- Profissional inexistente, arquivado ou de outro tenant nao produz acesso.
- Comunicacoes retornam apenas identificadores, paciente associado, status e
  data; payload e erro tecnico nao atravessam o agregado.
- Alertas ocultos sao isolados por tenant e usuario no banco e no servico.
- A ocultacao so persiste IDs de alertas cujo recurso ainda existe, ainda
  satisfaz a regra geradora e pertence ao contexto profissional atual.
- IDs arbitrarios, recursos concluidos/inativos e alertas fora do escopo sao
  rejeitados antes da persistencia e da auditoria.
- Auditoria nao persiste PII.

## Correcao de review - round 1

- A validacao de ocultacao passou a consultar o recurso real por tenant e
  profissional, incluindo o paciente ativo associado quando aplicavel.
- Alertas de atendimentos sao montados com a lista completa antes do limite de
  50 itens aplicado somente na resposta de UI.
- `atendimento_proximo` exige status ativo e inicio atual ou futuro.
- Os periodos `hoje`, `sete_dias` e `trinta_dias` usam
  `GOOGLE_CALENDAR_TIMEZONE`, com fallback seguro para
  `America/Sao_Paulo`, sem depender do timezone local do processo.
- O calculo de sem-retorno considera a ultima consulta concluida do paciente
  no tenant, inclusive quando realizada pelo profissional anterior.
- O controlador audita apenas o ID validado retornado pelo servico e nao
  registra tentativas rejeitadas.

## Validacoes

- Jest focado do round 1: aprovado, `2` suites e `15` testes.
- Jest completo do backend: aprovado, `57/57` suites e `307/307` testes.
- Casos do agregado: aprovado, `6/6`.
- Controlador e autorizacao: aprovado, `4/4`.
- Migration `1004`: aprovado, `2/2`.
- Registro TypeORM: aprovado, incluindo a sequencia `1002/1003/1004`.
- Regressoes focadas de agenda e questionarios: aprovadas.
- Backend typecheck: aprovado.
- Backend build: aprovado.
- `git diff --check`: aprovado.

## Correcao de review - round 2

- `profissionalId` e `recursoId` codificados no alerta agora exigem UUID valido
  antes de qualquer execucao do contexto tenant ou consulta ao banco.
- IDs malformados resultam em `BadRequestException`, sem propagacao de erro
  PostgreSQL `22P02` ou resposta `500`.
- Teste unitario cobre separadamente os dois campos invalidos e preserva o
  cenario de ocultacao valida com fixtures UUID.

## Validacoes da correcao - round 2

- Jest focado do servico: aprovado, `1` suite e `11` testes.
- Backend typecheck: aprovado nesta atualizacao.
- `git diff --check`: aprovado nesta atualizacao.

## Preocupacoes residuais

- A migration `1004` foi validada por teste de contrato SQL e compilacao, mas
  nao foi executada contra uma instancia PostgreSQL externa nesta tarefa.
- Nenhum PostgreSQL externo foi criado ou simulado para esta correcao; os
  testes adicionados cobrem as regras viaveis na infraestrutura local.
