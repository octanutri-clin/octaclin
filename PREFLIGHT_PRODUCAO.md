# OctaClin - Preflight de producao

Atualizado em 2026-07-23, Fase 131.

Este arquivo funciona como painel rapido de prontidao antes de liberar o OctaClin para clientes reais. Ele complementa `CHECKLIST_GO_LIVE.md`, que continua sendo o checklist completo de liberacao.

## Legenda

- `Pronto`: funcionalidade entregue e validada em staging/local.
- `Parcial`: existe base funcional, mas ainda faltam controles, UX final, integracao madura ou validacao E2E.
- `Pendente`: ainda precisa ser desenvolvido antes de producao real.
- `Bloqueado`: depende de aprovacao externa, conta, provedor ou decisao comercial/juridica.

## Preflight por area

| Area | Status | Evidencia atual | Antes de clientes reais |
| --- | --- | --- | --- |
| Login unificado | Pronto | Login por perfil, cookies HttpOnly e roteamento por papel. | Revalidar em producao isolada. |
| Recuperacao de senha | Pronto | Fluxo seguro, testes focados, rate limit e lockout. | Revalidar em producao isolada. |
| Permissoes finas | Pronto | Matriz refinada, guard backend, BFF e middleware web por permissao. | Revalidar em producao isolada. |
| Multi-tenant | Pronto | Tenant aplicado nos fluxos principais e testes negativos para rotas criticas revisadas. | Revalidar em producao isolada e ampliar conforme novos dominios. |
| Portal do cliente | Parcial | Base, resumo real, configuracoes, perfil fiscal, usuarios, convites administrativos, historico/exportacao de convites, resumo de limites SaaS, solicitacao comercial manual e aviso de assinatura bloqueada. | Onboarding final e QA E2E. |
| Portal do profissional | Parcial | Dashboard diario, console operacional, pacientes, prontuario/linha do tempo, evolucoes clinicas privadas, tarefas/metas/check-ins de acompanhamento, biblioteca/envio de materiais, agenda, formularios e comunicacoes. | Agenda de producao e UX final de rotina. |
| Portal do paciente | Parcial | Primeiro acesso, historico, perfil, formularios, LGPD, tarefas, materiais, check-ins e notificacoes. | QA E2E com jornada real e dados realistas. |
| Formularios | Pronto | Editor, modelos, preview, coleta, respostas e leitura clinica. | QA E2E com jornada real e dados realistas. |
| Agenda | Parcial | Agenda interna com Google Calendar, comunicacoes no agendamento, conflito local por profissional, remarcacao e cancelamento sincronizados com Google. | Recorrencia avancada, importacao inbound por `syncToken` e painel de disponibilidade. |
| Email | Parcial | Envio validado com Gmail. | Identidade de envio, SPF/DKIM/DMARC quando houver dominio proprio. |
| WhatsApp | Parcial | Envio, webhook, status, inbox, associacao, notas, templates por evento e automacoes. | Validar templates reais aprovados em producao. |
| LGPD | Pronto | Portal paciente, painel operacional LGPD, consentimentos versionados, retencao programada e exportacao completa. | Revisao juridica/comercial antes do go-live. |
| Auditoria | Parcial | Auditoria operacional, convites administrativos, perfil fiscal, LGPD, agenda e leituras sensiveis. | Cobrir mutacoes sensiveis restantes conforme surgirem. |
| Billing/assinatura | Parcial | Modelo de planos, limites, uso, alertas, solicitacao manual de upgrade/revisao, controle manual administrativo e bloqueios suaves para novas criacoes. | Expandir bloqueios para mensagens/formularios/armazenamento; gateway definitivo se necessario. |
| Observabilidade | Parcial | Healthchecks, logs estruturados, request ID, alertas operacionais e runbooks. | Persistir historico de alertas e integrar notificacao externa se necessario. |
| Backups/restore | Parcial | Runbook, planejador seguro, script de backup, validacao estrutural e restore real aprovado em banco dedicado na Fase 158. | Configurar recorrencia e repetir o teste semanalmente. |
| Suporte | Pronto | `RUNBOOK_SUPORTE.md` cobre login, convites, recuperacao de senha, WhatsApp, email, agenda e escalonamento. | Treinar responsavel e revisar apos piloto. |
| Dados de staging | Pronto | Fixture sem PII real, seed `seed-staging.ts`, runbook `RUNBOOK_STAGING_DADOS.md`; `pnpm seed:staging` aplicado e validado no Neon staging (tenant `octaclin-staging`). | Reaplicar quando a Fase 131 separar staging de producao. |
| Piloto interno | Pronto | Runbook `RUNBOOK_PILOTO_INTERNO.md` e controle `PILOTO_INTERNO_CONTROLE.md`; rodada 1 executada em 2026-07-23 com todas as jornadas manuais aprovadas e aceite registrado. | Nenhuma pendencia; repetir rodada apos mudancas relevantes de autorizacao. |
| Producao isolada | Parcial | Runbook `RUNBOOK_PRODUCAO_ISOLADA.md` e controle `PRODUCAO_ISOLADA_CONTROLE.md`; banco Neon (`Octaclin-db-producao`, 8/8 migrations, vazio) e Redis Upstash de producao criados e validados; Render de producao ainda pendente. | Rotacionar secrets do Neon/Upstash de producao e criar servicos Render de producao separados de staging conforme o runbook. |
| Juridico/comercial | Pendente | Checklist previsto. | Termos, politica, contrato e processo de suporte. |
| QA E2E | Parcial | Typechecks, specs focadas, Playwright visual por areas e suite de jornadas criticas com BFF mockado. | Validar em staging com dados realistas. |

