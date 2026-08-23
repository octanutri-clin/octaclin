# Fase 192 - Centro clinico diario e agenda profissional

Status: concluida e validada localmente em 2026-07-31.

## Entregue

- **Dashboard clinico** (`components/dashboard/painel-dashboard.tsx`) reorganizado
  em 3 grupos priorizados: **Agora** (fila de prioridade + proximos
  atendimentos), **Proximos** (pacientes sem retorno + solicitacoes de
  agendamento) e **Pendentes** (tarefas vencidas + formularios pendentes +
  comunicacoes em alerta). O bloco de indicadores agregados ("Hoje em foco")
  foi mantido, mas movido para o final, depois da fila clinica e das acoes
  rapidas — nenhum dado, handler ou copy foi removido, so reagrupado.
- **Agenda** (`components/agenda/painel-agenda.tsx` + `agenda-semanal.tsx`):
  - Criacao de consulta ("Novo agendamento") saiu de um card sempre visivel na
    pagina e virou um `Modal` ("Nova consulta"), aberto por um botao "Nova
    consulta" no cabecalho de "Consultas agendadas". O calendario (`AgendaSemanal`)
    continua sendo a superficie principal, agora sem concorrencia visual do
    formulario de criacao.
  - A lista "Consultas agendadas" tinha um formulario de remarcar + 3 botoes
    de desfecho duplicados dentro de cada card, redundantes com o modal de
    detalhes ja aberto pelo calendario. Consolidado num unico botao "Gerenciar
    consulta" que abre o mesmo modal (`Detalhes da consulta`), eliminando a
    superficie de edicao duplicada.
  - "Liberar horario reservado" (bloqueio manual) ganhou confirmacao
    (`ModalConfirmacao`) — antes removia o bloqueio direto no clique do X, sem
    nenhuma confirmacao, gap identificado na Fase 192 em relacao ao criterio
    de aceite "com confirmacao".
  - Mensagens de sucesso/erro da pagina (antes so visiveis dentro do card de
    criacao) viraram um banner global logo abaixo do calendario, visivel
    independente de qual modal esta aberto.
- **Correcao no componente compartilhado `Modal`** (`components/ui/modal.tsx`):
  o dialogo nao tinha `max-height`/`overflow`, entao um formulario longo (como
  o de nova consulta) ficava inacessivel em viewport mobile curto — nem o
  usuario real nem o Playwright conseguiam rolar ate o botao "Agendar". Corrigido
  com `max-h-[90vh]` + cabecalho fixo + corpo com `overflow-y-auto`, beneficiando
  todo uso existente de `Modal`/`ModalConfirmacao` no app, nao so a agenda.

## Limites deliberados

- Conflito de horario (double-booking) nao ganhou um badge visual novo na
  grade: o backend ja rejeita a criacao com conflito na validacao de
  `servico-agenda.ts`, entao o "conflito" hoje se manifesta como erro no
  formulario de criacao, nao como um estado a ser exibido no calendario.
  Nenhum requisito do checklist pedia um indicador visual separado disso.
- Nao foi criado um componente de "painel lateral" (drawer) novo — o `Modal`
  centralizado ja existente no repo foi reaproveitado para criacao e edicao,
  seguindo o padrao ja usado no proprio `painel-agenda.tsx` para o detalhe da
  consulta. Nenhuma alteracao de backend foi necessaria nesta fase.

## Revisao

Nenhuma mudanca de backend nesta fase (so frontend); `ecc:database-reviewer`
planejado em `ESCOPO_SKILLS_AGENTES_FASES_191_198.md` nao foi acionado por
falta de diff no dominio dele. Cobertura de testes (Playwright, typecheck,
lint, build) validou os fluxos criticos ponta a ponta, incluindo o bug de
mobile encontrado e corrigido durante a validacao.

## Validacoes

```powershell
pnpm --dir octaclin-web typecheck
pnpm --dir octaclin-web lint
pnpm --dir octaclin-web exec playwright test tests/visual/jornadas-criticas.spec.mjs tests/visual/console-regression.spec.mjs tests/visual/acessibilidade.spec.mjs --reporter=list
pnpm --dir octaclin-web run test:authz
pnpm --dir octaclin-web run build
npm run security:secrets
powershell -ExecutionPolicy Bypass -File .\validar-preflight.ps1 -DocsOnly
```

Resultados: typecheck e lint limpos; 68 cenarios Playwright aprovados (a11y,
login, console, agenda, dashboard, prontuario, operacoes, jornadas criticas);
22 verificacoes de autorizacao/BFF; build de producao aprovado; scanner de
secrets sem achados; preflight documental OK.

## Proxima fase

Fase 193 - Pacientes e prontuario orientados a conduta.
