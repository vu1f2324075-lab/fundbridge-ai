<#
    FundBridge AI - start everything.

        .\start.ps1

    Starts, in order:
      1. PostgreSQL dev cluster  (port 5433)
      2. Python AI service       (port 8000)
      3. API + web dev servers   (ports 4000 and 5173)

    WHY THIS SCRIPT EXISTS
    ----------------------
    Two things make the raw commands fail in Windows PowerShell:

      * `npm run ...` is blocked by the execution policy, because npm resolves to
        `npm.ps1`. This script calls `npm.cmd`, which is not a script file and so
        is not blocked. No policy change is needed.

      * `&&` is not a statement separator in Windows PowerShell 5.1, so the
        usual `cd x && y` one-liners are a parse error here.

    Stop everything again with .\stop.ps1
#>

[CmdletBinding()]
param(
    # Skip the AI service. Without it the platform still works: deterministic
    # scoring, readiness and matching all run, and AI features report themselves
    # as unavailable rather than failing.
    [switch]$NoAi
)

$ErrorActionPreference = 'Stop'

$Root    = $PSScriptRoot
$PgBin   = 'C:\Program Files\PostgreSQL\18\bin'
$DataDir = Join-Path $env:LOCALAPPDATA 'FundBridge\pgdata'
$LogDir  = Join-Path $env:LOCALAPPDATA 'FundBridge\logs'

New-Item -ItemType Directory -Force $LogDir | Out-Null

function Write-Step($msg) { Write-Host "==> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "    $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "    $msg" -ForegroundColor Yellow }

function Test-Port([int]$Port) {
    # An actual TCP connect, not Get-NetTCPConnection.
    #
    # That cmdlet proved unreliable on this machine: it reported 4000, 5173 and
    # 8000 as free while all three were demonstrably answering HTTP 200. The
    # consequence was worse than a wrong status line - stop.ps1 used the same
    # check, concluded nothing was running, skipped its kills, and left stale
    # processes serving stale configuration. Connecting is the ground truth.
    # Both loopback families are tried, each with a socket of its own address
    # family. Vite binds to ::1 only on this machine, and a default TcpClient is
    # an IPv4 socket, so a single IPv4 probe reports the web server down while
    # it serves http://localhost:5173 perfectly well.
    $families = @(
        @{ Addr = '127.0.0.1'; Family = [System.Net.Sockets.AddressFamily]::InterNetwork }
        @{ Addr = '::1';       Family = [System.Net.Sockets.AddressFamily]::InterNetworkV6 }
    )
    foreach ($f in $families) {
        $client = New-Object System.Net.Sockets.TcpClient($f.Family)
        try {
            $iar = $client.BeginConnect($f.Addr, $Port, $null, $null)
            if ($iar.AsyncWaitHandle.WaitOne(500)) {
                $client.EndConnect($iar)
                return $true
            }
        } catch {
            # Not listening on this family; try the next.
        } finally {
            $client.Close()
        }
    }
    return $false
}

function Wait-ForUrl([string]$Url, [int]$TimeoutSeconds = 60) {
    for ($i = 0; $i -lt $TimeoutSeconds; $i++) {
        try {
            $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
            if ($r.StatusCode -eq 200) { return $true }
        } catch {
            # Not up yet. Expected while the process is still booting.
        }
        Start-Sleep -Seconds 1
    }
    return $false
}

# ---------------------------------------------------------------------------
# 1. PostgreSQL
# ---------------------------------------------------------------------------

Write-Step 'PostgreSQL (port 5433)'

if (-not (Test-Path (Join-Path $DataDir 'PG_VERSION'))) {
    throw "No database cluster at $DataDir. Create it first with:`n  .\scripts\setup\02-create-dev-cluster.ps1"
}

