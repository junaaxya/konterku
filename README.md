# KONTERKU

Local-first financial recording app foundation. Phase 1 adds non-UI Account and Ledger commands, ledger-derived balances, and migrations.

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

`db` stays internal to Docker network. `migrate` waits for PostgreSQL health, applies committed migrations, then `app` starts. App always binds `0.0.0.0` and maps `APP_PORT` (default `3000`). Both `app` and `db` use `restart: unless-stopped`.

Stop services:

```bash
docker compose down
```

Restart services:

```bash
docker compose restart
```

`postgres-data` volume preserves PostgreSQL data across restarts and `docker compose down`. Use `docker compose down --volumes` only when deliberately deleting all local database data.

## Windows Local Deployment & LAN Access (Phase 6)

When using a Windows PC as the primary server for KONTERKU:

1. **Install Docker Desktop for Windows**:
   - Enable WSL2 backend.
   - In Docker Desktop Settings > General: check "Start Docker Desktop when you log in".

2. **Find Windows Server LAN IP**:
   - Open Command Prompt or PowerShell on the Windows PC:
     ```powershell
     ipconfig
     ```
   - Look for `IPv4 Address` under your active Wi-Fi or Ethernet adapter (e.g. `192.168.1.50`).

3. **Allow Port 3000 in Windows Defender Firewall**:
   - Run PowerShell as Administrator:
     ```powershell
     New-NetFirewallRule -DisplayName "KONTERKU LAN Access" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
     ```

4. **Access from Other Devices (Smartphones, Tablets, Laptops)**:
   - Connect the client device to the same Wi-Fi / Local Network.
   - Open browser on the device and navigate to:
     ```text
     http://<Windows-PC-IP>:3000
     ```
     Example: `http://192.168.1.50:3000`
   - Health check: `http://192.168.1.50:3000/api/health`

## Database Backup & Restore

Backups are saved to the host `backups/` directory and are excluded from Git.

### Windows (PowerShell)

- **Create Backup**:
  ```powershell
  .\scripts\backup.ps1
  ```
  Produces `backups\konterku_YYYYMMDD_HHMMSS.sql`.

- **Restore Backup**:
  ```powershell
  .\scripts\restore.ps1 backups\konterku_YYYYMMDD_HHMMSS.sql
  ```

### Linux / WSL / macOS (Bash)

- **Create Backup**:
  ```bash
  ./scripts/backup.sh
  ```

- **Restore Backup**:
  ```bash
  ./scripts/restore.sh backups/konterku_YYYYMMDD_HHMMSS.sql
  ```

## Migrations

Apply committed migrations outside Docker:

```bash
pnpm prisma:migrate
```

Create future development migrations with `pnpm exec prisma migrate dev --name <name>`. Do not use `prisma db push` for normal migration workflow.
