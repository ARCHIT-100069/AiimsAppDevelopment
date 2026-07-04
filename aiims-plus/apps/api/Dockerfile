# syntax=docker/dockerfile:1
FROM node:22-slim AS build
WORKDIR /app
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile && pnpm build
FROM node:22-slim AS run
WORKDIR /app
ENV NODE_ENV=production
RUN useradd -r -u 10001 appuser
COPY --from=build /app /app
USER appuser
EXPOSE 3000
CMD ["node", "apps/api/dist/main.js"]
