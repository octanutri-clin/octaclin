# OctaClin - Guia para agentes de IA

Este arquivo e a primeira leitura obrigatoria para Codex, Claude Code ou qualquer outro agente de IA trabalhando neste repositorio.

## Leitura obrigatoria antes de alterar codigo

1. `RESUMO_FASES_CONCLUIDAS.md`
2. `CHECKLIST_FASES_FUTURAS_PRODUCAO.md`
3. Os arquivos `fase-*.md` mais recentes relacionados ao trabalho atual.
4. `VARIAVEIS_AMBIENTE.md` se a tarefa tocar deploy, integracoes, secrets ou ambiente.
5. `RUNBOOK_PRODUCAO.md` se a tarefa tocar Render, Neon, Upstash, Gmail, Meta, Google Calendar ou operacao.
6. `DECISOES_ARQUITETURA.md` se a tarefa alterar arquitetura, seguranca, tenancy, auth, dados ou integracoes.

## Estado atual

- Produto: OctaClin.
- LiveClin foi apenas referencia de modelagem.
- Fase concluida mais recente no momento deste arquivo: Fase 101.
- Proxima fase planejada: Fase 102 - Bloqueios suaves por inadimplencia/limite.
- O checklist vivo das proximas fases fica em `CHECKLIST_FASES_FUTURAS_PRODUCAO.md`.

## Regras de trabalho

- Trabalhe por fases numeradas.
- Nao pule fase sem decisao explicita do usuario.
- Ao concluir uma fase, crie ou atualize o arquivo `fase-XXX-*.md`.
- Ao concluir uma fase, atualize `CHECKLIST_FASES_FUTURAS_PRODUCAO.md`.
- Quando a fase consolidar uma capacidade do produto, atualize tambem `RESUMO_FASES_CONCLUIDAS.md`.
- Use commits pequenos e objetivos.
- Por padrao, faca push para `main` apos validar e commitar, pois o usuario pediu continuidade com GitHub como fonte de verdade.
- Nunca reverta mudancas que voce nao fez sem pedido explicito.
- Nunca commite secrets, tokens, senhas, arquivos `.env` reais, dumps de banco ou logs com credenciais.

## TDD e validacao

Para mudancas de produto ou bugfix:

1. Escreva teste primeiro.
2. Rode o teste e veja falhar pelo motivo esperado.
3. Implemente o minimo necessario.
4. Rode o teste novamente.
5. Rode validacoes de regressao proporcionais ao risco.

Validacoes comuns:

```powershell
pnpm --dir octaclin-backend test -- <specs> --runInBand
pnpm --dir octaclin-backend typecheck
pnpm --dir octaclin-web typecheck
pnpm --dir octaclin-web test:authz
pnpm --dir octaclin-web build
pnpm --dir octaclin-web exec playwright test tests/visual/portal-cliente.spec.mjs --reporter=list
```

Em Windows, se `node`, `pnpm` ou `git` nao estiverem no PATH, procure os runtimes empacotados do Codex antes de desistir.

## Padroes de arquitetura

- Backend: `octaclin-backend`, NestJS, TypeORM, PostgreSQL.
- Frontend: `octaclin-web`, Next.js App Router, rotas BFF em `app/api`.
- Tenant e derivado do JWT e aplicado por `ExecutorTenant`; nao aceite tenant livre vindo do cliente.
- Sessao web usa cookies HttpOnly.
- Dados sensiveis devem ser criptografados ou minimizados em DTOs.
- Arquivamento logico e preferido a delete fisico em dados clinicos/operacionais.
- Acoes sensiveis devem ter auditoria.
- Rotas frontend devem passar pelo BFF quando dependerem de sessao autenticada.

## Papeis atuais

- `SuperAdmin`: operacao/admin interno.
- `Professional`: profissional/clinico.
- `Collaborator`: colaborador operacional.
- `Patient`: portal do paciente.
- `Client`: gestor da conta/cliente SaaS.

## Integracoes ja existentes

- Neon PostgreSQL.
- Render.
- Upstash Redis.
- Gmail SMTP/Gmail API.
- Google Calendar.
- Meta WhatsApp Cloud API.
- Webhooks WhatsApp.

Antes de mexer em qualquer integracao, leia `VARIAVEIS_AMBIENTE.md` e `RUNBOOK_PRODUCAO.md`.

## Como fechar uma fase

1. Rode validacoes frescas.
2. Atualize documentacao da fase.
3. Atualize o checklist vivo.
4. Rode `git diff --check`.
5. Faça commit com mensagem objetiva.
6. Faça push.
7. Responda ao usuario com resumo, commit e validacoes.

## Quando estiver em duvida

- Prefira manter escopo estreito.
- Preserve decisoes ja documentadas.
- Consulte `CHECKLIST_FASES_FUTURAS_PRODUCAO.md` para a ordem do roadmap.
- Se uma tarefa depender de conta externa, login, 2FA ou aprovacao manual, explique exatamente o que o usuario precisa fazer e retome depois.
