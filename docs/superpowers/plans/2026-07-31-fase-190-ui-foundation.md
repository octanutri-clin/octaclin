# Fase 190 - Arquitetura de navegacao e sistema visual definitivo

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidar a navegacao e o shell operacional do OctaClin como base responsiva e acessivel para o proximo ciclo de redesenho.

**Architecture:** Manter `ConsoleShell` como fonte unica dos modulos e `PortalShell` como renderizador compartilhado. Reutilizar sessao e permissoes existentes, sem novo endpoint ou dependencia; recursos avancados continuam acessiveis por URL autorizada, mas saem da navegacao diaria.

**Tech Stack:** Next.js 15, React 18, TypeScript, Tailwind CSS, Lucide React e Playwright.

## Global Constraints

- Preservar Figtree/Noto Sans, alvos de toque de 44 px e foco visivel.
- Nao alterar contratos de backend, tenancy, cookies ou permissoes.
- Nao criar uma segunda biblioteca visual nem adicionar dependencia.
- Nao expor IDs, tokens, API ou tenant bruto na interface.
- Manter IA, Mobile e Gamificacao acessiveis por URL autorizada, fora da navegacao principal.

---

### Task 1: Contrato da nova navegacao

**Files:**
- Modify: `octaclin-web/scripts/test-base-visual-navegacao.mjs`
- Modify: `octaclin-web/tests/visual/console-regression.spec.mjs`

**Interfaces:**
- Consumes: `ConsoleShell`, `PortalShell` e `/api/auth/session`.
- Produces: contrato executavel para grupos Clinica, Relacionamento, Gestao e SuperAdmin.

- [ ] **Step 1: Escrever o teste que exige os quatro grupos e remove modulos avancados da navegacao principal**

```js
for (const grupo of ['Clinica', 'Relacionamento', 'Gestao', 'SuperAdmin']) {
  assert.match(consoleShell, new RegExp(`grupo: '${grupo}'`));
}
for (const rota of ['/ia', '/mobile', '/gamificacao']) {
  assert.doesNotMatch(consoleShell, new RegExp(`href: '${rota}'`));
}
```

- [ ] **Step 2: Rodar `pnpm --dir octaclin-web test:base-visual` e confirmar falha pelos grupos ausentes**
- [ ] **Step 3: Atualizar a expectativa Playwright do menu diario sem remover os testes diretos das rotas avancadas**

### Task 2: Shell clinico responsivo e contextual

**Files:**
- Modify: `octaclin-web/components/app/console-shell.tsx`
- Modify: `octaclin-web/components/app/portal-shell.tsx`
- Modify: `octaclin-web/components/ui/feedback.tsx`
- Modify: `octaclin-web/app/dashboard/page.tsx`
- Modify: `octaclin-web/components/agenda/painel-agenda.tsx`
- Modify: `octaclin-web/components/cadastros/lista-pacientes.tsx`

**Interfaces:**
- Consumes: `SessaoPublica`, permissoes e itens de navegacao existentes.
- Produces: contexto de conta, acoes rapidas reais, menu de conta nativo e skeleton compartilhado.

- [ ] **Step 1: Reorganizar itens por grupo e renomear Dashboard para Hoje e Questionarios para Formularios**
- [ ] **Step 2: Derivar contexto apresentavel de email, papel e workspace sem mostrar o slug bruto**
- [ ] **Step 3: Adicionar atalhos para agenda, pacientes e comunicacoes somente quando permitidos**
- [ ] **Step 4: Usar `<details>` nativo no menu de conta e manter `Sair` como acao explicita**
- [ ] **Step 5: Adicionar skeleton compartilhado e usa-lo no carregamento da navegacao e do dashboard**
- [ ] **Step 6: Criar ancoras reais para novo agendamento e novo paciente**
- [ ] **Step 7: Rodar teste de contrato e typecheck ate ficarem verdes**

### Task 3: Evidencia visual e responsiva

**Files:**
- Modify: `octaclin-web/tests/visual/console-regression.spec.mjs`

**Interfaces:**
- Consumes: shell implementado na Task 2.
- Produces: verificacao desktop/mobile de menu, contexto, atalhos e ausencia de overflow.

- [ ] **Step 1: Validar os rotulos diarios e confirmar que IA, Mobile e Gamificacao nao aparecem no menu**
- [ ] **Step 2: Validar workspace humanizado, papel e email no menu de conta**
- [ ] **Step 3: Rodar os cenarios direcionados em desktop e celular**

### Task 4: Documentacao e fechamento

**Files:**
- Create: `fase-190-arquitetura-navegacao-sistema-visual.md`
- Modify: `CHECKLIST_FASES_FUTURAS_PRODUCAO.md`
- Modify: `RESUMO_FASES_CONCLUIDAS.md`

**Interfaces:**
- Consumes: resultados frescos de testes, typecheck, autorizacao, acessibilidade e build.
- Produces: estado factual para continuidade por outro agente.

- [ ] **Step 1: Rodar `test:base-visual`, `typecheck`, cenarios Playwright, `test:a11y`, `test:authz` e `build`**
- [ ] **Step 2: Documentar entregas, limites e resultados sem marcar gate nao executado**
- [ ] **Step 3: Marcar Fase 190 concluida no checklist e resumo somente apos todos os gates obrigatorios**
- [ ] **Step 4: Rodar `git diff --check`, revisar o diff e criar commit objetivo**
