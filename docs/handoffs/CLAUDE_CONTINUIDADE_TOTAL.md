# Claude Code - Continuidade Total do OctaClin

## 1. Objetivo

Concluir a Task 5 da Fase 145 em andamento, concluir a Fase 145, executar todas as fases pendentes do roadmap ate o go-live e implementar as melhorias de produto explicitamente aprovadas abaixo. Trabalhe de forma sequencial, com um commit local e validacao por fase.

## 2. Estado de inicio

- Produto: OctaClin. LiveClin foi apenas referencia de modelagem.
- Repositorio: `octanutri-clin/octaclin`.
- Branch de trabalho: `integrate/producao-hardening`.
- Base consolidada: commit `77e0154`.
- A Task 5 da Fase 145 pode conter alteracoes locais ainda nao commitadas. Preserve-as, revise-as e termine-as; nunca as descarte.
- Nao execute `git reset`, `git checkout --`, rebase, merge, pull, push ou deploy sem instrucao explicita do usuario.
- Nao altere Render, Neon, Upstash, Meta, Google Cloud, secrets, dominio ou outra integracao externa sem pedir ao usuario.

## 3. Leitura obrigatoria antes de editar

1. `AGENTS.md`
2. `CLAUDE.md`
3. `HANDOFF-TECNICO-OCTACLIN.md`
4. `CHECKLIST_FASES_FUTURAS_PRODUCAO.md`
5. `RESUMO_FASES_CONCLUIDAS.md`
6. `STATUS_ATUAL_PROJETO.md`
7. `COORDENACAO_DESENVOLVIMENTO_IA.md`
8. `TESTES_E_VALIDACOES.md`
9. `docs/superpowers/specs/2026-07-27-painel-clinico-profissional-design.md`
10. `docs/superpowers/plans/2026-07-27-painel-clinico-profissional.md`
11. `.superpowers/sdd/2026-07-27-painel-clinico-profissional/progress.md`
12. `.superpowers/sdd/2026-07-27-painel-clinico-profissional/task-5-brief.md`

Antes de cada nova fase, execute `git status --short`, leia a fase correspondente (`fase-*.md`) e consulte os commits recentes. Se houver modificacoes de outro agente, trabalhe com elas; nao reverta.

## 4. Ordem obrigatoria de execucao

### 4.1 Fase 145 - Task 5 em andamento

Concluir desmarcamento e cancelamento:

- `cancelada` permanece o unico status terminal.
- Profissional cancela: historico `origem: profissional`, horario livre, evento Google cancelado no maximo uma vez, e-mail/WhatsApp ao paciente respeitando preferencias.
- Paciente desmarca: historico `origem: paciente`, horario livre, evento Google cancelado no maximo uma vez, alerta nao-PHI ao profissional responsavel. O paciente nao recebe confirmacao de que ele mesmo desmarcou.
- Google cancela: historico `origem: google`, horario livre e nenhum loop de comunicacao.
- A identidade do paciente vem exclusivamente da sessao do portal. Nunca aceite paciente, profissional, tenant ou origem confiavel do navegador.
- Nenhum alerta pode conter motivo livre, telefone, e-mail, token, payload clinico ou dado de saude.
- Apenas `SuperAdmin` pode acompanhar o contexto de outro profissional.
- Auditoria deve ser decidida pelo endpoint backend. Nunca confie em `x-octaclin-origem` ou outro header recebido do cliente.

### 4.2 Fase 145 - Task 6

Depois da Task 5 aceita, execute regressao completa da fase, revise RBAC/tenant/PHI, atualize documentacao de fase e faca o commit final da Fase 145. Atualize somente entao:

- `CHECKLIST_FASES_FUTURAS_PRODUCAO.md`
- `RESUMO_FASES_CONCLUIDAS.md`
- `STATUS_ATUAL_PROJETO.md`
- `DEVELOPMENT_LOG.md`

### 4.3 Roadmap oficial

