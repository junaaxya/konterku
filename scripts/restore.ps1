# Windows PowerShell Restore Script for KONTERKU
# Usage: .\scripts\restore.ps1 backups\konterku_20260916_120000.sql

param (
    [Parameter(Mandatory=$true, Position=0)]
    [string]$BackupFile
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir

if (-not (Test-Path $BackupFile)) {
    Write-Error "Backup file '$BackupFile' does not exist."
}

$EnvFile = Join-Path $RootDir ".env"
if (-not (Test-Path $EnvFile)) {
    $EnvFile = Join-Path $RootDir ".env.example"
}

$PostgresUser = "konterku"
$PostgresDb = "konterku"

Get-Content $EnvFile | ForEach-Object {
    if ($_ -match "^POSTGRES_USER=(.*)$") {
        $PostgresUser = $matches[1].Trim()
    }
    if ($_ -match "^POSTGRES_DB=(.*)$") {
        $PostgresDb = $matches[1].Trim()
    }
}

Write-Host "WARNING: Restoring will overwrite existing data in database '$PostgresDb'."
Write-Host "Restoring from: $BackupFile..."

# Reset public schema cleanly
docker compose --env-file $EnvFile exec -T db psql -U $PostgresUser -d $PostgresDb -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# Pipe SQL dump into psql
Get-Content $BackupFile | docker compose --env-file $EnvFile exec -T db psql -U $PostgresUser -d $PostgresDb

Write-Host "Database restore completed successfully."
