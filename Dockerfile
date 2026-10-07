# syntax=docker/dockerfile:1

# ── Stage 1: build ───────────────────────────────────────────────────────────
FROM node:26-alpine AS builder

# Required for native addons (sharp, etc.)
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY . .

# Install all dependencies including devDependencies (needed for codegen + vite build)
RUN npm ci

# Codegen imports the db package, which refuses to load without DATABASE_URL.
# postgres-js doesn't connect until a query runs, so a placeholder is enough.
ENV DATABASE_URL=postgres://build:build@127.0.0.1:5432/build
RUN npm run codegen && npm run build -w app

# ── Stage 2: production ───────────────────────────────────────────────────────
FROM node:26-alpine

WORKDIR /app

# Copy the full built monorepo from builder (preserves workspace symlinks + source for strip-types)
COPY --from=builder /app .

# Drop devDependencies
RUN npm prune --omit=dev

ENV NODE_ENV=production
ENV PORT=3001
# The builder's placeholder must not reach a running container: preflight asks for a real one.
ENV DATABASE_URL=

RUN mkdir -p /avatars

EXPOSE 3001

VOLUME ["/avatars"]

# Run server directly as TypeScript — no compile step needed
CMD ["node", "server/src/index.ts"]
