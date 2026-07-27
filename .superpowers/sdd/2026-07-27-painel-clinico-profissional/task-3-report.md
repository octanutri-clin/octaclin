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
- Auditoria nao persiste PII.

## Validacoes

- Jest focado: aprovado, `6` suites e `52` testes.
- Casos do agregado: aprovado, `6/6`.
- Controlador e autorizacao: aprovado, `4/4`.
- Migration `1004`: aprovado, `2/2`.
- Registro TypeORM: aprovado, incluindo a sequencia `1002/1003/1004`.
- Regressoes focadas de agenda e questionarios: aprovadas.
- Backend typecheck: aprovado.
- `git diff --check`: aprovado.

## Preocupacoes residuais

- A migration `1004` foi validada por teste de contrato SQL e compilacao, mas
  nao foi executada contra uma instancia PostgreSQL externa nesta tarefa.
- A suite completa do backend nao foi exigida para esta etapa; a validacao foi
  limitada ao conjunto focado definido no brief e ao typecheck.
