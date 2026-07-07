# syntax=docker/dockerfile:1

# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM node:22-slim AS builder

# Required for PGlite WASM compilation and native addons
RUN apt-get update && apt-get install -y --no-install-recommends \
  python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /apps

# Copy the drizzle-graphql sibling workspace (required by npm workspaces)
COPY drizzle-graphql/ ./drizzle-graphql/

WORKDIR /apps/philotes

# Copy package files for all workspaces first (layer cache optimization)
COPY philotes/package.json philotes/package-lock.json ./
COPY philotes/db/package.json ./db/
COPY philotes/server/package.json ./server/
COPY philotes/app/package.json ./app/

# Install all deps (including devDependencies for build tooling)
RUN npm ci --prefer-offline --no-audit

# Copy remaining source
COPY philotes/ .

# Build: db → codegen → app (server runs via --experimental-strip-types, no compile needed)
RUN npm run build -w db && npm run codegen && npm run build -w app

# ── Stage 2: production ───────────────────────────────────────────────────────
FROM node:22-slim AS production

WORKDIR /apps

# Copy the drizzle-graphql sibling workspace (required at runtime via workspace symlink)
COPY drizzle-graphql/ ./drizzle-graphql/

WORKDIR /apps/philotes

# Copy package files
COPY philotes/package.json philotes/package-lock.json ./
COPY philotes/db/package.json ./db/
COPY philotes/server/package.json ./server/
COPY philotes/app/package.json ./app/

# Install production dependencies only
RUN npm ci --omit=dev --prefer-offline --no-audit

# Copy built artifacts and TypeScript source from builder
COPY --from=builder /apps/philotes/db/dist ./db/dist
COPY --from=builder /apps/philotes/app/dist ./app/dist

# Copy server TypeScript source (runs via --experimental-strip-types)
COPY philotes/server/src ./server/src

# Copy Drizzle migration files (required at startup for db migrations)
COPY philotes/db/drizzle ./db/drizzle

# Copy codegen output (required by server at startup)
COPY --from=builder /apps/philotes/server/__generated__ ./server/__generated__

# Data directory for PGlite (mount a volume at /data to persist across restarts)
RUN mkdir -p /data /avatars

ENV NODE_ENV=production
ENV PORT=3001
# PGlite stores its database files here
ENV DATABASE_URL=/data/pgdata

EXPOSE 3001

VOLUME ["/data", "/avatars"]

# Run server directly as TypeScript — no compile step needed
CMD ["node", "--experimental-strip-types", "--preserve-symlinks", "server/src/index.ts"]
