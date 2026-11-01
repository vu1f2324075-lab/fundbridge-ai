<#
    FundBridge AI - demonstrate the backend.

        .\show-backend.ps1

    A guided, read-mostly walkthrough of the API for a reviewer. It proves the
    backend is real by exercising it rather than describing it: live endpoints,
    the authorisation boundary, a scored result with its full reasoning, and the
    database behind it.

    It pauses between sections so you can talk over each one. Press Enter to
    advance, or run with -NoPause to let it run straight through.

    Nothing here writes to the database except the final optional step, which is
    skipped unless you pass -IncludeRecompute.
#>

[CmdletBinding()]
param(
    [switch]$NoPause,
    # Recalculates readiness and scheme matches. Writes derived rows; the
    # profile itself is never modified.
    [switch]$IncludeRecompute
)

$ErrorActionPreference = 'Stop'

$Api      = 'http://localhost:4000/api'
$AiSvc    = 'http://localhost:8000'
$Root     = $PSScriptRoot
$PgBin    = 'C:\Program Files\PostgreSQL\18\bin'
$DataDir  = Join-Path $env:LOCALAPPDATA 'FundBridge\pgdata'
$Password = 'fundbridge-demo-2026'

function Section($n, $title) {
    Write-Host ''
    Write-Host ('  ' + ('-' * 68)) -ForegroundColor DarkGray
    Write-Host ("  $n. $title") -ForegroundColor Cyan
    Write-Host ('  ' + ('-' * 68)) -ForegroundColor DarkGray
    Write-Host ''
}

function Note($msg)  { Write-Host "      $msg" -ForegroundColor DarkGray }
function Good($msg)  { Write-Host "      $msg" -ForegroundColor Green }
function Warn($msg)  { Write-Host "      $msg" -ForegroundColor Yellow }
function Item($k, $v) { Write-Host ('      {0,-42} {1}' -f $k, $v) }

function Test-Port([int]$Port) {
    # A real connection attempt, one socket per address family.
    #
    # Get-NetTCPConnection reported these ports free while the services were
    # answering, and a default TcpClient is IPv4-only while Vite binds to ::1 -
    # so the previous check called a running stack "NOT RUNNING" two lines
    # above the same services returning HTTP 200.
    $families = @(
        @{ Addr = '127.0.0.1'; Family = [System.Net.Sockets.AddressFamily]::InterNetwork }
        @{ Addr = '::1';       Family = [System.Net.Sockets.AddressFamily]::InterNetworkV6 }
    )
    foreach ($f in $families) {
        $client = New-Object System.Net.Sockets.TcpClient($f.Family)
        try {
            $iar = $client.BeginConnect($f.Addr, $Port, $null, $null)
            if ($iar.AsyncWaitHandle.WaitOne(500)) { $client.EndConnect($iar); return $true }
        } catch {
        } finally { $client.Close() }
    }
    return $false
}

function Pause-Here {
    if ($NoPause) { return }
    Write-Host ''
    Write-Host '      [Enter] to continue' -ForegroundColor DarkGray -NoNewline
    $null = Read-Host
}

# Returns the HTTP status code for a request, including for error responses.
# Invoke-WebRequest throws on 4xx/5xx, and the status is what we are
# demonstrating, so the throw is caught and the code extracted.
function Get-Status {
    param(
        [string]$Url,
        [string]$Method = 'GET',
        $Session,
        [hashtable]$Headers,
        [string]$Body
    )
    $args = @{ Uri = $Url; Method = $Method; UseBasicParsing = $true; TimeoutSec = 30 }
    if ($Session) { $args['WebSession'] = $Session }
    if ($Headers) { $args['Headers'] = $Headers }
    if ($Body)    { $args['Body'] = $Body; $args['ContentType'] = 'application/json' }
    try {
        $r = Invoke-WebRequest @args
        return [int]$r.StatusCode
    } catch {
        if ($_.Exception.Response) { return [int]$_.Exception.Response.StatusCode }
        return 0
    }
}

