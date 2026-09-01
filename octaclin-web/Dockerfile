# Instalacao deterministica (PR 49). O hardening de runtime do container
# (non-root, capabilities, digest da imagem base, healthcheck) pertence ao PR 50.
#
# pnpm fixado em versao exata: `corepack enable` sozinho resolveria a versao a
# partir do ambiente, e build sensivel nao deve baixar package manager implicito.
# A versao precisa continuar igual a de package.json e do CI; o gate
# `pnpm test:versao-pnpm` falha se divergirem.
FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.25.0 --activate
# pnpm-workspace.yaml passa a ser copiado: e nele que vivem overrides de
# seguranca, allowBuilds e as demais politicas de supply chain. Sem ele a
# imagem instalaria sob politica diferente da do CI. O lockfile deixa de ser
# opcional (`pnpm-lock.yaml*`) para que a ausencia falhe o build.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.25.0 --activate
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable && corepack prepare pnpm@11.25.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/next.config.mjs ./next.config.mjs
EXPOSE 3000
CMD ["pnpm", "start"]
