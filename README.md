# KONTERKU

Local-first financial recording app foundation. Phase 0 contains runtime, database, tests, and deployment only.

## Development

1. Copy `.env.example` to `.env` and replace password placeholder in `POSTGRES_PASSWORD` and `DATABASE_URL` with same value.
2. Provide PostgreSQL at `DATABASE_URL`. For Docker Compose, keep hostname `db`.
3. Install and generate client:

   ```bash
   pnpm install --frozen-lockfile
   pnpm prisma:generate
   ```

4. Start development server:

   ```bash
   pnpm dev
   ```

## Docker Compose

1. Copy `.env.example` to `.env` and set a long local `POSTGRES_PASSWORD`.
2. Build and start services:

   ```bash
   docker compose up --build -d
   ```

`db` stays internal to Docker network. `migrate` waits for PostgreSQL health, applies committed migrations, then `app` starts. App always binds `0.0.0.0` and maps `APP_PORT` (default `3000`). Open `http://<server-lan-ip>:<APP_PORT>/api/health` from another device on same LAN.

Stop services:

```bash
docker compose down
```

Restart services:

```bash
docker compose restart
```

`postgres-data` volume preserves PostgreSQL data across restarts and `docker compose down`. Use `docker compose down --volumes` only when deliberately deleting all local database data.

## Migrations

Apply committed migrations outside Docker:

```bash
pnpm prisma:migrate
```

Create future development migrations with `pnpm exec prisma migrate dev --name <name>`. Do not use `prisma db push` for normal migration workflow.
