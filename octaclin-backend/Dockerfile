# Instalacao deterministica (PR 49). O hardening amplo de runtime
# (capabilities, digest da imagem base e filesystem read-only) pertence ao PR 50.
#
# pnpm fixado em versao exata: `corepack enable` sozinho resolveria a versao a
# partir do ambiente, e build sensivel nao deve baixar package manager implicito.
# A versao precisa continuar igual a de package.json e do CI; o gate
# `pnpm test:versao-pnpm` falha se divergirem.
FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.25.0 --activate
# Sem glob: o lockfile e obrigatorio. `pnpm-lock.yaml*` deixava o build seguir
# sem lockfile quando o arquivo faltava.
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
COPY --chown=node:node --from=build /app/dist ./dist
EXPOSE 3000
USER node
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD ["node", "-e", "const porta=process.env.PORT||process.env.PORTA_HTTP||'3000';fetch('http://127.0.0.1:'+porta+'/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]
CMD ["node", "dist/main.js"]
