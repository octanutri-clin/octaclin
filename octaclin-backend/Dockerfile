# PR 50 — Containers e runtime.
#
# Base fixada por digest imutavel (indice OCI multi-arch linux/amd64+arm64),
# resolvido em 2026-09-01 no Docker Hub oficial (library/node:22-alpine). A tag
# humana permanece para legibilidade; o digest e a ancora real. Atualizacao do
# digest segue o processo em docs/governance/RELATORIO_SEGURANCA_PR50_2026-09-01.md
# (Dependabot/humano -> scan -> build -> harness -> SBOM -> review -> merge).
#
# pnpm fixado em versao exata: `corepack enable` sozinho resolveria a versao a
# partir do ambiente, e build sensivel nao deve baixar package manager implicito.
# A versao precisa continuar igual a de package.json e do CI; o gate
# `pnpm test:versao-pnpm` falha se divergirem.
FROM node:26-alpine@sha256:2d984a15c9b54fd0aeb608b8e0d0d83529eb34d2966db27a1fb4f1edc3d298a3 AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.25.0 --activate
# Sem glob: o lockfile e obrigatorio. `pnpm-lock.yaml*` deixava o build seguir
# sem lockfile quando o arquivo faltava. pnpm-workspace.yaml carrega overrides de
# seguranca, allowBuilds e demais politicas de supply chain do PR 49.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:26-alpine@sha256:2d984a15c9b54fd0aeb608b8e0d0d83529eb34d2966db27a1fb4f1edc3d298a3 AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.25.0 --activate
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# Dependencias de producao resolvidas aqui, ainda no modo congelado. O estagio
# final so recebe artefatos: sem corepack, sem pnpm, sem instalacao no runtime.
FROM node:26-alpine@sha256:2d984a15c9b54fd0aeb608b8e0d0d83529eb34d2966db27a1fb4f1edc3d298a3 AS deps-prod
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.25.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile

FROM node:26-alpine@sha256:2d984a15c9b54fd0aeb608b8e0d0d83529eb34d2966db27a1fb4f1edc3d298a3 AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --chown=node:node package.json ./
COPY --chown=node:node --from=deps-prod /app/node_modules ./node_modules
COPY --chown=node:node --from=build /app/dist ./dist
EXPOSE 3000
USER node
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD ["node", "-e", "const porta=process.env.PORT||process.env.PORTA_HTTP||'3000';fetch('http://127.0.0.1:'+porta+'/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]
CMD ["node", "dist/main.js"]
