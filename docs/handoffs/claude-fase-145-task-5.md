# Handoff Claude Code - Fase 145, Task 5

## Objetivo

Concluir a Task 5 da Fase 145: diferenciar desmarcamento feito pelo paciente de cancelamento feito pelo profissional, mantendo `cancelada` como unico status terminal da agenda.

## Estado atual

- Repositorio: OctaClin.
- Branch: `integrate/producao-hardening`.
- HEAD de inicio: `77e0154` (`Corrige origem de auditoria do dashboard clinico`).
- Nao faca `git reset`, `git checkout --`, rebase, merge, pull, push ou deploy.
- Preserve qualquer alteracao existente que nao seja da Task 5.
- O arquivo `.superpowers/sdd/2026-07-27-painel-clinico-profissional/progress.md` ja marca a Task 5 como `in_progress`; nao altere checklist ou resumo publico ate a fase inteira ser aceita.

## Documentos obrigatorios

Leia antes de editar:

1. `AGENTS.md`
2. `docs/superpowers/specs/2026-07-27-painel-clinico-profissional-design.md`
3. `docs/superpowers/plans/2026-07-27-painel-clinico-profissional.md`
4. `.superpowers/sdd/2026-07-27-painel-clinico-profissional/task-5-brief.md`
5. `.superpowers/sdd/2026-07-27-painel-clinico-profissional/progress.md`

## Regras de produto aprovadas

- O banco continua com um unico desfecho terminal: `status: 'cancelada'`.
- Cancelamento pelo profissional: a interface mostra `Cancelada pelo profissional`; libera o horario, cancela o evento Google uma unica vez e enfileira e-mail/WhatsApp para o paciente conforme os canais habilitados.
- Desmarcamento pelo paciente: a interface do portal mostra `Desmarcada`; libera o horario, cancela o evento Google uma unica vez e cria alerta operacional sem PHI para o profissional responsavel. O paciente nao recebe uma notificacao de que ele proprio desmarcou.
- Cancelamento originado pelo Google: registra origem `google`, libera o horario e nao gera loop de comunicacao.
- Registre a origem em `payload.historico` e os resultados de notificacao em `notificacoes`; nao crie novo status no banco.
- Nunca coloque motivo livre, telefone, e-mail, token, payload clinico ou dados de saude no alerta do dashboard.
- A identidade do paciente deve vir apenas da sessao autenticada do portal. O navegador nao pode informar `pacienteId`, `profissionalId`, tenant ou origem confiavel.
- Profissionais acessam apenas a propria agenda. Somente `SuperAdmin` pode escolher contexto de outro profissional.
- Auditoria deve ser decidida pelo endpoint backend, nunca por header enviado pelo cliente. O commit `77e0154` corrigiu exatamente esse risco; nao o reintroduza.

## Escopo tecnico

Implemente os quatro passos do brief:

1. Testes de origem e comunicacao para cancelamento por profissional, paciente e Google.
2. Politica de cancelamento em `ServicoAgenda`, reaproveitando a infraestrutura existente de comunicacoes e Google Calendar.
3. Endpoint backend e BFF autenticado do portal para o paciente desmarcar somente a propria consulta ativa, mais alerta clinico nao-PHI para o profissional responsavel.
4. UI do portal e mapeamento do alerta no dashboard clinico.

Use os modulos e padroes existentes. Nao faça refatoracoes fora do escopo.

## Validacao minima obrigatoria

Execute e registre resultados:

```powershell
pnpm --dir octaclin-backend typecheck
pnpm --dir octaclin-backend test -- --runInBand src/modulos/agenda/aplicacao/servico-agenda.spec.ts src/modulos/agenda/aplicacao/servico-agendamento-publico.spec.ts
pnpm --dir octaclin-web test:authz
pnpm --dir octaclin-web lint
pnpm --dir octaclin-web typecheck
pnpm --dir octaclin-web build
```

Rode tambem os testes visuais desktop e mobile adicionados para desmarcamento do paciente e cancelamento profissional. Se a suite visual inteira demorar, rode o arquivo/cenario focado e informe o comando.

Confirme nos testes que cada uma das tres origens torna a consulta terminal, libera o horario em verificacoes de conflito e invoca o cancelamento Google no maximo uma vez.

## Entrega

- Faça um commit local unico com mensagem: `Distingue desmarcamento e cancelamento de consulta`.
- Nao faca push.
- Ao concluir, informe: commit, arquivos alterados, testes executados, testes que nao puderam rodar e qualquer dependencia externa pendente.
