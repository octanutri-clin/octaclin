<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# OctaClin Web

As regras do `../AGENTS.md` continuam obrigatorias. O bloco Next.js acima e
gerenciado: nao edite dentro dos marcadores. Regras OctaClin ficam fora deles.

## Fronteiras de seguranca

- O navegador chama o BFF em `app/api`; chamadas autenticadas ao backend saem
  do servidor por `lib/server/sessao-bff.ts` e
  `requisitarBackendAutenticado`. Preserve os wrappers compartilhados em vez de
  criar um segundo fluxo de sessao, renovacao ou erro.
- Tokens e contexto de sessao permanecem em cookies HttpOnly. Nao exponha token,
  URL interna, credencial ou dado clinico em Client Components, bundle,
  `localStorage`, query string, log ou telemetria.
- Middleware e interface melhoram a experiencia, mas nao substituem autorizacao.
  BFFs protegidos exigem sessao e, quando aplicavel, permissao; o backend
  continua sendo a fronteira autoritativa.
- Rotas publicas devem permanecer explicitamente publicas e aceitar somente a
  capability prevista pelo fluxo. Nao derive tenant de parametro arbitrario do
  navegador.
- O service worker guarda apenas recursos publicos estaticos. Nunca coloque
  resposta autenticada, HTML protegido ou dado clinico no Cache Storage.

## Implementacao

- Preserve a separacao entre Server e Client Components e mantenha secrets e
  acesso direto ao backend somente no servidor.
- Consulte `node_modules/next/dist/docs/` antes de alterar APIs do framework e
  respeite contratos assincronos de APIs dinamicas da versao instalada.
- Reutilize `requisitarBackendAutenticado`, `exigirPermissaoBff`, os helpers de
  resposta e o catalogo de autorizacao existentes. Nao replique authz em listas
  locais divergentes.
- Interfaces devem funcionar em desktop e mobile, manter foco visivel, nomes
  acessiveis e estados de carregamento, vazio, erro e recuperacao sem expor
  detalhes internos.

## Validacao

- Para mudanca de BFF/authz, execute `pnpm test:authz` e o teste especifico da
  superficie; para PWA, `pnpm test:pwa`.
- Para interface, execute lint, typecheck e Playwright proporcional ao risco,
  incluindo desktop/mobile e `pnpm test:a11y` quando aplicavel.
- Antes de concluir alteracao neste arquivo, rode `pnpm dev`, aguarde o Next
  iniciar e reinspecione `AGENTS.md` para confirmar que estas regras continuam
  fora do bloco gerenciado.
