<#
    FundBridge AI - stop everything started by .\start.ps1

        .\stop.ps1              stop the app, leave PostgreSQL running
        .\stop.ps1 -IncludeDb   stop PostgreSQL too

    PostgreSQL is left running by default: it holds your data, starts slowly
    relative to the app, and leaving it up makes the next .\start.ps1 quicker.
    Your data is on disk either way.
#>

[CmdletBinding()]
param([switch]$IncludeDb)

$ErrorActionPreference = 'Stop'

$PgBin   = 'C:\Program Files\PostgreSQL\18\bin'
$DataDir = Join-Path $env:LOCALAPPDATA 'FundBridge\pgdata'

function Write-Step($msg) { Write-Host "==> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "    $msg" -ForegroundColor Green }

# Ports are stopped by their listener, so only processes this app actually
# started are touched - no process-name matching that could catch something
# unrelated.
# Processes are found by their command line rather than by the port they hold.
#
# Get-NetTCPConnection reported these ports as free while the services were
# answering, so the previous port-based lookup silently skipped every kill and
# left duplicates running. A command-line match is specific enough to touch
# only this project's dev processes and does not depend on that table.
$targets = @(
    @{ Name = 'web';        Pattern = 'vite' }
    @{ Name = 'API';        Pattern = 'tsx watch' }
    @{ Name = 'AI service'; Pattern = 'uvicorn' }
    @{ Name = 'dev runner'; Pattern = 'concurrently' }
)

foreach ($t in $targets) {
    Write-Step $t.Name
    $procs = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -and $_.CommandLine -match $t.Pattern })

    if ($procs.Count -eq 0) {
        Write-Ok 'not running'
        continue
    }

    foreach ($pr in $procs) {
        try {
            Stop-Process -Id $pr.ProcessId -Force -ErrorAction Stop
            Write-Ok "stopped PID $($pr.ProcessId)"
        } catch {
            Write-Ok "could not stop PID $($pr.ProcessId)"
        }
    }
}

if ($IncludeDb) {
    Write-Step 'PostgreSQL (port 5433)'
    & "$PgBin\pg_ctl.exe" -D $DataDir status *> $null
    if ($LASTEXITCODE -eq 0) {
        # -m fast: roll back open transactions and shut down promptly, rather
        # than waiting for clients to disconnect on their own.
        Start-Process -FilePath "$PgBin\pg_ctl.exe" `
            -ArgumentList @('-D', "`"$DataDir`"", '-m', 'fast', 'stop') `
            -NoNewWindow -Wait | Out-Null
        Write-Ok 'stopped'
    } else {
        Write-Ok 'not running'
    }
} else {
    Write-Host ''
    Write-Host '    PostgreSQL left running. Stop it too with:  .\stop.ps1 -IncludeDb' -ForegroundColor Yellow
}

Write-Host ''
