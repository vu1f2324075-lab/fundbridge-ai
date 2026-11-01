<#
    FundBridge AI - create a self-contained local PostgreSQL cluster for development.

    WHY THIS EXISTS
    ---------------
    The machine already runs PostgreSQL 18 as a Windows service on port 5432,
    but its superuser password is known only to the developer, and editing
    pg_hba.conf or restarting that service needs administrator rights.

    Rather than weakening the authentication of the existing instance, this
    script uses its *binaries* to initialise a separate cluster that the current
    user owns outright:

      - data directory   : %LOCALAPPDATA%\FundBridge\pgdata
      - port             : 5433  (the existing instance keeps 5432)
      - cluster owner    : fb_admin    (superuser of THIS cluster only)
      - application role : fundbridge  (NOSUPERUSER NOCREATEDB NOCREATEROLE)

    No administrator rights are required and the existing instance is never
    touched. Passwords are generated here and written only to backend/.env.

    To use the pre-existing service instead, run 01-create-database.sql against
    it and point DATABASE_URL at port 5432.

    USAGE
    -----
      powershell -ExecutionPolicy Bypass -File scripts/setup/02-create-dev-cluster.ps1
      powershell -ExecutionPolicy Bypass -File scripts/setup/02-create-dev-cluster.ps1 -Recreate
#>

[CmdletBinding()]
param(
    # Destroys and rebuilds the cluster. All development data is lost.
    [switch]$Recreate,
    [int]$Port = 5433
)

$ErrorActionPreference = 'Stop'

$PgBin    = 'C:\Program Files\PostgreSQL\18\bin'
$Root     = Join-Path $env:LOCALAPPDATA 'FundBridge'
$DataDir  = Join-Path $Root 'pgdata'
$LogFile  = Join-Path $Root 'postgres.log'
$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$EnvFile  = Join-Path $RepoRoot 'backend\.env'

function Write-Step($msg) { Write-Output "==> $msg" }

# Writes UTF-8 without a BOM. Set-Content in PowerShell 5.1 would prepend one,
# which corrupts both a password file and a .env parsed by dotenv.
function Write-TextNoBom([string]$Path, [string]$Content) {
    [System.IO.File]::WriteAllText($Path, $Content, (New-Object System.Text.UTF8Encoding($false)))
}

function New-Secret([int]$Bytes = 24) {
    $buf = New-Object byte[] $Bytes
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $rng.GetBytes($buf)
    # Hex keeps it safe to embed in a URL without percent-encoding.
    return (($buf | ForEach-Object { $_.ToString('x2') }) -join '')
}

foreach ($exe in 'initdb.exe', 'pg_ctl.exe', 'psql.exe') {
    if (-not (Test-Path (Join-Path $PgBin $exe))) {
        throw "$exe not found in $PgBin. Is PostgreSQL 18 installed?"
    }
}

New-Item -ItemType Directory -Force $Root | Out-Null

if ($Recreate -and (Test-Path $DataDir)) {
    Write-Step 'Stopping and removing the existing dev cluster'
    try { & "$PgBin\pg_ctl.exe" -D $DataDir -m immediate stop } catch {}
    Start-Sleep -Seconds 2
    Remove-Item -Recurse -Force $DataDir
}

$alreadyInitialised = Test-Path (Join-Path $DataDir 'PG_VERSION')
$script:AdminPassword = $null

if ($alreadyInitialised) {
    Write-Step "Cluster already initialised at $DataDir (use -Recreate to rebuild)"
    if (-not (Test-Path $EnvFile)) {
        throw "Cluster exists but $EnvFile does not. Re-run with -Recreate to regenerate credentials."
    }
} else {
    $adminPassword = New-Secret
    $pwFile = Join-Path $env:TEMP ("fb-initdb-" + [guid]::NewGuid().ToString('N') + ".txt")
    Write-TextNoBom $pwFile $adminPassword

    try {
        Write-Step "Initialising cluster at $DataDir"
        & "$PgBin\initdb.exe" --pgdata=$DataDir --username=fb_admin --pwfile=$pwFile --auth-host=scram-sha-256 --auth-local=scram-sha-256 --encoding=UTF8 --locale=C | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "initdb failed with exit code $LASTEXITCODE" }
    } finally {
        # The plaintext password must not outlive initdb.
        Remove-Item -Force $pwFile -ErrorAction SilentlyContinue
    }

    Write-Step "Configuring port $Port and binding to localhost only"
    $conf = Join-Path $DataDir 'postgresql.conf'
    $extra = @"

# --- FundBridge AI development cluster -------------------------------------
# Separate from the machine's service instance on 5432.
port = $Port
# Never exposed off this machine.
listen_addresses = 'localhost'
# Development aid for the matching-engine work: surface slow statements.
log_min_duration_statement = 500
"@
    Add-Content -Path $conf -Encoding ascii -Value $extra

    $script:AdminPassword = $adminPassword
}