# `pg_ctl status` exits 3 when the server is simply not running, which is
# information rather than an error - so this must not be treated as a failure.
& "$PgBin\pg_ctl.exe" -D $DataDir status *> $null
if ($LASTEXITCODE -eq 0) {
    Write-Ok 'already running'
} else {
    # Launched detached, then polled until the server answers.
    #
    # Neither -Wait nor -NoNewWindow is used, and that is the whole point:
    # pg_ctl spawns postgres as a long-lived child, and with -NoNewWindow that
    # child shares this console. Start-Process -Wait then waits for the entire
    # process tree, so it blocks until the DATABASE exits - which is to say,
    # forever. Polling the server's own status is the only reliable signal.
    $pgLog = Join-Path $LogDir 'postgres.log'
    Start-Process -FilePath "$PgBin\pg_ctl.exe" `
        -ArgumentList @('-D', "`"$DataDir`"", '-l', "`"$pgLog`"", 'start') `
        -WindowStyle Hidden | Out-Null

    $dbStarted = $false
    for ($i = 0; $i -lt 60; $i++) {
        Start-Sleep -Seconds 1
        & "$PgBin\pg_ctl.exe" -D $DataDir status *> $null
        if ($LASTEXITCODE -eq 0) { $dbStarted = $true; break }
    }

    if (-not $dbStarted) {
        Write-Warn 'PostgreSQL did not report ready. Last lines of the log:'
        if (Test-Path $pgLog) { Get-Content $pgLog -Tail 20 }
        throw 'PostgreSQL failed to start.'
    }
    Write-Ok "started (log: $pgLog)"
}

# ---------------------------------------------------------------------------
# 2. AI service
# ---------------------------------------------------------------------------

if (-not $NoAi) {
    Write-Step 'AI service (port 8000)'

    $venvPython = Join-Path $Root 'ai-service\.venv\Scripts\python.exe'

    if (-not (Test-Path $venvPython)) {
        Write-Warn 'No virtual environment at ai-service\.venv - skipping.'
        Write-Warn 'Create it with:  cd ai-service ; python -m venv .venv ; .venv\Scripts\python -m pip install -r requirements-dev.txt'
    } elseif (Test-Port 8000) {
        Write-Ok 'already running'
    } else {
        $aiLog = Join-Path $LogDir 'ai-service.log'
        Start-Process -FilePath $venvPython `
            -ArgumentList @('-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000') `
            -WorkingDirectory (Join-Path $Root 'ai-service') `
            -WindowStyle Hidden `
            -RedirectStandardOutput $aiLog `
            -RedirectStandardError (Join-Path $LogDir 'ai-service.err.log') | Out-Null

        if (Wait-ForUrl 'http://127.0.0.1:8000/health' 90) {
            Write-Ok "started (log: $aiLog)"
        } else {
            Write-Warn 'did not respond in time. Last lines of the log:'
            if (Test-Path $aiLog) { Get-Content $aiLog -Tail 15 }
            Write-Warn 'Continuing without it - AI features will report as unavailable.'
        }
    }
} else {
    Write-Step 'AI service - skipped (-NoAi)'
}

# ---------------------------------------------------------------------------
# 3. API + web
# ---------------------------------------------------------------------------

Write-Step 'API (port 4000) and web (port 5173)'

if ((Test-Port 4000) -and (Test-Port 5173)) {
    Write-Ok 'already running'
} else {
    # Any half-up pair is stopped first, so `npm run dev` does not fail on a
    # port already in use.
    foreach ($port in 4000, 5173) {
        $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
        foreach ($c in $conns) {
            Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue
            Write-Warn "stopped a stale listener on port $port"
        }
    }

    $devLog = Join-Path $LogDir 'dev.log'

    # npm.cmd, not npm: the .ps1 wrapper is blocked by the execution policy.
    Start-Process -FilePath 'npm.cmd' `
        -ArgumentList @('run', 'dev') `
        -WorkingDirectory $Root `
        -WindowStyle Hidden `
        -RedirectStandardOutput $devLog `
        -RedirectStandardError (Join-Path $LogDir 'dev.err.log') | Out-Null

    $apiUp = Wait-ForUrl 'http://localhost:4000/api/health' 90
    $webUp = Wait-ForUrl 'http://localhost:5173/' 30

    if ($apiUp -and $webUp) {
        Write-Ok "started (log: $devLog)"
    } else {
        Write-Warn "API up: $apiUp, web up: $webUp. Last lines of the log:"
        if (Test-Path $devLog) { Get-Content $devLog -Tail 25 }
    }
}

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

Write-Host ''
Write-Host 'FundBridge AI' -ForegroundColor White
Write-Host ''

& "$PgBin\pg_ctl.exe" -D $DataDir status *> $null
$dbUp = ($LASTEXITCODE -eq 0)

$rows = @(
    @{ Name = 'PostgreSQL'; Port = 5433; Up = $dbUp }
    @{ Name = 'AI service'; Port = 8000; Up = (Test-Port 8000) }
    @{ Name = 'API';        Port = 4000; Up = (Test-Port 4000) }
    @{ Name = 'Web';        Port = 5173; Up = (Test-Port 5173) }
)

foreach ($r in $rows) {
    $label = $r.Name.PadRight(12)
    if ($r.Up) {
        Write-Host "  $label :$($r.Port)  " -NoNewline
        Write-Host 'running' -ForegroundColor Green
    } else {
        Write-Host "  $label :$($r.Port)  " -NoNewline
        Write-Host 'not running' -ForegroundColor Red
    }
}

Write-Host ''
if ((Test-Port 5173) -and (Test-Port 4000)) {
    Write-Host '  Open  http://localhost:5173/login' -ForegroundColor White
    Write-Host '  Demo password for all accounts:  fundbridge-demo-2026'
    Write-Host ''
    Write-Host '    owner@buildtech.local       business owner'
    Write-Host '    team@alphaventures.local    investor'
    Write-Host '    admin@fundbridge.local      administrator'
}

if (-not (Test-Port 8000)) {
    Write-Host ''
    Write-Warn 'The AI service is not running. Scoring, readiness and matching still work;'
    Write-Warn 'proposal processing and grounded answers do not, and report themselves as unavailable.'
}

Write-Host ''
Write-Host "  Logs:  $LogDir"
Write-Host '  Stop:  .\stop.ps1'
Write-Host ''
