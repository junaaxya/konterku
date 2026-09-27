# Windows PowerShell Backup Script for KONTERKU
# Usage: .\scripts\backup.ps1

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir
$BackupDir = Join-Path $RootDir "backups"

if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir | Out-Null
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

$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$BackupFile = Join-Path $BackupDir "konterku_$Timestamp.sql"

Write-Host "Creating backup for database '$PostgresDb' on Windows host..."

docker compose --env-file $EnvFile exec -T db pg_dump -U $PostgresUser $PostgresDb | Out-File -FilePath $BackupFile -Encoding utf8

if (Test-Path $BackupFile) {
    $FileSize = (Get-Item $BackupFile).Length
    Write-Host "Backup created successfully:"
    Write-Host "  File: $BackupFile"
    Write-Host "  Size: $FileSize bytes"
} else {
    Write-Error "Backup creation failed: output file not found."
}
