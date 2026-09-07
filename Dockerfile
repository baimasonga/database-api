# ---------------------------------------------------------------------------
# AVDP Integrated Data & Analytics Platform
# Multi-stage build producing a standalone Next.js server.
# ---------------------------------------------------------------------------
FROM node:22-slim AS deps
WORKDIR /app
# openssl is required by Prisma's query engine.
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# The build generates the Prisma client explicitly, so it does not depend on
# install-script behaviour. A placeholder URL satisfies the schema loader;
# the real one is supplied at runtime.
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
RUN npm run build

FROM node:22-slim AS runner
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# Uploaded source files are the evidence behind every published figure and
# MUST be mounted on a persistent volume — see docs/data-platform/deployment.md.
ENV UPLOAD_STORAGE_DIR=/data/uploads

RUN groupadd --system --gid 1001 avdp \
    && useradd --system --uid 1001 --gid avdp avdp

COPY --from=builder --chown=avdp:avdp /app/.next/standalone ./
COPY --from=builder --chown=avdp:avdp /app/.next/static ./.next/static
# Migrations and the schema ship with the image so `migrate deploy` can run
# from the same artefact that serves traffic.
COPY --from=builder --chown=avdp:avdp /app/prisma ./prisma
COPY --from=builder --chown=avdp:avdp /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder --chown=avdp:avdp /app/node_modules/.bin/prisma ./node_modules/.bin/prisma

RUN mkdir -p /data/uploads && chown -R avdp:avdp /data
VOLUME ["/data/uploads"]

USER avdp
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
