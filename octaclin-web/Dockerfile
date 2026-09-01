# PR 50 — Containers e runtime.
#
# Base fixada por digest imutavel (indice OCI multi-arch linux/amd64+arm64),
# resolvido em 2026-09-01 no Docker Hub oficial (library/node:22-alpine). A tag
# humana permanece para legibilidade; o digest e a ancora real. Atualizacao do
# digest segue o processo em docs/governance/RELATORIO_SEGURANCA_PR50_2026-09-01.md.
#
# `output: standalone` avaliado e nao adotado neste PR: a config atual usa
# outputFileTracingRoot e o middleware/BFF; migrar exigiria redesenho amplo
# (fora do escopo, PR 50 nao forca standalone). A minimizacao aqui remove o
# gerenciador de pacotes do runtime, mantendo o comportamento do Next atual.
FROM node:22-alpine@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32 AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.25.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:22-alpine@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32 AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.25.0 --activate
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# Dependencias de producao resolvidas no modo congelado. O runtime so recebe
# artefatos: sem corepack, sem pnpm, sem instalacao no estagio final.
FROM node:22-alpine@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32 AS deps-prod
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.25.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile

FROM node:22-alpine@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32 AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --chown=node:node package.json ./
COPY --chown=node:node --from=deps-prod /app/node_modules ./node_modules
COPY --chown=node:node --from=build /app/.next ./.next
COPY --chown=node:node --from=build /app/public ./public
COPY --chown=node:node --from=build /app/next.config.mjs ./next.config.mjs
EXPOSE 3000
USER node
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD ["node", "-e", "const porta=process.env.PORT||'3000';fetch('http://127.0.0.1:'+porta+'/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]
CMD ["node", "node_modules/next/dist/bin/next", "start"]
