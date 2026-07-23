# OctaClin - Pacote de proximas fases para desenvolvedor

Este pacote orienta um desenvolvedor ou agente de IA que vai assumir varias fases antes do retorno de outro agente.

## Regra de execucao

- Avancar em ordem a partir da Fase 108.
- Fazer uma fase por vez.
- Cada fase deve ter seu proprio commit.
- Atualizar a documentacao viva ao final de cada fase.
- Se uma fase ficar grande demais, dividir em subentregas, mas manter o numero da fase no checklist.
- Nao iniciar a fase seguinte com mudancas pendentes sem commit/push da fase anterior.

## Estado de partida

- Ultima fase concluida: Fase 107 - Biblioteca de materiais e envio ao paciente.
- Primeiro proximo passo: Fase 108 - Agenda de producao.
- Fonte de verdade do roadmap: `CHECKLIST_FASES_FUTURAS_PRODUCAO.md`.

## Sequencia recomendada

### Fase 106 - Planos de acompanhamento e tarefas do paciente

Status: concluida em 2026-07-22.

Objetivo:

- Permitir que o profissional prescreva metas, tarefas e check-ins para o paciente entre consultas.

Entregas esperadas:

- Modelo de dados tenant-aware para plano de acompanhamento.
- Tarefas/metas vinculadas a paciente e profissional.
- CRUD backend com auditoria.
- BFF autenticado.
- UI no prontuario do paciente para criar e acompanhar tarefas.
- Preparacao de contrato para exibir no portal do paciente em fase futura.

Cuidados:

- Dados clinicos devem respeitar tenant e paciente.
- Criacao/edicao deve exigir permissao operacional adequada.
- Evitar expor dados de outros pacientes ou tenants.

### Fase 107 - Biblioteca de materiais e envio ao paciente

Status: concluida em 2026-07-22.

Objetivo:

- Criar biblioteca de materiais reutilizaveis, como links, PDFs e orientacoes.

Entregas esperadas:

- Cadastro/listagem de materiais por tenant.
- Categorias simples.
- Vinculo de material ao paciente ou plano de acompanhamento.
- Visibilidade preparada para portal do paciente.
- Auditoria de envio/vinculo.

Cuidados:

- Nao implementar upload complexo se ainda nao houver armazenamento definitivo.
- Comecar com links e metadados, deixando arquivo/binario para evolucao posterior se necessario.

### Fase 108 - Agenda de producao

Objetivo:

- Amadurecer a agenda para uso real com conflitos, remarcacao, cancelamento e disponibilidade.

Entregas esperadas:

- Validacao de conflito de horario.
- Remarcacao e cancelamento auditados.
- Estados claros de consulta.
- Sincronizacao minima com Google Calendar sem duplicidade.

Cuidados:

- Antes de mexer na integracao Google, ler `RUNBOOK_PRODUCAO.md` e `VARIAVEIS_AMBIENTE.md`.
- Se depender de credencial externa, pausar e pedir ao usuario.

### Fase 109 - Templates aprovados e mapeamento Meta WhatsApp

Objetivo:

- Mapear templates aprovados manualmente na Meta dentro do OctaClin.

Entregas esperadas:

- Configuracao de templates por evento.
- Validacao de campos obrigatorios.
- Uso do template correto para lembretes/transacionais.

Cuidados:

- O usuario informou que templates Meta podem ser tratados manualmente fora do sistema ate aprovacao.
- Nao hardcodar tokens ou nomes sensiveis.

### Fase 110 - Automacoes de lembrete e confirmacao de consulta

Objetivo:

- Automatizar lembretes e confirmacoes por email/WhatsApp.

Entregas esperadas:

- Regras de lembrete por consulta.
- Enfileiramento/outbox observavel.
- Logs e status de envio.
- Reprocessamento de falhas.

Cuidados:

- Nao enviar mensagens reais em massa durante testes.
- Usar mocks em testes automatizados.

### Fase 111 - Preferencias de comunicacao por paciente

Objetivo:

- Permitir opt-in/opt-out, canal preferido e horarios de contato.

Entregas esperadas:

- Persistencia de preferencias por paciente.
- UI para profissional visualizar/editar quando permitido.
- Base para paciente gerenciar preferencias no portal.
- Respeito das preferencias nos envios automatizados.

Cuidados:

- Decisao LGPD: preferencia de comunicacao deve ser auditavel.

### Fase 112 - Central de falhas de comunicacao

Objetivo:

- Melhorar suporte operacional para falhas de email, WhatsApp, calendario e outbox.

Entregas esperadas:

- Painel com falhas recentes.
- Filtros por canal/status/paciente.
- Acao de reprocessar quando segura.
- Exportacao ou diagnostico operacional simples.

Cuidados:

- Nao exibir secrets, tokens ou payloads sensiveis completos.
- Minimizar PII em logs e UI operacional.

## Validacoes minimas por fase

Sempre:

```powershell
pnpm --dir octaclin-backend typecheck
pnpm --dir octaclin-web typecheck
pnpm --dir octaclin-web test:authz
git diff --check
```

Se alterar backend:

```powershell
pnpm --dir octaclin-backend exec jest <specs-relacionados> --runInBand
pnpm --dir octaclin-backend build
```

Se alterar UI/BFF:

```powershell
pnpm --dir octaclin-web build
pnpm --dir octaclin-web exec playwright test tests/visual/console-regression.spec.mjs --project=desktop-chromium --project=mobile-chromium --reporter=list
```

Se alterar apenas documentacao:

```powershell
powershell -ExecutionPolicy Bypass -File .\validar-preflight.ps1 -DocsOnly
```

## Checklist de fechamento de cada fase

Antes de passar para a proxima fase:

- `fase-XXX-*.md` criado.
- `CHECKLIST_FASES_FUTURAS_PRODUCAO.md` atualizado.
- `RESUMO_FASES_CONCLUIDAS.md` atualizado quando aplicavel.
- `STATUS_ATUAL_PROJETO.md` atualizado.
- `MAPA_ROTAS_PERMISSOES.md` atualizado se houve rota/permissao.
- `TESTES_E_VALIDACOES.md` atualizado se houve novo padrao de teste.
- Validacoes executadas e registradas.
- Commit feito.
- Push feito.
- `git status --short` limpo.

## Limite de autonomia

Pode prosseguir por varias fases se:

- A fase estiver no checklist.
- Nao depender de decisao comercial/juridica nova.
- Nao exigir criar conta, aceitar termo, 2FA ou credencial externa.
- Nao exigir envio real em massa para pacientes.

Deve pausar e pedir ao usuario se:

- Precisar de acesso a Render, Neon, Upstash, Google, Meta ou OpenAI.
- Precisar de token, secret, senha ou dado sensivel.
- Precisar escolher provedor pago.
- Precisar alterar regra de negocio ainda nao decidida.
- Encontrar risco de vazamento de dados multi-tenant.
