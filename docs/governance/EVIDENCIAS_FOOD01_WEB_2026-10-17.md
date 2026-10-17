# FOOD01 — evidências Web (2026-10-17)

Checkpoint T06 preservado. A integração Sol, as correções e as provas adicionais
estão no [relatório final](RELATORIO_FOOD01_2026-10-17.md), que atualiza os gates
e limites pendentes registrados ao final deste documento.

## Escopo executado

Validação local com fixture sintética, sem pacientes reais, banco externo,
migration externa, deploy, merge ou chamada a serviço de terceiro. O servidor
Next local usou Webpack porque `node_modules` é um symlink para dependências com
lockfile idêntico e o Turbopack não aceita essa topologia fora do projeto.

## Resultados

| Verificação | Resultado | Observação |
|---|---|---|
| TypeScript Web (`tsc --noEmit`) | PASS | Executado após as alterações finais de tipos e contexto. |
| BFF de planos alimentares | PASS, 45/45 | Sessão/permissões, allowlist de paginação, UUID, corpo limitado, `no-store`, falha sanitizada e rotas FOOD01. |
| Regressão nutricional/editora (`test-nutricao-plano.mjs`) | PASS, 62/62 | Inclui aritmética decimal FOOD01 e regressões PA03–PA07. |
| Playwright FOOD01 desktop Chromium | PASS | Criação, aplicação explícita, edição, desativação, Axe e round-trip do snapshot. |
| Playwright FOOD01 mobile Chromium | PASS | Mesmo fluxo da fixture sintética em viewport mobile. |
| `test:authz` Web | PASS | Suítes agregadas completadas sem falhas; logs de teste registraram advertências esperadas de `headers()` fora de request em fixtures. |
| ESLint focado (componente e helpers novos) | PASS | Sem avisos após correção do estado por contexto. |
| ESLint nos arquivos Web alterados | PASS com avisos | Sem erros. Permanecem avisos preexistentes de hooks/refs no arquivo extenso `plano-alimentar-profissional.tsx`, em trechos fora da lógica FOOD01. |

## Comportamentos verificados no navegador

- Aplicar medida exige ação explícita e conserva descriptor `{id,revisao,aplicacaoId}`.
- Conversão sintética `2,5 × 25 g = 62,5 g`; ao recarregar, o plano continua
  usando a base de 25 g materializada, embora a biblioteca passe a ter outra
  equivalência.
- Editar/desativar a biblioteca não altera a seleção já aplicada. O fluxo de
  criação, edição e desativação funciona no desktop e no mobile.
- Salvar o rascunho envia o vínculo mínimo, sem mapa de referência/base privada.
- O seletor passa pela análise Axe focada no componente na fixture desktop.

## Limites desta evidência

Não foi executado `next build`, CI do GitHub, Playwright de toda a aplicação,
auditoria independente, teste manual por leitor de tela nem verificação
separada dos fluxos portal/PDF. O comportamento de conflitos de revisão é
tratado sem retry: descarta a edição stale e atualiza a lista; ainda falta um
teste visual dedicado para forçar a resposta 409.
