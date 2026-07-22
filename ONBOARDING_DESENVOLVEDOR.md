# OctaClin - Onboarding do desenvolvedor

Este guia e para desenvolvedores e agentes de IA que vao trabalhar no OctaClin junto com o dono do projeto, usando o mesmo GitHub como fonte de verdade.

## Premissa de trabalho

- O repositorio oficial e `octanutri-clin/octaclin`.
- O desenvolvimento deve continuar por fases numeradas.
- A fase atual concluida e a Fase 105.
- A proxima fase planejada e a Fase 106 - Planos de acompanhamento e tarefas do paciente.
- Nao vamos duplicar direcao de produto em paralelo. Quando um desenvolvedor estiver codando uma fase, os demais ficam em pausa ou atuam apenas em revisao/documentacao combinada.

## Primeira leitura obrigatoria

1. `AGENTS.md`
2. `CHECKLIST_FASES_FUTURAS_PRODUCAO.md`
3. `RESUMO_FASES_CONCLUIDAS.md`
4. `STATUS_ATUAL_PROJETO.md`
5. `HANDOFF-TECNICO-OCTACLIN.md`
6. `MAPA_ROTAS_PERMISSOES.md`
7. `TESTES_E_VALIDACOES.md`
8. `VARIAVEIS_AMBIENTE.md`
9. `RUNBOOK_PRODUCAO.md`
10. Os ultimos arquivos `fase-*.md`

## Como entrar no projeto

Se o desenvolvedor ja vai conectar o Codex/IA dele ao GitHub, ele deve:

1. Abrir o repositorio `octanutri-clin/octaclin` na ferramenta dele.
2. Confirmar que esta na branch `main` atualizada.
3. Ler os documentos obrigatorios acima antes de pedir qualquer alteracao a IA.
4. Conferir o ultimo commit com `git log --oneline --max-count=5`.
5. Confirmar que o trabalho seguinte e a Fase 106, salvo nova decisao do usuario.

Se ele for trabalhar em maquina local propria, pode clonar o repo normalmente. Se ele estiver apenas plugando uma IA ao GitHub, nao precisa clonar antes de entender o roadmap.

## Fluxo de coordenacao

- Uma pessoa ou IA fica responsavel por uma fase por vez.
- Antes de iniciar uma fase, registrar no chat/time: `Iniciando Fase XXX - nome`.
- Enquanto uma fase estiver em andamento, evitar outros commits na `main`.
- Se alguem precisar mexer em paralelo, usar branch separada e avisar o escopo.
- Ao terminar, a fase deve gerar um commit pequeno, validado e com documentacao atualizada.
- Depois do push, os demais devem dar pull/sincronizar antes de continuar.

## Regras para agentes de IA

- Ler `AGENTS.md` antes de editar.
- Nao inventar fase nova sem atualizar o checklist.
- Nao pular fase sem decisao explicita do usuario.
- Nao commitar secrets, `.env`, dumps, logs ou tokens.
- Nao reverter alteracoes recentes de outro agente sem pedido explicito.
- Usar TDD em mudancas funcionais: teste falhando, implementacao, teste passando.
- Atualizar ao fim de cada fase:
  - `fase-XXX-*.md`
  - `CHECKLIST_FASES_FUTURAS_PRODUCAO.md`
  - `RESUMO_FASES_CONCLUIDAS.md`, quando consolidar capacidade
  - `STATUS_ATUAL_PROJETO.md`, se mudar estado do produto
  - `MAPA_ROTAS_PERMISSOES.md`, se mudar rota/permissao
  - `TESTES_E_VALIDACOES.md`, se mudar padrao de teste

## Comandos essenciais

Backend:

```powershell
pnpm --dir octaclin-backend typecheck
pnpm --dir octaclin-backend exec jest <spec> --runInBand
pnpm --dir octaclin-backend build
```

Web:

```powershell
pnpm --dir octaclin-web typecheck
pnpm --dir octaclin-web test:authz
pnpm --dir octaclin-web build
pnpm --dir octaclin-web exec playwright test tests/visual/console-regression.spec.mjs --reporter=list
```

Preflight:

```powershell
powershell -ExecutionPolicy Bypass -File .\validar-preflight.ps1 -DocsOnly
```

Higiene antes de commit:

```powershell
git diff --check
git status --short
```

## Ambiente local

Arquivos de exemplo:

- `octaclin-backend/.env.example`
- `octaclin-web/.env.example`

Copiar para `.env` apenas no ambiente local, nunca commitar `.env` real.

## Integrações externas

O projeto ja usa:

- Render
- Neon PostgreSQL
- Upstash Redis
- Gmail SMTP/Gmail API
- Google Calendar
- Meta WhatsApp Cloud API

O desenvolvedor nao precisa de todos os acessos no primeiro dia. Conceda apenas o necessario para a fase em andamento.

## Primeiro trabalho recomendado

Comecar pela Fase 106:

- Planejar modelo de dados de planos de acompanhamento.
- Criar tarefas/metas prescritas pelo profissional.
- Exibir no prontuario do profissional.
- Preparar visibilidade futura no portal do paciente.
- Atualizar roadmap e resumo ao final.
