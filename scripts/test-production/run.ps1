param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('init', 'check', 'db', 'build', 'up', 'verify', 'down', 'release-local')]
    [string]$Action,
    [string]$NodePath = 'node'
)
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$infra = Join-Path $repo 'infra/test-production'
$envFile = Join-Path $infra '.env'
$composeFile = Join-Path $infra 'compose.yaml'

function Invoke-Compose {
    param([string[]]$ComposeArguments)
    & docker compose --project-name masterqala-test-production --project-directory $infra --env-file $envFile -f $composeFile @ComposeArguments
    if ($LASTEXITCODE -ne 0) { throw "Test Compose action failed (exit $LASTEXITCODE)." }
}

if ($Action -eq 'init') {
    if (Test-Path -LiteralPath $envFile) { throw 'Local .env already exists; refusing to replace credentials for an existing volume.' }
    function New-LocalSecret {
        $bytes = New-Object byte[] 32
        $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
        try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
        return (($bytes | ForEach-Object { $_.ToString('x2') }) -join '')
    }
    $content = "TEST_DB_PASSWORD=$(New-LocalSecret)`nTEST_JWT_SECRET=$(New-LocalSecret)`n"
    $stream = [IO.File]::Open($envFile, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write)
    try {
        $bytes = [Text.Encoding]::UTF8.GetBytes($content)
        $stream.Write($bytes, 0, $bytes.Length)
    } finally { $stream.Dispose() }
    Write-Host 'Generated local-only secrets in ignored infra/test-production/.env. Values withheld.'
    exit 0
}

if (!(Test-Path -LiteralPath $envFile)) { throw 'Run init first.' }
$settings = @{}
foreach ($line in [IO.File]::ReadAllLines($envFile)) {
    if ($line -match '^\s*(#.*)?$') { continue }
    if ($line -notmatch '^(TEST_DB_PASSWORD|TEST_JWT_SECRET)=([a-f0-9]{64})$') {
        throw 'Local .env must contain only the two generated 64-character hex secrets. Values withheld.'
    }
    if ($settings.ContainsKey($Matches[1])) { throw 'Duplicate setting in local .env.' }
    $settings[$Matches[1]] = $Matches[2]
}
if ($settings.Count -ne 2) { throw 'Both local secrets are required; use init on a fresh environment.' }

$overrides = @{} + $settings
if ($Action -eq 'release-local') {
    $overrides += @{
        MQ_TEST_PRODUCTION = 'isolated-local-only'; NODE_ENV = 'test'; COMMERCIAL_MODE = 'FREE_PILOT'
        SMS_PROVIDER_MODE = 'CONSOLE'; FILE_SCAN_MODE = 'DISABLED'; PGBOSS_DISABLED = '0'
        DATABASE_URL = "postgresql://mq_test_production:$($settings.TEST_DB_PASSWORD)@127.0.0.1:15432/masterqala_test_production"
    }
}
$previous = @{}
try {
    foreach ($key in $overrides.Keys) {
        $previous[$key] = [Environment]::GetEnvironmentVariable($key, 'Process')
        [Environment]::SetEnvironmentVariable($key, $overrides[$key], 'Process')
    }
    switch ($Action) {
        'check' {
            Invoke-Compose -ComposeArguments @('config', '--quiet')
            & $NodePath --test (Join-Path $PSScriptRoot 'guard.test.cjs')
            if ($LASTEXITCODE -ne 0) { throw 'Database target guard tests failed.' }
        }
        'db' { Invoke-Compose -ComposeArguments @('up', '-d', '--wait', '--wait-timeout', '120', 'db') }
        'build' {
            # Sequential service builds keep memory usage bounded.
            foreach ($service in @('release', 'site', 'client', 'master', 'operator')) {
                Invoke-Compose -ComposeArguments @('build', $service)
            }
        }
        'up' {
            Invoke-Compose -ComposeArguments @('up', '-d', '--wait', '--wait-timeout', '180', 'db')
            Invoke-Compose -ComposeArguments @('stop', 'site', 'client', 'master', 'operator', 'api')
            # A fresh one-shot release is required on every deployment, even if an old one exited 0.
            Invoke-Compose -ComposeArguments @('run', '--rm', '--no-deps', 'release')
            Invoke-Compose -ComposeArguments @('up', '-d', '--no-deps', '--wait', '--wait-timeout', '180', 'api')
            Invoke-Compose -ComposeArguments @('up', '-d', '--no-deps', '--wait', '--wait-timeout', '180', 'site', 'client', 'master', 'operator')
        }
        'verify' {
            $health = Invoke-RestMethod 'http://127.0.0.1:13000/api/v1/health/ready' -TimeoutSec 15
            if (!$health.ready -or $health.dependencies.database.status -ne 'UP' -or $health.dependencies.queue.status -ne 'UP' -or $health.dependencies.scanner.status -ne 'DISABLED') {
                throw 'Readiness does not match the intended test stack.'
            }
            $categories = Invoke-RestMethod 'http://127.0.0.1:13000/api/v1/categories' -TimeoutSec 15
            if (@($categories).Count -lt 6) { throw 'Seed categories are missing.' }
            foreach ($port in @(14100, 14200, 14300, 14400)) {
                $response = Invoke-WebRequest "http://127.0.0.1:$port/" -TimeoutSec 30 -UseBasicParsing
                if ($response.StatusCode -ne 200) { throw "UI health failed on $port." }
            }
            Write-Host 'Ready: dedicated database, queue, categories and all four production-built UI services. Scanner is intentionally DISABLED.'
        }
        'down' {
            # Keep test data; never use down -v, global prune, or another Compose project.
            Invoke-Compose -ComposeArguments @('down', '--timeout', '20')
        }
        'release-local' {
            & $NodePath (Join-Path $PSScriptRoot 'release.cjs') --local
            if ($LASTEXITCODE -ne 0) { throw 'Guarded local release failed.' }
        }
    }
} finally {
    foreach ($key in $previous.Keys) { [Environment]::SetEnvironmentVariable($key, $previous[$key], 'Process') }
}
