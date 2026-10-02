#!/usr/bin/env pwsh
# OpenRouter Optimizer - PowerShell wrapper
# Faster installation using bun (no npm spinner)
# Falls back to npx if bun is not available
#
# Usage:
#   .\openrouter-optimizer.ps1 setup           # Interactive setup
#   .\openrouter-optimizer.ps1 setup --project # Project-level config
#   .\openrouter-optimizer.ps1 --help         # Show help

$ErrorActionPreference = 'Stop'

function Get-BunAvailable {
  return Get-Command bun -ErrorAction SilentlyContinue -ErrorVariable _
}

function Get-TempDir {
  $tempPath = [System.IO.Path]::GetTempPath()
  $tempDir = Join-Path $tempPath "openrouter-optimizer-$([System.Guid]::NewGuid().ToString('N'))"
  New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
  return $tempDir
}

$bunAvailable = [bool](Get-BunAvailable)
$tempDir = $null

try {
  $argsList = $args

  if ($argsList.Count -eq 0) {
    if ($bunAvailable) {
      Write-Host "OpenRouter Optimizer (via bun)" -ForegroundColor Cyan
    } else {
      Write-Host "OpenRouter Optimizer (via npx)" -ForegroundColor Cyan
    }
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Usage: .\openrouter-optimizer.ps1 <command> [options]"
    Write-Host ""
    Write-Host "Commands:"
    Write-Host "  setup           Configure MCP server for your AI harnesses"
    Write-Host "  --help, -h      Show this help"
    Write-Host ""
    Write-Host "Run 'setup' to start interactive setup."
    exit 0
  }

  $command = $argsList[0]

  if ($command -eq 'setup') {
    if ($bunAvailable) {
      Write-Host "OpenRouter Optimizer (via bun)" -ForegroundColor Cyan
      Write-Host "========================================" -ForegroundColor Cyan
      Write-Host ""
      Write-Host "Using bun - faster installation, no spinner." -ForegroundColor Green
      Write-Host ""

      $tempDir = Get-TempDir
      $env:TEMP_DIR = $tempDir

      Write-Host "Cloning repository..."
      git clone --depth 1 https://github.com/DonAyers/openrouter-optimizer.git $tempDir 2>$null

      Set-Location $tempDir

      Write-Host "Installing dependencies..."
      bun install --silent

      Write-Host ""
      $remainingArgs = $argsList[1..($argsList.Count - 1)]
      & bun run setup.ts @remainingArgs
    } else {
      Write-Host "OpenRouter Optimizer (via npx)" -ForegroundColor Cyan
      Write-Host "========================================" -ForegroundColor Cyan
      Write-Host ""
      Write-Host "Bun not found, using npx (may show npm spinner during install)..." -ForegroundColor Yellow
      Write-Host ""

      $remainingArgs = $argsList[1..($argsList.Count - 1)]
      if ($remainingArgs.Count -eq 0) {
        npx -y github:DonAyers/openrouter-optimizer setup
      } else {
        npx -y github:DonAyers/openrouter-optimizer setup @remainingArgs
      }
    }
  } elseif ($command -eq '--help' -or $command -eq '-h') {
    if ($bunAvailable) {
      Write-Host "OpenRouter Optimizer (via bun)" -ForegroundColor Cyan
    } else {
      Write-Host "OpenRouter Optimizer (via npx)" -ForegroundColor Cyan
    }
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Usage: .\openrouter-optimizer.ps1 <command> [options]"
    Write-Host ""
    Write-Host "Commands:"
    Write-Host "  setup           Configure MCP server for your AI harnesses"
    Write-Host "  --help, -h      Show this help"
    Write-Host ""
    Write-Host "Run 'setup' to start interactive setup."
    Write-Host ""
    Write-Host "Note: If bun is available, this wrapper uses bun for faster installation."
    Write-Host "      Otherwise, falls back to npx."
    exit 0
  } else {
    $remainingArgs = $argsList
    if ($bunAvailable) {
      Write-Host "Using bun..."
      $tempDir = Get-TempDir
      $env:TEMP_DIR = $tempDir
      git clone --depth 1 https://github.com/DonAyers/openrouter-optimizer.git $tempDir 2>$null
      Set-Location $tempDir
      bun install --silent
      & bun run index.ts @remainingArgs
    } else {
      if ($remainingArgs.Count -eq 0) {
        npx -y github:DonAyers/openrouter-optimizer --help
      } else {
        npx -y github:DonAyers/openrouter-optimizer @remainingArgs
      }
    }
  }
} finally {
  if ($tempDir -and (Test-Path $tempDir)) {
    Remove-Item -Path $tempDir -Recurse -Force
  }
}