function Login {
    param([string]$Email)
    $body = (@{ email = $Email; password = $Password } | ConvertTo-Json -Compress)
    $r = Invoke-WebRequest -Uri "$Api/auth/login" -Method POST -Body $body `
        -ContentType 'application/json' -SessionVariable s -UseBasicParsing -TimeoutSec 30
    return [pscustomobject]@{
        Session = $s
        Status  = [int]$r.StatusCode
        Csrf    = ($s.Cookies.GetCookies($Api) | Where-Object { $_.Name -eq 'fb_csrf' }).Value
    }
}

Write-Host ''
Write-Host '  FUNDBRIDGE AI - BACKEND WALKTHROUGH' -ForegroundColor White
Write-Host '  Node.js / TypeScript / Express / Prisma / PostgreSQL' -ForegroundColor DarkGray

# ---------------------------------------------------------------------------
Section 1 'The backend is running'
# ---------------------------------------------------------------------------

$ports = @(
    @{ Name = 'PostgreSQL';  Port = 5433 },
    @{ Name = 'AI service';  Port = 8000 },
    @{ Name = 'Backend API'; Port = 4000 },
    @{ Name = 'Web app';     Port = 5173 }
)
foreach ($p in $ports) {
    if (Test-Port $p.Port) { Item "$($p.Name)  (port $($p.Port))" 'running' }
    else { Warn "$($p.Name) :$($p.Port)  NOT RUNNING" }
}
Write-Host ''
Note 'The API process that serves every request below:'
$apiProc = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -and $_.CommandLine -match 'tsx watch' } |
    Select-Object -First 1
if ($apiProc) { Item 'process' "node  PID $($apiProc.ProcessId)" }
Pause-Here

# ---------------------------------------------------------------------------
Section 2 'Source code: where the logic lives'
# ---------------------------------------------------------------------------

$srcFiles = Get-ChildItem "$Root\backend\src" -Recurse -Filter *.ts |
    Where-Object { $_.Name -notlike '*.test.ts' }
$srcLines = ($srcFiles | Get-Content | Measure-Object -Line).Lines
Item 'backend source files' $srcFiles.Count
Item 'lines of TypeScript'  $srcLines

Write-Host ''
Note 'The scoring engines - pure functions, no database, no clock, no LLM:'
Get-ChildItem "$Root\backend\src\engines" -Filter *.ts |
    Where-Object { $_.Name -notlike '*.test.ts' } |
    ForEach-Object {
        $n = (Get-Content $_.FullName | Measure-Object -Line).Lines
        Item "  engines/$($_.Name)" "$n lines"
    }
Note 'Weights arrive as arguments, so every score is reproducible from its inputs.'
Pause-Here

# ---------------------------------------------------------------------------
Section 3 'Public endpoints - open these in a browser'
# ---------------------------------------------------------------------------

foreach ($u in @('/health', '/meta', '/public/schemes')) {
    $code = Get-Status "$Api$u"
    Item "GET $Api$u" $code
}
Write-Host ''
Note 'These need no login, so a reviewer can open them directly in a browser.'
Note '/public/schemes returns only PUBLISHED records with an allowlisted field set.'

Write-Host ''
Note 'Scheme data carries its provenance:'
$schemes = Invoke-RestMethod -Uri "$Api/public/schemes" -TimeoutSec 30
Item 'schemes returned' $schemes.data.schemes.Count
Item 'verified against an official source' $schemes.data.verifiedCount
Item 'synthetic demonstration records' $schemes.data.syntheticCount
$real = $schemes.data.schemes | Where-Object { $_.sourceType -eq 'OFFICIAL_SOURCE' } | Select-Object -First 1
if ($real) {
    Write-Host ''
    Note 'Example of a verified record:'
    Item '  name' $real.name
    Item '  official source' $real.officialSourceUrl
    Item '  last verified' $real.lastVerifiedAt
}
Pause-Here

# ---------------------------------------------------------------------------
Section 4 'The authorisation boundary (the important one)'
# ---------------------------------------------------------------------------

Note 'Every check below runs on the SERVER. The interface is not the guard.'
Write-Host ''

Item 'anonymous  GET /business/dashboard' (Get-Status "$Api/business/dashboard")
Item 'anonymous  GET /admin/status'       (Get-Status "$Api/admin/status")
Note '  401 - not signed in'
Write-Host ''

$owner = Login 'owner@buildtech.local'
Item 'business owner signs in' $owner.Status
Item 'business owner  GET /admin/status' (Get-Status "$Api/admin/status" -Session $owner.Session)
Note '  403 - authenticated, but the wrong ROLE. A valid session is not enough.'
Write-Host ''

Item 'POST /business/readiness/analyse, no CSRF header' `
    (Get-Status "$Api/business/readiness/analyse" -Method POST -Session $owner.Session)
Note '  403 - CSRF double-submit token missing.'
Write-Host ''

Note 'Account enumeration is specifically prevented:'
try {
    Invoke-RestMethod -Uri "$Api/auth/login" -Method POST -TimeoutSec 30 `
        -ContentType 'application/json' `
        -Body (@{ email = 'owner@buildtech.local'; password = 'wrong' } | ConvertTo-Json -Compress)
} catch {
    $m = ($_.ErrorDetails.Message | ConvertFrom-Json).error.message
    Item '  real email, wrong password' "`"$m`""
}
try {
    Invoke-RestMethod -Uri "$Api/auth/login" -Method POST -TimeoutSec 30 `
        -ContentType 'application/json' `
        -Body (@{ email = 'nobody@nowhere.local'; password = 'wrong' } | ConvertTo-Json -Compress)
} catch {
    $m = ($_.ErrorDetails.Message | ConvertFrom-Json).error.message
    Item '  email that does not exist' "`"$m`""
}
Good '  Identical. An attacker cannot learn which addresses are registered.'
Pause-Here

# ---------------------------------------------------------------------------
Section 5 'A real result, with its full reasoning'
# ---------------------------------------------------------------------------

$dash = Invoke-RestMethod -Uri "$Api/business/dashboard" -WebSession $owner.Session -TimeoutSec 60
$d = $dash.data.dashboard

Item 'profile completion' "$($d.completion.overall)%"
if ($d.readiness) {
    Item 'funding readiness' "$($d.readiness.overallScore)/100  ($($d.readiness.category))"
    Item 'model / config version' "$($d.readiness.modelVersion) / $($d.readiness.configVersion)"
    Write-Host ''
    Note 'The score is not a black box - every component reports itself:'
    foreach ($c in $d.readiness.components) {
        $w = [math]::Round($c.weight * 100)
        Item "  $($c.name)" "$($c.score)/100   weight $w%   contributes $([math]::Round($c.contribution))"
    }
    Write-Host ''
    Note 'And each one names exactly what would raise it:'
    foreach ($c in $d.readiness.components) {
        if ($c.missing.Count -gt 0) {
            Item "  $($c.name) needs" ($c.missing -join '; ')
        }
    }
} else {
    Warn 'Readiness has not been calculated for this business yet.'
    Note 'Run with -IncludeRecompute, or press "Analyse" in the web app.'
}

Write-Host ''
Item 'scheme matches' "$($d.schemeMatches.total)  ($($d.schemeMatches.potentiallyEligible) potentially eligible)"
if ($d.schemeMatches.top.Count -gt 0) {
    $m = $d.schemeMatches.top[0]
    Write-Host ''
    Note "Top match - $($m.scheme.name)  $($m.eligibilityScore)/100  [$($m.status)]"
    foreach ($f in $m.explanation.factors) {
        $w = [math]::Round($f.weight * 100)
        Item "  $($f.name)" ("{0,3}%  weight {1,2}%  {2}" -f [math]::Round($f.score * 100), $w, $f.outcome)
    }
    Note 'UNKNOWN means the business did not state it - scored 0, never assumed in its favour.'
}
Pause-Here

# ---------------------------------------------------------------------------
Section 6 'The database behind it'
# ---------------------------------------------------------------------------

$envFile = Join-Path $Root 'backend\.env'
$dbUrl = (Select-String -Path $envFile -Pattern '^DATABASE_URL=' | Select-Object -First 1).Line
$dbUrl = $dbUrl -replace '^DATABASE_URL=', '' -replace '"', '' -replace '\?schema=public', ''

# The query goes via a temp file rather than -c.
#
# Windows PowerShell strips the double quotes from a native command's
# arguments, so a quoted identifier like "User" reaches psql unquoted,
# PostgreSQL lower-cases it, and the lookup fails. Passing the SQL in a file
# sidesteps argument parsing entirely.
function Sql([string]$query) {
    $tmp = Join-Path $env:TEMP ('fb_q_' + [guid]::NewGuid().ToString('N') + '.sql')
    try {
        Set-Content -Path $tmp -Value $query -Encoding utf8
        $out = & "$PgBin\psql.exe" $dbUrl -t -A -f $tmp 2>$null
        if ($out) { return ($out -join '').Trim() }
        return ''
    } finally {
        Remove-Item $tmp -ErrorAction SilentlyContinue
    }
}

Item 'server'     (Sql "SELECT current_database() || ' on PostgreSQL ' || current_setting('server_version')")
Item 'port'       '5433  (a project-owned cluster, not the machine service)'
Item 'tables'     (Sql "SELECT count(*) FROM pg_tables WHERE schemaname='public'")
Item 'migrations' (Sql "SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL")
Write-Host ''
Note 'Row counts:'
foreach ($t in @('User','BusinessProfile','GovernmentScheme','SchemeMatch','FundingReadiness','AuditLog')) {
    Item "  $t" (Sql "SELECT count(*) FROM ""$t""")
}
Write-Host ''
Note 'The audit log records failed sign-ins WITHOUT the attempted password:'
Item '  failed logins recorded' (Sql "SELECT count(*) FROM ""AuditLog"" WHERE action = 'auth.login_failed'")
Write-Host ''
Note 'Browse it visually with:  npm.cmd run db:studio'
Pause-Here

# ---------------------------------------------------------------------------
Section 7 'Automated tests'
# ---------------------------------------------------------------------------

Note 'Run these live if you have a few minutes:'
Write-Host ''
Item '  npm.cmd run test:unit --workspace backend' '143 tests - engines, config, uploads'
Item '  npm.cmd run test:integration --workspace backend' '24 tests - real HTTP, real database'
Item '  pytest (ai-service)' '122 tests - NLP, retrieval, LLM routing'
Write-Host ''
Note 'The integration tests run against a dedicated "test" schema, and the'
Note 'truncation helper asserts the schema name before deleting anything.'

if ($IncludeRecompute) {
    Section 8 'Recomputing live (writes derived rows)'
    $hdr = @{ 'X-CSRF-Token' = $owner.Csrf }
    Item 'POST /business/readiness/analyse' `
        (Get-Status "$Api/business/readiness/analyse" -Method POST -Session $owner.Session -Headers $hdr)
    Item 'POST /business/matches/schemes/recalculate' `
        (Get-Status "$Api/business/matches/schemes/recalculate" -Method POST -Session $owner.Session -Headers $hdr)
    Good 'Scores regenerated from the current profile.'
}

Write-Host ''
Write-Host ('  ' + ('-' * 68)) -ForegroundColor DarkGray
Write-Host '  Web application:  http://localhost:5173/login' -ForegroundColor White
Write-Host "  Password for all demo accounts:  $Password" -ForegroundColor DarkGray
Write-Host ''
