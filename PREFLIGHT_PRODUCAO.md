# OctaClin - Preflight de producao

Atualizado em 2026-07-22, Fase 94.

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
| Recuperacao de senha | Pronto | Fluxo seguro e testes focados. | Aplicar rate limit e lockout. |
| Permissoes finas | Pronto | Matriz refinada, guard backend, BFF e middleware web por permissao. | Revalidar em producao isolada e ampliar testes cross-tenant. |
| Multi-tenant | Parcial | Tenant aplicado nos fluxos principais. | Criar testes negativos cross-tenant para rotas criticas. |
| Portal do cliente | Parcial | Base, resumo real, usuarios e convites administrativos. | Configuracoes de conta, perfis finos, assinatura e limites. |
| Portal do profissional | Parcial | Console operacional, pacientes, agenda, formularios e comunicacoes. | Dashboard diario, prontuario, evolucoes e materiais. |
| Portal do paciente | Parcial | Primeiro acesso, historico, perfil, formularios e LGPD. | UX final, tarefas, materiais, check-ins e notificacoes. |
| Formularios | Pronto | Editor, modelos, preview, coleta, respostas e leitura clinica. | QA E2E com jornada real e dados realistas. |
| Agenda | Parcial | Agenda interna com Google Calendar e comunicacoes no agendamento. | Remarcacao, cancelamento, conflitos e sincronizacao bidirecional minima. |
| Email | Parcial | Envio validado com Gmail. | Identidade de envio, SPF/DKIM/DMARC quando houver dominio proprio. |
| WhatsApp | Parcial | Envio, webhook, status, inbox, associacao e notas. | Templates aprovados, mapeamento por evento e automacoes. |
| LGPD | Parcial | Portal paciente e painel operacional LGPD. | Termos, politica, consentimentos versionados, retencao e exportacao completa. |
| Auditoria | Parcial | Auditoria operacional e convites administrativos. | Cobrir mutacoes sensiveis restantes e exportacoes. |
| Billing/assinatura | Pendente | Planejado no roadmap. | Modelo de planos, limites, assinatura e bloqueios suaves. |
| Observabilidade | Pendente | Healthcheck basico e runbook. | Logs estruturados, alertas, filas, dashboards e incidentes. |
| Backups/restore | Pendente | Planejado para Neon/Postgres. | Configurar backup e testar restore real. |
| Producao isolada | Pendente | Staging funcional. | Criar env de producao separado de staging. |
| Juridico/comercial | Pendente | Checklist previsto. | Termos, politica, contrato e processo de suporte. |
| QA E2E | Parcial | Typechecks, specs focadas e Playwright visual por areas. | Suite de jornadas criticas ponta a ponta. |

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

Seguir para a proxima fase funcional: configuracoes da conta do cliente, Fase 96.
