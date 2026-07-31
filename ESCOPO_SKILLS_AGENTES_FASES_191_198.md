# OctaClin - Escopo de skills, agentes e plugins (Fases 191 a 198)

Este arquivo define, antes de iniciar o bloco de redesenho (Fases 191 a 198),
quais skills e agentes do Claude Code serao usados em cada fase. Ele complementa
`FERRAMENTAS_E_PLUGINS_RECOMENDADOS.md` (ferramentas/acessos externos para
qualquer desenvolvedor) e nao substitui nenhum comando de validacao de
`TESTES_E_VALIDACOES.md` (typecheck, lint, Playwright, `pnpm validate`).

Escopo coberto: Fase 191 (acesso/ativacao) ate Fase 198 (validacao final e
consolidacao visual), conforme `CHECKLIST_FASES_FUTURAS_PRODUCAO.md`.

## Plugins habilitados para este bloco

- `penpot` (MCP, escopo user): grava/le direto no Penpot, fecha a pendencia de
  gravacao registrada na Fase 189. Tools: `high_level_overview` (ler antes de
  qualquer outro), `execute_code`, `export_shape`, `penpot_api_info`.
- `ui-ux-pro-max` (marketplace `nextlevelbuilder/ui-ux-pro-max-skill`): banco de
  heuristicas de UX/UI local (contraste, touch target, motion, forms, nav). Uso
  restrito a busca (`search.py --domain ux`), nunca aos sub-skills de geracao de
  imagem (logo, CIP, banner, social photos, slides) — produto clinico interno,
  nao material de marketing, e sem `GEMINI_API_KEY` configurada.

## Baseline (aplica a todas as fases 191-198)

| Item | Tipo | Motivo |
| --- | --- | --- |
| `superpowers:test-driven-development` | Skill | TDD ja exigido por `AGENTS.md` para toda mudanca de produto/bugfix. |
| `ecc:react-reviewer` | Agente | Revisao de todo diff em `octaclin-web` (hooks, render, boundaries). |
| `ecc:typescript-reviewer` | Agente | Revisao de tipos/contratos em backend e frontend. |
| `ecc:a11y-architect` | Agente | Gate de acessibilidade (WCAG 2.2, foco, ARIA) — todas as fases tocam UI. |
| `ui-ux-pro-max` (busca) | Skill | Checklist de heuristica UX (contraste, touch 44px, forms, nav) como camada extra sobre os testes de acessibilidade ja existentes. |
| `ui-styling` (referencia) | Skill | Consulta a `references/shadcn-accessibility.md` e utilitarios Tailwind — repo ja usa Tailwind + `class-variance-authority`/`clsx`. Nao instalar shadcn/Radix; componentes proprios (`Campo`, `Botao`, `Selecao`) continuam sendo a base. |

Nao usar como baseline (evitar redundancia): `ecc:code-simplifier`, `pr-review-toolkit:*`
e `ecc:security-review` ficam sob demanda, so quando a fase tocar auth, tenant
ou dado sensivel (ver tabela abaixo).

## Por fase

### Fase 191 - Acesso e ativacao do usuario
- Skill: `ecc:frontend-a11y` (Caps Lock, show/hide senha, leitor de tela).
- Skill: `ui-ux-pro-max --domain ux "forms error focus"`.
- Agente: `ecc:security-reviewer` (token expirado e fluxo de auth = fronteira sensivel).

### Fase 192 - Centro clinico diario e agenda profissional
- Skill: `superpowers:subagent-driven-development` (dashboard, calendario e painel lateral sao tarefas paralelas independentes).
- Skill: `ui-ux-pro-max --domain ux "navigation modal"`.
- Agente: `ecc:database-reviewer` (conflito/bloqueio de horario).
- Agente: `ecc:e2e-runner` (jornadas dia/semana/mes/lista via Playwright).

### Fase 193 - Pacientes e prontuario orientados a conduta
- Skill: `ecc:healthcare-emr-patterns` (padrao de prontuario/timeline clinica).
- Skill: `ui-ux-pro-max --domain ux "unsaved changes warning"`.
- Agente: `ecc:security-reviewer` (regra de tenant/dado sensivel do `AGENTS.md`).
- Agente: `ecc:silent-failure-hunter` (protecao contra perda de evolucao em edicao).

