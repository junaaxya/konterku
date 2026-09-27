#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
BACKUP_DIR="${ROOT_DIR}/backups"

mkdir -p "${BACKUP_DIR}"

ENV_FILE="${ROOT_DIR}/.env"
if [ ! -f "${ENV_FILE}" ]; then
  ENV_FILE="${ROOT_DIR}/.env.example"
fi

POSTGRES_USER=$(grep -E '^POSTGRES_USER=' "${ENV_FILE}" | cut -d '=' -f2- | tr -d '\r')
POSTGRES_DB=$(grep -E '^POSTGRES_DB=' "${ENV_FILE}" | cut -d '=' -f2- | tr -d '\r')

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/konterku_${TIMESTAMP}.sql"

DB_CONTAINER=$(docker compose ps -q db 2>/dev/null || true)
if [ -z "${DB_CONTAINER}" ]; then
  echo "Error: Database container is not running. Please run 'docker compose up -d' first."
  exit 1
fi

echo "Creating PostgreSQL backup for database '${POSTGRES_DB}'..."
docker compose --env-file "${ENV_FILE}" exec -T db pg_dump -U "${POSTGRES_USER}" "${POSTGRES_DB}" > "${BACKUP_FILE}"

FILE_SIZE=$(wc -c < "${BACKUP_FILE}")
echo "Backup created successfully:"
echo "  File: ${BACKUP_FILE}"
echo "  Size: ${FILE_SIZE} bytes"