Em seguida, execute todas as fases ainda pendentes em `CHECKLIST_FASES_FUTURAS_PRODUCAO.md`, rigorosamente na ordem definida e sem marcar algo como concluido sem evidencia de teste e commit.

Priorize bloqueadores de go-live: dominio/SSL/identidade de envio, restore real em banco dedicado, checklist juridico/comercial, staging/jornadas reais, piloto/go-live assistido e qualquer fase ainda desmarcada no checklist.

## 5. Melhorias de produto explicitamente aprovadas

Trate como aprovadas e implemente em fases proprias, se ainda nao estiverem integralmente cobertas pelo roadmap:

1. Painel clinico por profissional com rotina diaria, pacientes sem retorno ha 30 dias e risco alto prioritario, tarefas vencidas, formularios pendentes, alertas e acoes rapidas.
2. Agendamento publico por profissional/servico, disponibilidade segura, solicitacao sem reserva definitiva e aprovacao interna manual com paciente explicito.
3. Agenda individual por profissional no Google Calendar, OAuth por usuario, callback seguro, eventos externos bloqueando horarios e prevencao de duplicidade.
4. Comunicacoes de agenda por e-mail e WhatsApp, preferencias do paciente, outbox, observabilidade e reprocessamento de falhas.
5. Cancelamento/desmarcamento descrito na Task 5.

Se uma melhoria aprovada nao tiver fase formal, antes de codificar:

1. Adicione uma fase numerada ao checklist vivo.
2. Crie o arquivo `fase-<numero>-<nome>.md` com objetivo, escopo, nao-escopo, RBAC, seguranca, testes e criterios de aceite.
3. Registre a dependencia e a ordem.
4. Implemente apenas apos o planejamento estar documentado.

## 6. Protocolo obrigatorio por fase

1. Ler a fase, o codigo relacionado e testes existentes.
2. Escrever ou ajustar testes de falha antes da implementacao quando pratico.
3. Implementar apenas o escopo da fase.
4. Executar testes focados, backend/web typecheck, lint e build quando aplicavel.
5. Rodar Playwright desktop e mobile para mudancas de interface.
6. Revisar tenant, RBAC, BFF, dados clinicos/PHI, auditoria e idempotencia de integracoes.
7. Fazer um commit local atomico com mensagem em portugues que descreva a fase.
8. Atualizar checklist, resumo, status e log com commit, data e validacoes.
9. Informar ao usuario: fase, commit, arquivos principais, validacoes e dependencia externa restante.

## 7. Regras de seguranca inegociaveis

- Tenant sempre deriva do JWT/sessao.
- BFF usa cookies HttpOnly; nao exponha token, URL interna ou segredo ao navegador.
- Nao confie em IDs de paciente/profissional/tenant/origem do browser.
- Garanta escopo proprio do Professional; somente SuperAdmin pode contexto de terceiros.
- Minimize respostas BFF e alertas operacionais; nunca vaze PHI.
- Integracoes devem ser idempotentes, auditaveis e reprocessaveis.
- Nenhum segredo entra em Git, frontend, documento ou log.

## 8. Quando parar e pedir o usuario

Pare somente quando precisar de: login/2FA, credencial, segredo, configuracao de Render/Neon/Upstash/Google/Meta, dominio/DNS, aprovacao de template Meta, decisao juridica/comercial ou validacao manual externa.

Quando parar, informe em uma lista curta:

- fase e commit atual;
- acao manual exata;
- URL/plataforma;
- valor que o usuario deve fornecer ou alterar;
- como validar depois;
- proxima fase apos a acao.

## 9. Definicao final de pronto

Somente declare o sistema pronto para clientes reais quando todos os itens obrigatorios do checklist e de `CHECKLIST_GO_LIVE.md` estiverem concluídos e validados: producao isolada, dominio/SSL/identidade de envio, restore real, seguranca/LGPD, observabilidade, jornadas E2E de staging, piloto controlado e go-live assistido.
