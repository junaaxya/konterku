FROM node:24.13.0-alpine AS base

WORKDIR /app
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

FROM base AS dependencies

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM dependencies AS builder

COPY . ./
ENV DATABASE_URL="postgresql://postgres:postgres@localhost:5432/postgres?schema=public"
RUN pnpm build

FROM dependencies AS migrator

COPY prisma ./prisma
COPY prisma.config.ts ./

CMD ["pnpm", "prisma:migrate"]

FROM node:24.13.0-alpine AS runner

WORKDIR /app
ENV NODE_ENV="production"
ENV HOSTNAME="0.0.0.0"
ENV PORT="3000"

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