### Fase 194 - Formularios, editor e leitura longitudinal
- Skill: `ecc:api-design` (recorrencia cron vira contrato em linguagem comum).
- Skill: `superpowers:writing-plans` (divisao em 5 sub-modulos exige plano antes de codar).
- Skill: `ui-ux-pro-max --domain ux "drag reorder keyboard"`.
- Agente: `ecc:pr-test-analyzer` (comparacao longitudinal exige cobertura real).

### Fase 195 - Portal do paciente e jornadas publicas
- Skill: `ecc:accessibility`.
- Skill: `ui-ux-pro-max --domain ux "bottom nav mobile"`.
- Agente: `ecc:e2e-runner` (fluxo publico sem autenticacao).
- Agente: `ecc:security-reviewer` (rascunho persistente publico = nova fronteira de confianca).

### Fase 196 - Comunicacoes, equipe e conta do cliente
- Skill: `superpowers:subagent-driven-development` (3 reestruturacoes independentes: comunicacoes, profissionais, portal comercial).
- Skill: `ui-ux-pro-max --domain ux "inbox conversation navigation"`.
- Agente: `ecc:silent-failure-hunter` (falha de comunicacao nao pode ficar silenciosa).
- Agente: `ecc:security-reviewer` (troca de contexto exclusiva do SuperAdmin).

### Fase 197 - Racionalizacao dos modulos avancados (IA/automacoes)
- Skill: `claude-api` (obrigatorio pelo trigger sempre que o modulo IA/LLM for tocado).
- Agente: `ecc:security-reviewer` (IA nunca executa conduta sem revisao humana = guardrail).
- Agente: `ecc:silent-failure-hunter` (simulacao/historico antes de ativar automacao).
- Sem skill de UI dedicada: fase e sobretudo logica/guardrail, nao peca visual nova.

### Fase 198 - Validacao final de usabilidade e consolidacao visual
- Skill: `superpowers:verification-before-completion`.
- Skill: `ui-ux-pro-max` (auditoria completa: contraste, animacao, formularios) como segunda camada sobre o gate Playwright de acessibilidade ja existente.
- Agente: `ecc:e2e-runner` (jornadas completas + screenshots desktop/mobile).
- Agente: `ecc:a11y-architect` (gate final de acessibilidade).
- MCP `penpot`: gravar consolidacao visual e mapeamento de componentes (fecha a pendencia da Fase 189).

## Fora de escopo (explicitamente pulado)

- `design-system` (sub-skill de `ui-ux-pro-max-skill`, com scripts de geracao de token): a Fase 190 exige "nenhum segundo sistema de componentes"; rodar `generate-tokens.cjs` criaria uma trilha de token paralela ao Penpot/Figtree ja aceito. Uso permitido apenas como leitura de referencia, nunca escrita.
- `brand`, `banner-design`, `slides` e o modulo logo/CIP de `design` (todos do plugin `ui-ux-pro-max-skill`): geram ativos via Gemini para marketing/pitch deck; nao ha demanda de marketing nas Fases 191-198 e `GEMINI_API_KEY` nao esta configurada.
- Skills `figma:*`: produto errado. OctaClin usa Penpot (MCP `penpot` acima), nao Figma.

## Modelo Claude recomendado por tarefa/agente

Heuristica (`ecc:model-route`): `haiku` = mecanico/deterministico e baixo risco;
`sonnet` = padrao para implementacao/refatoracao (default); `opus` = arquitetura,
revisao profunda ou requisito ambiguo/alto risco. Fallback = modelo a usar se o
resultado do primeiro nao convencer (achado raso, revisao superficial etc.).

