# Fase 145 - Painel clinico do profissional e desmarcamento/cancelamento distintos

Status: concluida em 2026-07-27 (implementada via `superpowers:subagent-driven-development`,
plano em `docs/superpowers/plans/2026-07-27-painel-clinico-profissional.md`, desenho em
`docs/superpowers/specs/2026-07-27-painel-clinico-profissional-design.md`).

## Objetivo

Transformar o dashboard do profissional numa central diaria de trabalho clinico, e
diferenciar formalmente, na agenda, um cancelamento feito pelo profissional de um
desmarcamento feito pelo proprio paciente ou de um cancelamento originado no Google
Calendar - mantendo `cancelada` como o unico desfecho terminal do banco.

## Entregue

- Novo modulo `dashboard` (`ServicoDashboardClinico`/`ControladorDashboardClinico`):
  resumo clinico agregado por profissional (consultas do periodo, pacientes sem
  retorno em 30/60/90+ dias com nivel de risco, tarefas vencidas, formularios
  pendentes, solicitacoes publicas e comunicacoes em alerta), com filas limitadas e
  alertas priorizados. `Professional` so ve o proprio escopo; `SuperAdmin` pode
  selecionar profissional em contexto, sempre auditado; `Collaborator`/`Client`/
  `Patient` nao acessam o painel.
- Ocultacao individual de alerta por usuario (`DashboardAlertaOcultoOrm`), validada
  contra o estado real do recurso antes de persistir (nunca aceita ocultar um alerta
  que ja deixou de existir).
- Agenda: `ServicoAgenda.executarCancelamento` passou a registrar uma origem
  explicita (`profissional`, `paciente` ou `google`) no historico da consulta, em
  vez do par generico anterior (`octaclin`/`google_agenda`):
  - **Profissional cancela** (console/dashboard): libera o horario, cancela o
    evento Google no maximo uma vez, e dispara e-mail/WhatsApp ao paciente
    reaproveitando os canais e templates ja existentes (evento
    `agenda.consulta.cancelada`, contato ja persistido no payload da consulta -
    ja filtrado pelas preferencias do paciente desde a criacao).
  - **Paciente desmarca** (`ServicoAgenda.desmarcarConsultaPeloPaciente`, novo):
    autenticado exclusivamente pela sessao do portal (`resolverPacienteIdDoUsuario`,
    novo em `infraestrutura/seguranca/escopo-paciente.ts`); so pode desmarcar a
    propria consulta ativa; libera o horario e cancela o evento Google uma unica
    vez; nao recebe nenhuma notificacao de volta; gera um alerta operacional
    `desmarcacao_paciente` no dashboard clinico do profissional responsavel, sem
    nenhum dado clinico, motivo, telefone, e-mail ou token.
  - **Google cancela** (`cancelarConsultaComoSistema`, via sincronizacao
    existente): so registra a origem `google`, sem notificar ninguem (sem loop).
- Novo endpoint `POST portal/paciente/consultas/:consultaId/desmarcar` e rota BFF
  correspondente (`app/api/portal/paciente/consultas/[consultaId]/desmarcar`), com
  auditoria `portal.paciente.consulta.desmarcar`.
- UI: console mostra `Cancelada pelo profissional`, `Desmarcada pelo paciente` ou
  `Cancelada na Google Agenda` conforme a origem persistida; portal do paciente
  ganhou o botao "Desmarcar" na consulta ativa.

## Regras de seguranca aplicadas

- Tenant e identidade do paciente sempre derivados da sessao/JWT - o navegador
  nunca informa `pacienteId`, `profissionalId` ou origem confiavel.
- Auditoria decidida inteiramente pelo backend; nenhum header do cliente e
  usado para decidir origem ou permissao.
- Alerta de desmarcacao carrega somente `pacienteId`/`recursoId` (UUIDs internos,
  mesmo padrao dos demais alertas do dashboard) e timestamp - nunca motivo livre,
  contato ou dado clinico.

## Validacoes rodadas ao fechar

```powershell
pnpm --dir octaclin-backend typecheck
pnpm --dir octaclin-backend test --runInBand   # 59 suites / 318 testes
pnpm --dir octaclin-web typecheck
pnpm --dir octaclin-web lint
pnpm --dir octaclin-web build
pnpm --dir octaclin-web test:authz             # 20 testes (rotas + BFF)
pnpm --dir octaclin-web test:e2e:criticas      # 10 jornadas, desktop + mobile
```

Suite visual mais ampla (`console-regression.spec.mjs`, 42 casos) tambem executada:
41 passaram; 1 falha (`prontuario do paciente > permite criar material e enviar ao
paciente`, mobile) confirmada como flake pre-existente e nao relacionada a esta fase
(colisao de texto em modo estrito entre o toast de sucesso e o estado vazio de
materiais) - passou isolada e com retry, fora do escopo de materiais/prontuario desta
fase.

## Pendencias e debitos conhecidos (nao bloqueiam)

- `ServicoConexaoGoogleCalendar.desconectar()` ainda nao limpa a linha de
  `google_canais_watch` nem chama `pararCanalWatch` - debito registrado desde a
  Fase 136, nao agravado nem corrigido nesta fase.
- Token revogado no fluxo outbound (criacao/edicao) ainda aparece como falha
  generica em vez de marcar `desconectado_em` - mesmo debito da Fase 136.
- Nenhuma dependencia externa (credencial, dominio, OAuth, aprovacao de terceiro)
  ficou pendente para esta fase.
