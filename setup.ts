#!/usr/bin/env bun
#!/usr/bin/env bun
/**
 * OpenRouter Optimizer - Setup CLI
 * 
 * Detects installed AI harnesses and configures MCP server integration.
 * 
 * Usage:
 *   bun run setup.ts              # Interactive setup
 *   bun run setup.ts --detect    # Detect only, no config
 *   bun run setup.ts --add <harness>  # Add specific harness
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { homedir } from 'os';

// --- Configuration ---

interface HarnessConfig {
  name: string;
  displayName: string;
  configPath: string;
  configKey: string;
  command: string;
  args: string[];
  detected: boolean;
}

const MCP_SERVER_PATH = resolve(__dirname, 'src/mcp-server.ts');

// Harness definitions with their config locations
const HARNESSES: HarnessConfig[] = [
  {
    name: 'opencode',
    displayName: 'OpenCode',
    configPath: join(homedir(), '.config', 'opencode', 'settings.json'),
    configKey: 'mcpServers',
    command: 'bun',
    args: ['run', MCP_SERVER_PATH],
    detected: false,
  },
  {
    name: 'claude',
    displayName: 'Claude Code',
    configPath: join(homedir(), '.claude', 'settings.json'),
    configKey: 'mcpServers',
    command: 'bun',
    args: ['run', MCP_SERVER_PATH],
    detected: false,
  },
  {
    name: 'claude-desktop',
    displayName: 'Claude Desktop',
    configPath: join(homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json'),
    configKey: 'mcpServers',
    command: 'bun',
    args: ['run', MCP_SERVER_PATH],
    detected: false,
  },
  {
    name: 'vscode-copilot',
    displayName: 'GitHub Copilot (VS Code)',
    configPath: join(homedir(), '.config', 'Code', 'User', 'globalStorage', 'github.copilot', 'storage.json'),
    configKey: 'mcp',
    command: 'bun',
    args: ['run', MCP_SERVER_PATH],
    detected: false,
  },
  {
    name: 'cursor',
    displayName: 'Cursor',
    configPath: join(homedir(), '.cursor', 'mcp.json'),
    configKey: 'mcpServers',
    command: 'bun',
    args: ['run', MCP_SERVER_PATH],
    detected: false,
  },
];

// --- Detection ---

function detectHarness(harness: HarnessConfig): boolean {
  // Check if config file exists (indicates harness is likely installed)
  if (existsSync(harness.configPath)) {
    return true;
  }
  
  // Check for CLI tools
  const cliChecks: Record<string, string[]> = {
    opencode: ['opencode', 'opencode-ai'],
    claude: ['claude', 'claude-code'],
    'claude-desktop': [],
    'vscode-copilot': [],
    cursor: ['cursor'],
  };

  const commands = cliChecks[harness.name] || [];
  for (const cmd of commands) {
    try {
      const result = spawnSync(cmd, ['--version'], { encoding: 'utf-8', stdio: 'pipe' });
      if (result.status === 0) {
        return true;
      }
    } catch {
      // Command not found, continue
    }
  }

  return false;
}

function detectAllHarnesses(): void {
  for (const harness of HARNESSES) {
    harness.detected = detectHarness(harness);
  }
}

// --- Config Writing ---

function readConfigFile(path: string): Record<string, unknown> | null {
  try {
    if (!existsSync(path)) {
      return null;
    }
    const content = readFileSync(path, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function writeConfigFile(path: string, config: Record<string, unknown>): void {
  // Ensure directory exists
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  
  writeFileSync(path, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}

function addMcpServer(config: Record<string, unknown>, harness: HarnessConfig): Record<string, unknown> {
  const existing = config[harness.configKey] as Record<string, unknown> | undefined;
  
  if (!existing) {
    config[harness.configKey] = {
      'openrouter-optimizer': {
        command: harness.command,
        args: harness.args,
      },
    };
  } else {
    (existing as Record<string, unknown>)['openrouter-optimizer'] = {
      command: harness.command,
      args: harness.args,
    };
    config[harness.configKey] = existing;
  }
  
  return config;
}

function configureHarness(harness: HarnessConfig): boolean {
  const config = readConfigFile(harness.configPath) || {};
  
  // Check if already configured
  const existing = config[harness.configKey] as Record<string, unknown> | undefined;
  if (existing && (existing as Record<string, unknown>)['openrouter-optimizer']) {
    console.log(`  Already configured for ${harness.displayName}`);
    return true;
  }

  // Add the MCP server
  const newConfig = addMcpServer(config, harness);
  writeConfigFile(harness.configPath, newConfig);
  
  console.log(`  Configured for ${harness.displayName}`);
  return true;
}

// --- CLI ---

function printUsage(): void {
  console.log(`
openrouter-optimizer setup - Configure MCP server for AI harnesses

USAGE:
  bun run setup.ts              Interactive setup (detect + prompt)
  bun run setup.ts --detect     Detect installed harnesses only
  bun run setup.ts --add <name>  Configure specific harness
  bun run setup.ts --list       List all supported harnesses

HARNSES:
  ${HARNESSES.map(h => `  ${h.name.padEnd(20)} ${h.displayName}`).join('\n')}

EXAMPLES:
  bun run setup.ts                    # Interactive setup
  bun run setup.ts --detect          # See what's detected
  bun run setup.ts --add claude      # Configure Claude Code only
`);
}

function interactiveSetup(): void {
  console.log('OpenRouter Optimizer Setup');
  console.log('═'.repeat(50));
  console.log('');
  console.log('This will configure the MCP server for your AI harnesses.');
  console.log('The server recommends optimal OpenRouter routers for your tasks.');
  console.log('');

  detectAllHarnesses();

  const detected = HARNESSES.filter(h => h.detected);
  const notDetected = HARNESSES.filter(h => !h.detected);

  if (detected.length === 0) {
    console.log('No harnesses detected. You can still manually configure.');
    console.log('');
    console.log('Config locations:');
    for (const h of HARNESSES) {
      console.log(`  ${h.displayName}: ${h.configPath}`);
    }
    console.log('');
    console.log('To manually add, create the config file with:');
    console.log(`  { "mcpServers": { "openrouter-optimizer": { "command": "bun", "args": ["run", "${MCP_SERVER_PATH}"] } } }`);
    return;
  }

  console.log('Detected harnesses:');
  for (const h of detected) {
    console.log(`  ✓ ${h.displayName}`);
  }
  console.log('');

  if (notDetected.length > 0) {
    console.log('Not detected (may still be installed):');
    for (const h of notDetected) {
      console.log(`  ○ ${h.displayName}`);
    }
    console.log('');
  }

  console.log('Configure which harnesses? (comma-separated names, or "all")');
  console.log(`Default: ${detected.map(h => h.name).join(', ') || 'none'}`);
  
  // In a real interactive setup, we'd prompt here.
  // For now, default to configuring all detected.
  const toConfigure = detected.map(h => h.name);

  console.log('');
  console.log(`Configuring: ${toConfigure.join(', ')}...`);
  console.log('');

  let success = 0;
  let failed = 0;

  for (const name of toConfigure) {
    const harness = HARNESSES.find(h => h.name === name);
    if (!harness) {
      console.log(`  Unknown harness: ${name}`);
      failed++;
      continue;
    }

    try {
      configureHarness(harness);
      success++;
    } catch (e) {
      console.log(`  Failed to configure ${harness.displayName}: ${e}`);
      failed++;
    }
  }

  console.log('');
  console.log(`Done! ${success} configured, ${failed} failed.`);
  console.log('');
  console.log('Restart your AI harnesses to load the MCP server.');
}

// Parse args
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  printUsage();
  process.exit(0);
}

if (args.includes('--detect')) {
  detectAllHarnesses();
  console.log('Harness detection:');
  for (const h of HARNESSES) {
    console.log(`  ${h.detected ? '✓' : '○'} ${h.displayName.padEnd(25)} ${h.configPath}`);
  }
  process.exit(0);
}

if (args.includes('--list')) {
  console.log('Supported harnesses:');
  for (const h of HARNESSES) {
    console.log(`  ${h.name}: ${h.displayName}`);
    console.log(`    Config: ${h.configPath}`);
  }
  process.exit(0);
}

if (args.includes('--add')) {
  const harnessName = args[args.indexOf('--add') + 1];
  if (!harnessName) {
    console.error('Error: --add requires a harness name');
    printUsage();
    process.exit(1);
  }

  const harness = HARNESSES.find(h => h.name === harnessName);
  if (!harness) {
    console.error(`Unknown harness: ${harnessName}`);
    console.log('Use --list to see available harnesses');
    process.exit(1);
  }

  console.log(`Configuring ${harness.displayName}...`);
  configureHarness(harness);
  console.log('Done.');
  process.exit(0);
}

// Default: interactive setup
interactiveSetup();
