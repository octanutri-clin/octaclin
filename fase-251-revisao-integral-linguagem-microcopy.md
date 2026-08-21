# Fase 251 - Revisao integral de linguagem e microcopy

Status: concluida em 2026-08-21.

## Objetivo

Uniformizar a linguagem visivel do OctaClin em portugues brasileiro, com voz
direta, acolhedora, clinica e responsavel. A fase reduz ambiguidade em acoes,
erros, vazios, confirmacoes e termos de permissao sem alterar contratos de API,
identificadores internos ou regras clinicas.

## Entregas

- `GUIA_VOZ_MICROCOPY.md` como fonte canonica para voz, padroes de mensagem,
  glossario, termos tecnicos e convencoes de portugues brasileiro.
- Auditoria e correcao das superficies profissionais, publicas e dos portais,
  incluindo acesso, Hoje, agenda, pacientes, prontuario, formularios,
  comunicacoes, nutricao e operacoes.
- Rota principal apresentada como `Hoje`, com `Painel clinico` no conteudo, e
  substituicao de rotulos tecnicos como `Status` por `Situacao` quando visiveis.
- Gate AST em `octaclin-web/scripts/linguagem-interface-lib.mjs`, com teste
  unitario, comando de verificacao e modo de correcao controlada. O gate cobre
  JSX, atributos visiveis, alternativas condicionais, setters de feedback,
  arquivos de dominio da interface e seletores Playwright, sem atravessar
  comparacoes ou identificadores internos.
- Comandos `test:linguagem`, `test:linguagem:fix` e `test:fase251`, executados
  tambem no CI.
- Cenario Playwright sintetico em desktop e celular para hierarquia, copia,
  foco visivel e ausencia de overflow horizontal.
- Correcao de contraste da marca no shell de acesso, de `text-primaria` para
  `text-primaria-forte`.

## Limites preservados

- O gate examina somente texto apresentado pela interface; valores de enum,
  chaves, rotas, IDs e contratos internos ficam fora da correcao automatica.
- Nenhum backend, migration, banco, dado clinico, segredo ou ambiente de
  producao foi alterado.
- Todos os dados usados no teste de navegador sao sinteticos.

## Validacoes

```powershell
pnpm --dir octaclin-web test:linguagem
pnpm --dir octaclin-web typecheck
pnpm --dir octaclin-web lint
pnpm --dir octaclin-web build
pnpm --dir octaclin-web test:fase251
pnpm --dir octaclin-web test:a11y
pnpm --dir octaclin-web test:fase248
pnpm --dir octaclin-web test:fase249
```

Resultados: gate de linguagem aprovado; typecheck e build de 123 rotas
aprovados; lint sem erros e com 52 avisos preexistentes de hooks; Playwright da
fase, 10 cenarios de acessibilidade, 6 jornadas criticas e regressao das Fases
248 e 249 aprovados. Os 8 testes do BFF de agendamento publico tambem passaram
pelo wrapper oficial. A inspecao no
navegador confirmou `lang=pt-BR`, um unico `main`, campos e botoes nomeados,
foco visivel, ausencia de overflow e nenhum erro no console. Lighthouse:
acessibilidade 100, boas praticas 100, SEO 100 e Agentic Browsing 100.

## Proxima fase

Fase 252 - Arquitetura de navegacao e descoberta de funcionalidades.

- Modelo: GPT-5.6 Sol, raciocinio `high`.
- Skills: `ecc:codebase-onboarding`, `ecc:click-path-audit`,
  `ecc:frontend-patterns`, `ecc:frontend-a11y` e
  `codex-security:validation`.
- Ferramentas: Browser, Chrome DevTools, Playwright e Penpot.
