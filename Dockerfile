# syntax=docker/dockerfile:1

FROM node:26-slim AS builder
WORKDIR /app
COPY . .
RUN npm ci
# Codegen imports the db package, which refuses to load without DATABASE_URL.
# postgres-js doesn't connect until a query runs, so a placeholder is enough.
ENV DATABASE_URL=postgres://build:build@127.0.0.1:5432/build
RUN npm run codegen && npm run build:app

# Optional: docker build --target test
FROM builder AS test
CMD ["npm", "test"]

FROM node:26-slim AS runtime
WORKDIR /app
COPY package.json package-lock.json ./
COPY db/package.json db/
COPY server/package.json server/
COPY app/package.json app/
RUN npm ci --omit=dev --include-workspace-root --workspace @cubicecho/philotes-db --workspace @cubicecho/philotes-server \
 && npm cache clean --force

# The server isn't compiled. Its sources are the build output.
COPY db/src db/src
COPY db/drizzle db/drizzle
COPY server/src server/src
COPY --from=builder /app/app/dist app/dist

# Uploaded avatars. Created here and owned by node, so a fresh volume inherits that owner.
RUN mkdir -p /data/avatars && chown -R node:node /data
VOLUME ["/data"]

ENV NODE_ENV=production
ENV PORT=3000
ENV AVATAR_DIR=/data/avatars
EXPOSE 3000
USER node

HEALTHCHECK --interval=30s --timeout=3s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# No --preserve-symlinks: it would resolve the db workspace to its path inside
# node_modules, and Node refuses to strip types from anything under there.
# Exec form, so node is PID 1 and gets SIGTERM itself.
CMD ["node", "server/src/index.ts"]
