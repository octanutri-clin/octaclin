# FOOD06 P3-6 — telas de equipe e NUX-24 web (R4)

Plano: `tasks/food06-p3-plano.md` (§1 P3-6, Q-C). Depende do backend P3-0b (#560) e P3-0a (#559). Sem migration; flag
`OCTACLIN_WEB_RESTRICOES_CLINICAS` desligada por padrão; mobile segue NO-GO (web responsiva não é o app).

## O que entrou

- **NUX-24 web**: "Não sei dizer" no portal manda `classificacaoPeloPaciente: 'nao_sabe'` (o navegador continua mandando só a
  escolha; o BFF monta o conteúdo). A tela do profissional que mostra "Tipo não informado pelo paciente" é a P3-3.
- **BFF de equipe** (`lib/server/restricoes-equipe-bff.ts`): delegações (`pacientes.ler` para ler; `pacientes.gerenciar` para
  candidatos, conceder e revogar) e representantes (`pacientes.ler`). Corpo exato, ids UUID, Origin da web, projeção por allowlist
  (`lib/restricoes-equipe.ts`), erros com mensagem fixa e `private, no-store`. O e-mail da busca vai só no corpo, normalizado.
  Titular, carteira, delegação, elegibilidade e cota ficam no backend.
- **Repasse comum** (`lib/server/restricoes-bff-comum.ts`) extraído do BFF do portal e usado pelos dois; efeito colateral
  documentado: o 429 do backend passa a chegar ao navegador com mensagem fixa (o portal o trata como falha de leitura).
- **Disponibilidade de equipe** (`/api/restricoes/equipe/disponibilidade`): web E tenant (rota P3-0a); qualquer falha → `false`.
  Atende a condição de ativação "a entrada não aparece e depois dá sem acesso".
- **Telas**: `/conta/delegacao` (titular) e `/pacientes/[id]/representantes` (equipe), atalho no prontuário só com a área ligada e
  respeitando alterações não salvas. UX B aplicada (ver `docs/agents/ux/reports/FOOD06-P3-6-B-2026-11-19/`).

## Provas

- Unitários (`scripts/restricoes-equipe.spec.ts`, `scripts/restricoes-equipe-bff.spec.ts`, encadeados em `test:authz`).
- Playwright `food06-restricoes-equipe.spec.mjs` desktop e mobile com axe, teclado, região viva, reflow a 320 px e nada guardado no
  navegador; regressão dos specs do portal e do prontuário.
- Matriz de acessibilidade: gate `web-food06-restricoes-equipe`.

## Pendente de decisão

NUX-08 (entrada da delegação) e se a delegação deve aparecer com o portal desligado. Ver o consolidado da etapa B.