Write-Step 'Starting the cluster'
& "$PgBin\pg_ctl.exe" -D $DataDir -l $LogFile -w start
if ($LASTEXITCODE -ne 0) {
    Write-Output "--- postgres.log (tail) ---"
    if (Test-Path $LogFile) { Get-Content $LogFile -Tail 25 }
    throw "pg_ctl start failed with exit code $LASTEXITCODE"
}

if (-not $alreadyInitialised) {
    $appPassword = New-Secret
    $env:PGPASSWORD = $script:AdminPassword

    Write-Step 'Creating the least-privilege application role and databases'
    # ON_ERROR_STOP=1 so a failed statement aborts rather than leaving a
    # half-built database that fails confusingly later during migration.
    $sql = @"
CREATE ROLE fundbridge WITH LOGIN PASSWORD '$appPassword' NOSUPERUSER NOCREATEDB NOCREATEROLE;
CREATE DATABASE fundbridge WITH OWNER fundbridge ENCODING 'UTF8';
CREATE DATABASE fundbridge_shadow WITH OWNER fundbridge ENCODING 'UTF8';
"@
    $sql | & "$PgBin\psql.exe" -v ON_ERROR_STOP=1 -h localhost -p $Port -U fb_admin -d postgres -f - | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "role/database creation failed with exit code $LASTEXITCODE" }

    # PostgreSQL grants CREATE on the public schema broadly by default; revoke
    # that and grant it back to the application role only.
    foreach ($db in 'fundbridge', 'fundbridge_shadow') {
        $harden = "REVOKE ALL ON SCHEMA public FROM PUBLIC; GRANT ALL ON SCHEMA public TO fundbridge;"
        $harden | & "$PgBin\psql.exe" -v ON_ERROR_STOP=1 -h localhost -p $Port -U fb_admin -d $db -f - | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "hardening $db failed with exit code $LASTEXITCODE" }
    }

    $env:PGPASSWORD = ''

    Write-Step 'Writing credentials to backend\.env'
    $jwtSecret = New-Secret 48
    $dbUrl     = "postgresql://fundbridge:$appPassword@localhost:$Port/fundbridge?schema=public"
    $shadowUrl = "postgresql://fundbridge:$appPassword@localhost:$Port/fundbridge_shadow?schema=public"

    $envContent = @"
# Generated by scripts/setup/02-create-dev-cluster.ps1
# Local development only. Never commit this file - it is in .gitignore.
#
# This points at the FundBridge development cluster on port $Port, NOT the
# machine's PostgreSQL service on 5432. See the script header for why.

DATABASE_URL="$dbUrl"
SHADOW_DATABASE_URL="$shadowUrl"

NODE_ENV=development
PORT=4000
LOG_LEVEL=debug

JWT_SECRET=$jwtSecret
JWT_EXPIRES_IN=7d

CORS_ORIGIN=http://localhost:5173
TRUST_PROXY=false

STORAGE_DRIVER=local
STORAGE_LOCAL_DIR=./storage/proposals
MAX_UPLOAD_BYTES=10485760

# Blank until the Python AI service is running. The backend degrades
# gracefully: deterministic scoring works, AI features report unavailable.
AI_SERVICE_URL=
AI_SERVICE_TIMEOUT_MS=60000
AI_SERVICE_TOKEN=

VITE_API_BASE_URL=http://localhost:4000/api
"@
    Write-TextNoBom $EnvFile $envContent
}

Write-Step 'Verifying the application role can connect'
$appUrlLine = Get-Content $EnvFile | Where-Object { $_ -like 'DATABASE_URL=*' }
if (-not $appUrlLine) { throw "DATABASE_URL missing from $EnvFile" }
$appPw = [regex]::Match($appUrlLine, 'fundbridge:([^@]+)@').Groups[1].Value
$env:PGPASSWORD = $appPw
$check = & "$PgBin\psql.exe" -h localhost -p $Port -U fundbridge -d fundbridge -t -A -c "SELECT current_user || ' @ ' || current_database();"
$env:PGPASSWORD = ''
if ($LASTEXITCODE -ne 0) { throw 'application role could not connect' }

Write-Output ''
Write-Output "Connected as: $check"
Write-Output ''
Write-Output 'Cluster ready.'
Write-Output "  data : $DataDir"
Write-Output "  log  : $LogFile"
Write-Output "  port : $Port"
Write-Output ''
Write-Output 'Credentials were written to backend\.env and are not printed here.'
Write-Output 'Start / stop with:  npm run db:start  |  npm run db:stop'
