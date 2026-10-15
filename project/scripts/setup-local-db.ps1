$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$triageRoot = Join-Path $projectRoot 'traige relay'
$databaseName = if ($env:DB_NAME) { $env:DB_NAME } else { 'triage_relay' }
$databaseUser = if ($env:DB_USER) { $env:DB_USER } else { 'postgres' }
$databasePassword = if ($env:DB_PASSWORD) { $env:DB_PASSWORD } else { 'postgres' }
$databaseHost = if ($env:DB_HOST) { $env:DB_HOST } else { 'localhost' }
$databasePort = if ($env:DB_PORT) { $env:DB_PORT } else { '5432' }
$psqlPath = 'C:\Program Files\PostgreSQL\16\bin\psql.exe'

if (-not (Test-Path -LiteralPath $psqlPath)) {
  throw 'PostgreSQL 16 was not found. Install PostgreSQL 16 and the PostGIS extension first.'
}

$env:PGPASSWORD = $databasePassword
$databaseExists = & $psqlPath -h $databaseHost -p $databasePort -U $databaseUser -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$databaseName'"

if ($databaseExists.Trim() -ne '1') {
  & $psqlPath -h $databaseHost -p $databasePort -U $databaseUser -d postgres -c "CREATE DATABASE $databaseName"
}

$isInitialized = & $psqlPath -h $databaseHost -p $databasePort -U $databaseUser -d $databaseName -tAc "SELECT to_regclass('public.hospitals') IS NOT NULL"

if ($isInitialized.Trim() -ne 't') {
  & $psqlPath -h $databaseHost -p $databasePort -U $databaseUser -d $databaseName -f (Join-Path $triageRoot 'dataset\schema.sql')
  & $psqlPath -h $databaseHost -p $databasePort -U $databaseUser -d $databaseName -f (Join-Path $triageRoot 'dataset\seed_data.sql')
}

Write-Output "Local database '$databaseName' is ready."
