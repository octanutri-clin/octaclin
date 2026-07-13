# Fase 34 - QA Visual e Navegacao

## Objetivo

Consolidar a experiencia de navegacao do console OctaClin depois da expansao para Questionarios, Comunicacoes, Automacoes, IA, Mobile, Gamificacao, Operacoes, Pacientes e Profissionais.

## Entregas

- Sidebar ajustada para 248px no desktop, com area de conteudo `minmax(0, 1fr)` para reduzir risco de overflow.
- Navegacao sticky no topo em telas menores, mantendo os modulos acessiveis por rolagem horizontal.
- Links do menu com `aria-current="page"` no item ativo.
- Foco visivel reforcado nos links da navegacao.
- Icones e rotulos com dimensoes estaveis para evitar quebra visual em telas estreitas.
- Conteudo central limitado a `1500px`, preservando densidade de dashboard em telas largas.
- Metadata global atualizada para representar o console operacional completo.
- Smoke E2E BFF ampliado para validar que paginas protegidas renderizam marca, shell do console e titulo esperado.

## Arquivos principais

- `outputs/octaclin-web/components/app/console-shell.tsx`
- `outputs/octaclin-web/app/layout.tsx`
- `outputs/octaclin-web/scripts/smoke-e2e-bff.mjs`

## Validacao esperada

- `node --check outputs/octaclin-web/scripts/smoke-e2e-bff.mjs`
- `next build`
- `tsc --noEmit`
- `outputs/verificar-demo-local.ps1`
- `outputs/octaclin-web/scripts/smoke-e2e-bff.mjs`

## Proximo passo sugerido

Depois desta consolidacao visual, o proximo incremento mais eficiente e escolher entre:

- Fase 35 - Persistencia/listagens dos consoles que hoje criam dados apenas na sessao da tela.
- Fase 35 - Polimento de formularios e estados vazios por modulo.
