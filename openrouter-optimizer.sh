#!/usr/bin/env bash
# OpenRouter Optimizer - Bun wrapper
# Faster installation using bun (no npm spinner)
# Falls back to npx if bun is not available
#
# Usage:
#   ./openrouter-optimizer setup           # Interactive setup
#   ./openrouter-optimizer setup --project # Project-level config
#   ./openrouter-optimizer --help         # Show help

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMP_DIR=""

cleanup() {
  if [ -n "$TEMP_DIR" ] && [ -d "$TEMP_DIR" ]; then
    rm -rf "$TEMP_DIR"
  fi
}

trap cleanup EXIT

# Check if bun is available
if command -v bun &> /dev/null; then
  BUN_AVAILABLE=true
else
  BUN_AVAILABLE=false
fi

# Parse arguments
ARGS=("$@")

# If no args, show help
if [ ${#ARGS[@]} -eq 0 ]; then
  if [ "$BUN_AVAILABLE" = true ]; then
    echo "OpenRouter Optimizer (via bun)"
    echo "============================================="
    echo ""
    echo "Usage: $0 <command> [options]"
    echo ""
    echo "Commands:"
    echo "  setup           Configure MCP server for your AI harnesses"
    echo "  --help, -h      Show this help"
    echo ""
    echo "Run with 'setup' to start interactive setup."
  else
    npx -y github:DonAyers/openrouter-optimizer --help
  fi
  exit 0
fi

# Check if first arg is a command
COMMAND="${ARGS[0]}"

if [ "$COMMAND" = "setup" ]; then
  if [ "$BUN_AVAILABLE" = true ]; then
    echo "OpenRouter Optimizer (via bun)"
    echo "============================================="
    echo ""
    echo "Using bun - faster installation, no spinner."
    echo ""
    
    # Create temp directory
    TEMP_DIR=$(mktemp -d)
    
    # Clone repo to temp dir
    echo "Cloning repository..."
    git clone --depth 1 https://github.com/DonAyers/openrouter-optimizer.git "$TEMP_DIR" 2>/dev/null
    
    cd "$TEMP_DIR"
    
    # Install with bun (fast, no spinner)
    echo "Installing dependencies..."
    bun install --silent
    
    # Run setup
    echo ""
    exec bun run setup.ts "${ARGS[@]:1}"
  else
    # Fall back to npx
    echo "OpenRouter Optimizer (via npx)"
    echo "============================================="
    echo ""
    echo "Bun not found, using npx (may show npm spinner during install)..."
    echo ""
    exec npx -y github:DonAyers/openrouter-optimizer setup "${ARGS[@]:1}"
  fi
elif [ "$COMMAND" = "--help" ] || [ "$COMMAND" = "-h" ]; then
  if [ "$BUN_AVAILABLE" = true ]; then
    echo "OpenRouter Optimizer (via bun)"
  else
    echo "OpenRouter Optimizer (via npx)"
  fi
  echo "============================================="
  echo ""
  echo "Usage: $0 <command> [options]"
  echo ""
  echo "Commands:"
  echo "  setup           Configure MCP server for your AI harnesses"
  echo "  --help, -h      Show this help"
  echo ""
  echo "Run 'setup' to start interactive setup."
  echo ""
  echo "Note: If bun is available, this wrapper uses bun for faster installation."
  echo "      Otherwise, falls back to npx."
else
  # Pass through to npx for other commands
  if [ "$BUN_AVAILABLE" = true ]; then
    echo "Using bun..."
    TEMP_DIR=$(mktemp -d)
    git clone --depth 1 https://github.com/DonAyers/openrouter-optimizer.git "$TEMP_DIR" 2>/dev/null
    cd "$TEMP_DIR"
    bun install --silent
    exec bun run index.ts "${ARGS[@]}"
  else
    exec npx -y github:DonAyers/openrouter-optimizer "$@"
  fi
fi
