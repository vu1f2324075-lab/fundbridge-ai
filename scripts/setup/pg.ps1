<#
    Lifecycle control for the FundBridge development PostgreSQL cluster.

    Invoked by the npm scripts (db:start / db:stop / db:status). It exists as a
    script rather than an inline npm command because npm runs scripts through
    cmd.exe on Windows, where a quoted path containing spaces and forward
    slashes is mis-parsed ("'C:/Program' is not recognized").

    The cluster is NOT registered as a Windows service (that needs admin), so
    it does not survive a reboot. Run `npm run db:start` after restarting.
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('start', 'stop', 'status', 'restart')]
    [string]$Action
)

$ErrorActionPreference = 'Stop'

$PgCtl   = 'C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe'
$DataDir = Join-Path $env:LOCALAPPDATA 'FundBridge\pgdata'
$LogFile = Join-Path $env:LOCALAPPDATA 'FundBridge\postgres.log'

if (-not (Test-Path $PgCtl)) { throw "pg_ctl not found at $PgCtl" }
if (-not (Test-Path (Join-Path $DataDir 'PG_VERSION'))) {
    throw "No cluster at $DataDir. Run: npm run db:setup"
}

# 'start' and 'restart' go through Start-Process so the postgres child does not
# inherit this console's stdout handle. Invoking pg_ctl directly leaves that
# handle open, which makes the caller - npm in particular - appear to hang after
# a perfectly successful start.
switch ($Action) {
    'start' {
        # Detached, then polled. -NoNewWindow -Wait would block on the postgres
        # grandchild sharing this console, which is exactly what made
        # `npm run db:start` appear to hang after a successful start.
        Start-Process -FilePath $PgCtl `
            -ArgumentList @('-D', "`"$DataDir`"", '-l', "`"$LogFile`"", 'start') `
            -WindowStyle Hidden | Out-Null

        $script:ExitCode = 1
        for ($i = 0; $i -lt 60; $i++) {
            Start-Sleep -Seconds 1
            & $PgCtl -D $DataDir status *> $null
            if ($LASTEXITCODE -eq 0) { $script:ExitCode = 0; break }
        }
        if ($script:ExitCode -eq 0) { Write-Output 'PostgreSQL is running.' }
    }
    'restart' {
        $p = Start-Process -FilePath $PgCtl `
            -ArgumentList @('-D', "`"$DataDir`"", '-l', "`"$LogFile`"", '-m', 'fast', '-w', 'restart') `
            -NoNewWindow -Wait -PassThru
        $script:ExitCode = $p.ExitCode
    }
    'stop' {
        $p = Start-Process -FilePath $PgCtl `
            -ArgumentList @('-D', "`"$DataDir`"", '-m', 'fast', 'stop') `
            -NoNewWindow -Wait -PassThru
        $script:ExitCode = $p.ExitCode
    }
    'status' {
        & $PgCtl -D $DataDir status
        $script:ExitCode = $LASTEXITCODE
    }
}

# pg_ctl status exits 3 when the server is simply not running, which is
# information rather than a failure; don't turn it into a non-zero npm exit.
if ($script:ExitCode -ne 0 -and -not ($Action -eq 'status' -and $script:ExitCode -eq 3)) {
    if (Test-Path $LogFile) {
        Write-Output '--- postgres.log (tail) ---'
        Get-Content $LogFile -Tail 20
    }
    exit $script:ExitCode
}