| Fase | Tarefa/Agente | Modelo | Confianca | Motivo | Fallback |
| --- | --- | --- | --- | --- | --- |
| Baseline | Implementacao direta (Claude Code) | sonnet | alta | UI/refactor padrao, spec ja detalhada no checklist | opus se requisito ficar ambiguo em runtime |
| Baseline | `ecc:react-reviewer` | sonnet | alta | padrao React ja estabelecido no repo | haiku se diff trivial (rename/typo) |
| Baseline | `ecc:typescript-reviewer` | sonnet | alta | contratos/tipos com regra clara | haiku se diff trivial |
| Baseline | `ecc:a11y-architect` | sonnet | media-alta | checklist WCAG bem definido | opus se achado exigir redesenho de interacao |
| 191 | Implementacao (shell auth) | sonnet | alta | UI bem especificada na checklist | opus se logica de token/expiracao ficar ambigua |
| 191 | `ecc:security-reviewer` | opus | alta | fronteira de auth = alto risco, exige raciocinio de ameaca | sonnet se escopo for so lint de padrao ja usado |
| 192 | Planejamento (split dashboard/calendario/painel) | opus | media | decisao arquitetural de como dividir 3 superficies independentes | sonnet apos plano definido |
| 192 | Implementacao por subagente | sonnet | alta | segue plano ja definido | - |
| 192 | `ecc:database-reviewer` | opus | alta | conflito/bloqueio + isolamento tenant, historico de bug real (Fase 122) | sonnet se so validar query ja usada em outro modulo |
| 192 | `ecc:e2e-runner` | sonnet | alta | geracao/triagem Playwright, padrao ja usado | haiku se so rodar suite existente sem falha |
| 193 | Implementacao prontuario | sonnet | alta | segue padrao das Fases 104-108 | opus se draft-loss exigir novo mecanismo (autosave) |
| 193 | `ecc:security-reviewer` | opus | alta | dado clinico sensivel, regra de tenant critica do `AGENTS.md` | sonnet se mudanca for so cosmetica |
| 193 | `ecc:silent-failure-hunter` | sonnet | media-alta | grep + padrao de falha silenciosa, mecanico | opus se exigir novo fluxo de recuperacao |
| 194 | Implementacao formularios/editor | sonnet | alta | escopo bem definido (5 sub-modulos ja descritos) | opus se contrato de recorrencia exigir nova modelagem |
| 194 | `ecc:pr-test-analyzer` | sonnet | media-alta | analise de cobertura estruturada | opus se comparacao longitudinal for ambigua |
| 195 | Implementacao portal publico | sonnet | alta | reaproveita padrao das Fases 162-182 | opus se rascunho persistente exigir novo modelo de dados |
| 195 | `ecc:security-reviewer` | opus | alta | novo trust boundary (dado publico sem auth) | sonnet se so validar rate-limit ja existente |
| 195 | `ecc:e2e-runner` | sonnet | alta | fluxo publico, padrao Playwright ja usado | - |
| 196 | Implementacao comms/equipe/conta | sonnet | alta | reestruturacao de UI, padrao repetido (Fases 145/185) | opus se permissao SuperAdmin ganhar caso de borda novo |
| 196 | `ecc:security-reviewer` | sonnet | media-alta | reusa padrao SuperAdmin-only ja validado | opus se aparecer caso novo de escalonamento |
| 196 | `ecc:silent-failure-hunter` | sonnet | media | falha de canal ja coberta pela central de falhas (Fase 112) | opus se exigir novo fluxo |
| 197 | Design do guardrail IA/automacoes | opus | media | decisao ambigua e critica: aceitar/editar/rejeitar sugestao IA, simulacao antes de ativar | sonnet apos guardrail definido, so pra parte mecanica |
| 197 | `ecc:security-reviewer` | opus | alta | guardrail e a unica defesa contra IA agir sem revisao humana | sonnet se so validar guardrail ja implementado |
| 197 | `ecc:silent-failure-hunter` | sonnet | media | historico/simulacao, mecanico apos design pronto | opus se logica de simulacao for nova |
| 198 | Implementacao/consolidacao final | sonnet | alta | agrega trabalho ja feito, poucas decisoes novas | opus se divergencia Penpot/codigo exigir arbitragem |
| 198 | `ecc:e2e-runner` | sonnet | alta | roda jornadas completas e compara com baseline | haiku se so re-executar suite sem analisar falha |
| 198 | `ecc:a11y-architect` | sonnet | alta | gate final segue checklist ja usado nas fases anteriores | opus se achado novo exigir redesenho |

`haiku`/`opus` so entram via `model` explicito na chamada do Agent tool; sem
isso, o subagente herda o modelo da sessao principal (Sonnet 5).

## Como usar este arquivo

Antes de iniciar uma fase deste bloco, reler a secao correspondente aqui junto
com `CHECKLIST_FASES_FUTURAS_PRODUCAO.md`, `AGENTS.md` e `MAPA_ROTAS_PERMISSOES.md`
se a fase tocar permissao. Ao concluir a fase, se o mapeamento de skill/agente
usado divergir do planejado aqui, atualizar esta tabela junto com o registro
da fase.
