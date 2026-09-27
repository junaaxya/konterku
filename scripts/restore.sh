#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

if [ $# -lt 1 ]; then
  echo "Usage: $0 <backup-file.sql>"
  echo "Example: $0 backups/konterku_20260916_120000.sql"
  exit 1
fi

BACKUP_FILE="$1"
if [ ! -f "${BACKUP_FILE}" ]; then
  echo "Error: File '${BACKUP_FILE}' not found."
  exit 1
fi

ENV_FILE="${ROOT_DIR}/.env"
if [ ! -f "${ENV_FILE}" ]; then
  ENV_FILE="${ROOT_DIR}/.env.example"
fi

POSTGRES_USER=$(grep -E '^POSTGRES_USER=' "${ENV_FILE}" | cut -d '=' -f2- | tr -d '\r')
POSTGRES_DB=$(grep -E '^POSTGRES_DB=' "${ENV_FILE}" | cut -d '=' -f2- | tr -d '\r')

DB_CONTAINER=$(docker compose ps -q db 2>/dev/null || true)
if [ -z "${DB_CONTAINER}" ]; then
  echo "Error: Database container is not running. Please run 'docker compose up -d' first."
  exit 1
fi

echo "WARNING: Restoring will overwrite all data in database '${POSTGRES_DB}'."
echo "Restoring from: ${BACKUP_FILE}..."

# Drop all existing tables in public schema and restore cleanly
docker compose --env-file "${ENV_FILE}" exec -T db psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
docker compose --env-file "${ENV_FILE}" exec -T db psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" < "${BACKUP_FILE}"

echo "Database restore completed successfully."
