# syntax=docker/dockerfile:1

# ── Stage 1: build ───────────────────────────────────────────────────────────
FROM node:24-alpine AS builder

# Required for PGlite WASM compilation and native addons (sharp, etc.)
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY . .

# Install all dependencies including devDependencies (needed for codegen + vite build)
RUN npm ci

# Build db package, run GraphQL codegen, build Vite frontend
RUN npm run build -w db && npm run codegen && npm run build -w app

# ── Stage 2: production ───────────────────────────────────────────────────────
FROM node:22-alpine

WORKDIR /app

# Copy the full built monorepo from builder (preserves workspace symlinks + source for strip-types)
COPY --from=builder /app .

# Drop devDependencies — PGlite WASM and all runtime deps are preserved
RUN npm prune --omit=dev

ENV NODE_ENV=production
ENV PORT=3001
# PGlite stores its database files here — mount a volume at /data to persist across restarts
ENV DATABASE_URL=/data/pgdata

RUN mkdir -p /data /avatars

EXPOSE 3001

VOLUME ["/data", "/avatars"]

# Run server directly as TypeScript — no compile step needed
CMD ["node", "--experimental-strip-types", "--preserve-symlinks", "server/src/index.ts"]
