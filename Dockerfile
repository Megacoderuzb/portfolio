# syntax=docker/dockerfile:1
# Starting point. Phase 09 must build and verify it (adjust for the installed Next/Prisma versions).
# Requires next.config: output: "standalone".

FROM node:22-alpine AS base
RUN apk add --no-cache openssl libc6-compat tzdata
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile

FROM deps AS build
# The public origin is baked into the prerendered <head> (canonical, hreflang, og:image), so the build needs it.
# docker compose passes it from .env; a bare "docker build" must use --build-arg APP_URL=https://your-domain
ARG APP_URL
RUN test -n "$APP_URL" || (echo "ERROR: build arg APP_URL is required (e.g. https://abduvaxobov.uz)" >&2; exit 1)
ENV APP_URL=$APP_URL
# Optional: the public API on its own host (https://api.example.com). Baked into the browser bundle and the CSP.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
COPY . .
RUN pnpm prisma generate && pnpm build

# ---- web app (Next.js standalone)
FROM base AS app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]

# ---- worker (BullMQ + Telegram bot) and one-off tasks (migrate, seed)
FROM deps AS worker
COPY . .
RUN pnpm prisma generate
ENV NODE_ENV=production
CMD ["pnpm", "worker"]
