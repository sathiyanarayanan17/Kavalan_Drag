# ---- KAVALAN Next.js app (multi-stage) ----
# Node 22 gives the built-in node:sqlite and prebuilt better-sqlite3 support.
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=4000

# Standalone output + static assets + native better-sqlite3 module.
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3

# Writable data dir for the SQLite database.
RUN mkdir -p /app/data
VOLUME /app/data

EXPOSE 4000
CMD ["node", "server.js"]
