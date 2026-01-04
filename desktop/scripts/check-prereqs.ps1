# Check prerequisites for building the desktop app locally (Windows)
# Run from repository root or desktop/ folder in PowerShell

$ErrorActionPreference = "Continue"

Write-Host "========================================"
Write-Host "  DnD Toolkit Desktop - Prereq Check"
Write-Host "========================================"
Write-Host ""

$Errors = 0

# Check Node.js
try {
    $NodeVersion = node -v 2>$null
    if ($NodeVersion) {
        Write-Host "✓ Node.js installed: $NodeVersion" -ForegroundColor Green
        
        # Check minimum version (18+)
        $MajorVersion = [int]($NodeVersion -replace 'v(\d+)\..*', '$1')
        if ($MajorVersion -lt 18) {
            Write-Host "  ⚠ Node.js 18+ recommended (you have $NodeVersion)" -ForegroundColor Yellow
        }
    } else {
        throw "not found"
    }
} catch {
    Write-Host "✗ Node.js not found" -ForegroundColor Red
    Write-Host "  Install from: https://nodejs.org/"
    $Errors++
}

# Check npm
try {
    $NpmVersion = npm -v 2>$null
    if ($NpmVersion) {
        Write-Host "✓ npm installed: v$NpmVersion" -ForegroundColor Green
    } else {
        throw "not found"
    }
} catch {
    Write-Host "✗ npm not found" -ForegroundColor Red
    $Errors++
}

# Check Git
try {
    $GitVersion = git --version 2>$null
    if ($GitVersion) {
        $GitVersionNum = ($GitVersion -split ' ')[2]
        Write-Host "✓ Git installed: v$GitVersionNum" -ForegroundColor Green
    } else {
        throw "not found"
    }
} catch {
    Write-Host "✗ Git not found" -ForegroundColor Red
    Write-Host "  Install from: https://git-scm.com/"
    $Errors++
}

Write-Host ""
Write-Host "Windows-specific requirements:"

# Check for Visual Studio Build Tools (optional but recommended)
$VSWherePath = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
if (Test-Path $VSWherePath) {
    $VSInstalls = & $VSWherePath -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property displayName 2>$null
    if ($VSInstalls) {
        Write-Host "✓ Visual Studio Build Tools found" -ForegroundColor Green
        Write-Host "  $($VSInstalls | Select-Object -First 1)"
    } else {
        Write-Host "⚠ Visual Studio C++ Build Tools not found (optional)" -ForegroundColor Yellow
        Write-Host "  Some native modules may fail to build"
        Write-Host "  Install: https://visualstudio.microsoft.com/visual-cpp-build-tools/"
        Write-Host "  Select 'Desktop development with C++' workload"
    }
} else {
    # Check for standalone Build Tools
    $BuildToolsPath = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\2022\BuildTools"
    $BuildToolsPath2 = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\2019\BuildTools"
    
    if ((Test-Path $BuildToolsPath) -or (Test-Path $BuildToolsPath2)) {
        Write-Host "✓ Visual Studio Build Tools found" -ForegroundColor Green
    } else {
        Write-Host "⚠ Visual Studio Build Tools not detected (optional)" -ForegroundColor Yellow
        Write-Host "  Native module compilation may require this"
        Write-Host "  Install: https://visualstudio.microsoft.com/visual-cpp-build-tools/"
    }
}

# Check Windows SDK (usually comes with VS Build Tools)
$WindowsKitsPath = "${env:ProgramFiles(x86)}\Windows Kits\10\Include"
if (Test-Path $WindowsKitsPath) {
    Write-Host "✓ Windows SDK found" -ForegroundColor Green
} else {
    Write-Host "⚠ Windows SDK not found (usually installed with VS Build Tools)" -ForegroundColor Yellow
}

# Project status
Write-Host ""
Write-Host "Project status:"

# Determine root path
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = if ($ScriptDir -match "desktop[/\\]scripts$") {
    Resolve-Path (Join-Path $ScriptDir "../../")
} elseif (Test-Path "package.json") {
    Get-Location
} else {
    $null
}

if ($RootDir) {
    $DistPath = Join-Path $RootDir "dist"
    $DesktopModulesPath = Join-Path $RootDir "desktop/node_modules"
    
    if ((Test-Path $DistPath) -and (Test-Path (Join-Path $DistPath "index.html"))) {
        Write-Host "✓ Web build exists (dist/)" -ForegroundColor Green
    } else {
        Write-Host "⚠ Web build not found" -ForegroundColor Yellow
        Write-Host "  Run: npm run predeploy"
    }
    
    if (Test-Path $DesktopModulesPath) {
        Write-Host "✓ Desktop dependencies installed" -ForegroundColor Green
    } else {
        Write-Host "⚠ Desktop dependencies not installed" -ForegroundColor Yellow
        Write-Host "  Run: npm run desktop:install"
    }
}

# Summary
Write-Host ""
Write-Host "========================================"
if ($Errors -eq 0) {
    Write-Host "All prerequisites met!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Quick start:"
    Write-Host "  npm run predeploy        # Build web export"
    Write-Host "  npm run desktop:install  # Install desktop deps (once)"
    Write-Host "  npm run desktop:dev      # Run in dev mode"
    Write-Host "  npm run desktop:dist     # Build installer"
} else {
    Write-Host "$Errors prerequisite(s) missing" -ForegroundColor Red
    Write-Host "Please install the missing items above."
    exit 1
}
