param(
    [switch]$SkipFrontendTest,
    [switch]$SkipFrontendBuild,
    [switch]$SkipDockerConfig,
    [switch]$IncludeTypecheck,
    [switch]$IncludeDependencyAudit
)

$ErrorActionPreference = "Stop"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

function Invoke-Step {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][scriptblock]$ScriptBlock
    )

    Write-Host ""
    Write-Host "==> $Name"
    Push-Location $Root
    try {
        & $ScriptBlock
    }
    finally {
        Pop-Location
    }
}

function Assert-FrontendNode {
    $version = (& node -v).Trim()
    if ($version -notmatch '^v(20|22)\.') {
        throw "Frontend verification requires Node 20 or 22 LTS; found $version. Put a supported Node first on PATH."
    }

    Write-Host "Node $version"
}

Invoke-Step "Legacy active-source scan" {
    $pattern = "LegacyBlockchainSettings|BlockchainSettings|BlockchainService|BlockchainServerService|BundlerService|SessionService|ContractABIs|UserOperation|KhoaPhien|BlockchainTransaction|api/ViBlockchain|api/blockchain|api/bundler|api/metamask|deployBlockchain|syncBlockchain|recordTransaction|geth\.holihu\.online"
    $paths = @(
        "WebApplication3/WebApplication3/WebApplication3",
        "frontend/src",
        "frontend/index.html",
        "docker-compose.active.yml",
        "docker"
    )

    & rg -n $pattern @paths -g "!**/bin/**" -g "!**/obj/**" -g "!frontend/build/**" -g "!**/node_modules/**"
    if ($LASTEXITCODE -eq 0) {
        throw "Legacy identifiers remain in active source."
    }
    if ($LASTEXITCODE -ne 1) {
        throw "Legacy scan failed with exit code $LASTEXITCODE."
    }
}

Invoke-Step "Security anti-pattern scan" {
    $pattern = "RNGCryptoServiceProvider|new Random\(|TwoCaptcha|2Captcha|GoogleRecaptcha|Score = 20|isValid = true|SolveRecaptcha"
    $paths = @(
        "WebApplication3/WebApplication3/WebApplication3",
        "frontend/src"
    )

    & rg -n $pattern @paths -g "!**/bin/**" -g "!**/obj/**" -g "!frontend/build/**" -g "!**/node_modules/**"
    if ($LASTEXITCODE -eq 0) {
        throw "Security anti-patterns remain in active source."
    }
    if ($LASTEXITCODE -ne 1) {
        throw "Security anti-pattern scan failed with exit code $LASTEXITCODE."
    }
}

if ((-not $SkipFrontendTest) -or (-not $SkipFrontendBuild) -or $IncludeTypecheck) {
    Invoke-Step "Frontend Node version" {
        Assert-FrontendNode
    }
}

Invoke-Step "Backend build" {
    dotnet build WebApplication3/WebApplication3/WebApplication3.sln -c Debug --no-incremental -v:minimal
}

if (-not $SkipFrontendTest) {
    Invoke-Step "Frontend tests" {
        Push-Location "frontend"
        try {
            npm test -- --runInBand
        }
        finally {
            Pop-Location
        }
    }
}

if (-not $SkipFrontendBuild) {
    Invoke-Step "Frontend build" {
        Push-Location "frontend"
        try {
            npm run build
        }
        finally {
            Pop-Location
        }
    }
}

if ($IncludeTypecheck) {
    Invoke-Step "Frontend active typecheck" {
        Push-Location "frontend"
        try {
            npm run typecheck:active
        }
        finally {
            Pop-Location
        }
    }
}

if ($IncludeDependencyAudit) {
    Invoke-Step "Backend dependency audit" {
        $audit = dotnet list WebApplication3/WebApplication3/WebApplication3/WebApplication3.csproj package --vulnerable --include-transitive 2>&1
        $auditExit = $LASTEXITCODE
        $audit | Write-Host
        if ($auditExit -ne 0) {
            throw "dotnet vulnerable package audit failed with exit code $auditExit."
        }
        if (($audit -join "`n") -match "has the following vulnerable packages") {
            throw "NuGet vulnerable packages found."
        }
    }

    Invoke-Step "Frontend npm audit" {
        Push-Location "frontend"
        try {
            $json = npm audit --json 2>&1
            $auditExit = $LASTEXITCODE
            $report = $json | ConvertFrom-Json
            $total = [int]$report.metadata.vulnerabilities.total
            if ($total -gt 0) {
                throw "npm audit found $total vulnerabilities."
            }
            if ($auditExit -ne 0) {
                throw "npm audit failed with exit code $auditExit."
            }
            Write-Host "npm audit vulnerabilities: 0"
        }
        finally {
            Pop-Location
        }
    }
}

if (-not $SkipDockerConfig) {
    Invoke-Step "Docker compose config" {
        docker compose -f docker-compose.active.yml config --no-interpolate > $null
    }
}

Invoke-Step "Git diff check" {
    git diff --check
}

Write-Host ""
Write-Host "Active verification completed."
