# Build from the monorepo root: docker build -f apps/web/Dockerfile .
FROM node:22-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm@11.15.1
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web/package.json ./apps/web/package.json
RUN pnpm install --frozen-lockfile --network-concurrency=4
COPY apps/web ./apps/web
COPY mshwar-brand-foundation ./mshwar-brand-foundation
RUN pnpm --filter web build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
COPY --from=builder --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=builder --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=node:node /app/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
