# Fase 43 - Regressao UI e handoff QA

## Objetivo

Transformar a validacao visual e operacional recorrente do OctaClin em um pacote executavel, com foco em detectar quebras de login, shell, rotas protegidas, titulos e contratos basicos de UI antes de novas fases.

## Entregas

- Criado `scripts/smoke-ui-regression.mjs`.
- Adicionado alias `npm run smoke:ui`.
- Documentado o smoke de UI no README do frontend.
- O smoke valida:
  - redirecionamento de rota protegida sem sessao;
  - tela de login com campos API, Tenant, Email e Senha;
  - login BFF com credenciais seed;
  - renderizacao das 9 rotas protegidas principais;
  - shell do console com marca e menu completo;
  - titulos/subtitulos esperados por rota;
  - ausencia de erros brutos do Next.js;
  - ausencia de referencia ao sistema usado apenas como modelo.

## Rotas cobertas

- `/operacoes`
- `/pacientes`
- `/profissionais`
- `/questionarios`
- `/comunicacoes`
- `/automacoes`
- `/ia`
- `/mobile`
- `/gamificacao`

## Comandos

```powershell
cd outputs/octaclin-web
node scripts/smoke-ui-regression.mjs
```

Com npm disponivel:

```powershell
cd outputs/octaclin-web
npm run smoke:ui
```

## Limites conhecidos

- O smoke atual e baseado em HTTP/HTML e nao substitui screenshots pixel-a-pixel.
- A validacao de viewport mobile continua sendo feita por navegador quando necessaria.
- Uma evolucao futura pode adicionar Playwright como dependencia de desenvolvimento para gerar screenshots, medir overflow e arquivar evidencias automaticamente.

## Validacao executada

- `node --check scripts/smoke-ui-regression.mjs`
- `node scripts/smoke-ui-regression.mjs`
- `tsc --noEmit`
- `next build`
- `outputs/verificar-demo-local.ps1`
- `scripts/smoke-e2e-bff.mjs`