## Gate antes de cada fase

Antes de iniciar uma fase funcional:

- Confirmar a fase atual no `CHECKLIST_FASES_FUTURAS_PRODUCAO.md`.
- Ler o `STATUS_ATUAL_PROJETO.md`.
- Conferir se a fase toca permissoes no `MAPA_ROTAS_PERMISSOES.md`.
- Conferir se a fase toca env/secrets no `VARIAVEIS_AMBIENTE.md`.
- Conferir se a fase toca operacao no `RUNBOOK_PRODUCAO.md`.

## Gate antes de concluir uma fase

Toda fase deve terminar com:

- Arquivo `fase-XX-*.md` criado ou atualizado.
- `CHECKLIST_FASES_FUTURAS_PRODUCAO.md` atualizado.
- `RESUMO_FASES_CONCLUIDAS.md` atualizado quando a fase virar capacidade consolidada.
- `STATUS_ATUAL_PROJETO.md` atualizado se mudar o estado do produto.
- `MAPA_ROTAS_PERMISSOES.md` atualizado se mudar papel, rota ou permissao.
- `TESTES_E_VALIDACOES.md` atualizado se mudar o padrao de teste.
- Commit e push para `origin/main`.

## Comando padrao

Validacao rapida de documentacao:

```powershell
powershell -ExecutionPolicy Bypass -File .\validar-preflight.ps1 -DocsOnly
```

Validacao ampliada antes de fases de risco:

```powershell
powershell -ExecutionPolicy Bypass -File .\validar-preflight.ps1 -Full
```

Atalho pela raiz:

```powershell
pnpm validate
```

## Proximo passo recomendado

Fase 131 - Producao isolada de staging em andamento. Estrutura entregue em
2026-07-23 (`RUNBOOK_PRODUCAO_ISOLADA.md`, `PRODUCAO_ISOLADA_CONTROLE.md`).
Falta provisionar de fato o banco Neon, o Redis Upstash e os servicos Render
de producao, separados do ambiente hoje usado como staging, e registrar cada
etapa em `PRODUCAO_ISOLADA_CONTROLE.md` ate o aceite final.
