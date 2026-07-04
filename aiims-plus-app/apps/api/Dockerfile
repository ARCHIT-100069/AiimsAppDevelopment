# AIIMS+ API — multi-stage, non-root (IDR-0005).
# Build once, promote the same immutable image across environments (IDR-0015).

FROM node:22-alpine AS base
RUN corepack enable pnpm

FROM base AS build
WORKDIR /repo
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY tooling ./tooling
COPY packages ./packages
COPY apps/api ./apps/api
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @aiims/api... build
# Prune to production dependencies for the runtime layer.
RUN pnpm --filter @aiims/api --prod deploy --legacy /out

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
# Non-root user (IDR-0005): the app never needs root.
RUN addgroup -S aiims && adduser -S aiims -G aiims
WORKDIR /app
COPY --from=build --chown=aiims:aiims /out .
USER aiims
EXPOSE 3000
# No secrets baked in — configuration is injected at runtime (SDR-0006).
CMD ["node", "dist/main.js"]
