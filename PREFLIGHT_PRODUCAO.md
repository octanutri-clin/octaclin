# OctaClin - Preflight de producao

Atualizado em 2026-08-09, apos a Fase 220.

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
| Observabilidade | Pronto | Healthchecks, logs estruturados, request ID, alertas operacionais e monitor externo de saude/backup com incidentes deduplicados. | Acompanhar issues e reforcar o monitoramento nas primeiras 48 horas do go-live. |
| Backups/restore | Pronto | Workflow diario ativo, B2 privado com retencao 8/29/93, checksum/AES256 e restore semanal aprovado na Fase 219. | Acompanhar falhas do cron e repetir restore semanalmente. |
| Suporte | Pronto | `RUNBOOK_SUPORTE.md` cobre login, convites, recuperacao de senha, WhatsApp, email, agenda e escalonamento. | Treinar responsavel e revisar apos piloto. |
| Dados de staging | Pronto | Fixture sem PII real, seed `seed-staging.ts`, runbook `RUNBOOK_STAGING_DADOS.md`; `pnpm seed:staging` aplicado e validado no Neon staging (tenant `octaclin-staging`). | Reaplicar quando a Fase 131 separar staging de producao. |
| Piloto interno | Pronto | Runbook `RUNBOOK_PILOTO_INTERNO.md` e controle `PILOTO_INTERNO_CONTROLE.md`; rodada 1 executada em 2026-07-23 com todas as jornadas manuais aprovadas e aceite registrado. | Nenhuma pendencia; repetir rodada apos mudancas relevantes de autorizacao. |
| Producao isolada | Pronto | Neon, Upstash e servicos Render exclusivos de producao aceitos na Fase 131, com credenciais rotacionadas e sem referencias a staging. | Revalidar apos mudancas relevantes de infraestrutura. |
| Juridico/comercial | Parcial | Minutas de contrato, politica, Termo de Uso, Anexo de Tratamento, SLA, onboarding e revisao preparatoria da Fase 159. | Aceite por advogado, identidade empresarial, encarregado/canal, bases legais, suboperadores/transferencias e publicacao final. |
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

Fase 221 - regressao ponta a ponta pos-fases 200-220 em producao isolada, com
dados sinteticos e jornadas de Client, Professional e paciente. O objetivo e
fechar defeitos observados antes de dominio, aceite juridico e entrada de
clientes reais. O rollout separado de `web`/`worker` da Fase 201 continua como
gate anterior ao lancamento, mas pode permanecer adiado enquanto exigir custo
de infraestrutura sem beneficio para o piloto atual.
