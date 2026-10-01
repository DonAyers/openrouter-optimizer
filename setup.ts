#!/usr/bin/env bun
/**
 * OpenRouter Optimizer - Setup CLI
 * 
 * Detects installed AI harnesses and configures MCP server integration.
 * 
 * Usage:
 *   bun run setup.ts              # Interactive setup (user-level by default)
 *   bun run setup.ts --project    # Project-level config only
 *   bun run setup.ts --detect    # Detect only, no config
 *   bun run setup.ts --add <harness>  # Add specific harness (user-level)
 *   bun run setup.ts --add <harness> --project  # Add specific harness (project-level)
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { homedir } from 'os';

// --- Configuration ---

interface HarnessConfig {
  name: string;
  displayName: string;
  configPath: string;           // User-level config path
  projectConfigPath: string;    // Project-level config path (optional)
  configKey: string;
  command: string;
  args: string[];
  detected: boolean;
  supportsProjectLevel: boolean; // Whether this harness supports project-level config
}

const MCP_SERVER_PATH = resolve(__dirname, 'src/mcp-server.ts');

// Harness definitions with their config locations
const HARNESSES: HarnessConfig[] = [
  {
    name: 'opencode',
    displayName: 'OpenCode',
    configPath: join(homedir(), '.config', 'opencode', 'settings.json'),
    projectConfigPath: join(process.cwd(), '.opencode', 'settings.json'),
    configKey: 'mcpServers',
    command: 'bun',
    args: ['run', MCP_SERVER_PATH],
    detected: false,
    supportsProjectLevel: false, // OpenCode may not support project-level MCP
  },
  {
    name: 'claude',
    displayName: 'Claude Code',
    configPath: join(homedir(), '.claude', 'settings.json'),
    projectConfigPath: join(process.cwd(), '.claude', 'settings.json'),
    configKey: 'mcpServers',
    command: 'bun',
    args: ['run', MCP_SERVER_PATH],
    detected: false,
    supportsProjectLevel: true, // Claude Code supports project-level config
  },
  {
    name: 'claude-desktop',
    displayName: 'Claude Desktop',
    configPath: join(homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json'),
    projectConfigPath: '',
    configKey: 'mcpServers',
    command: 'bun',
    args: ['run', MCP_SERVER_PATH],
    detected: false,
    supportsProjectLevel: false, // Claude Desktop is user-level only
  },
  {
    name: 'vscode-copilot',
    displayName: 'GitHub Copilot (VS Code)',
    configPath: join(homedir(), '.config', 'Code', 'User', 'globalStorage', 'github.copilot', 'storage.json'),
    projectConfigPath: join(process.cwd(), '.vscode', 'settings.json'),
    configKey: 'mcp',
    command: 'bun',
    args: ['run', MCP_SERVER_PATH],
    detected: false,
    supportsProjectLevel: true, // VS Code supports workspace settings
  },
  {
    name: 'cursor',
    displayName: 'Cursor',
    configPath: join(homedir(), '.cursor', 'mcp.json'),
    projectConfigPath: join(process.cwd(), '.cursor', 'mcp.json'),
    configKey: 'mcpServers',
    command: 'bun',
    args: ['run', MCP_SERVER_PATH],
    detected: false,
    supportsProjectLevel: true, // Cursor supports project-level config
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

function configureHarness(harness: HarnessConfig, projectMode = false): boolean {
  const configPath = projectMode && harness.supportsProjectLevel ? harness.projectConfigPath : harness.configPath;
  
  if (projectMode && !harness.supportsProjectLevel) {
    console.log(`  ✗ ${harness.displayName}: does not support project-level config`);
    return false;
  }
  
  const config = readConfigFile(configPath) || {};
  
  // Check if already configured
  const existing = config[harness.configKey] as Record<string, unknown> | undefined;
  if (existing && (existing as Record<string, unknown>)['openrouter-optimizer']) {
    console.log(`  Already configured for ${harness.displayName}${projectMode ? ' (project)' : ''}`);
    return true;
  }

  // Add the MCP server
  const newConfig = addMcpServer(config, harness);
  writeConfigFile(configPath, newConfig);
  
  console.log(`  ✓ Configured for ${harness.displayName}${projectMode ? ' (project)' : ''}`);
  return true;
}

// --- CLI ---

function printUsage(): void {
  console.log(`
openrouter-optimizer setup - Configure MCP server for AI harnesses

USAGE:
  bun run setup.ts              Interactive setup (user-level by default)
  bun run setup.ts --project     Interactive setup (project-level only)
  bun run setup.ts --detect      Detect installed harnesses only
  bun run setup.ts --add <name>  Configure specific harness (user-level)
  bun run setup.ts --add <name> --project  Configure specific harness (project-level)
  bun run setup.ts --list        List all supported harnesses

FLAGS:
  --project    Use project-level config instead of user-level
              (only works for harnesses that support it: claude, vscode-copilot, cursor)

HARNSES:
  ${HARNESSES.map(h => `  ${h.name.padEnd(20)} ${h.displayName}${h.supportsProjectLevel ? ' [project-level]' : ''}`).join('\n')}

EXAMPLES:
  bun run setup.ts                    # User-level interactive setup
  bun run setup.ts --project          # Project-level interactive setup
  bun run setup.ts --add claude       # User-level: configure Claude Code
  bun run setup.ts --add claude --project  # Project-level: configure Claude Code
`);
}

function interactiveSetup(projectMode = false): void {
  console.log('OpenRouter Optimizer Setup');
  console.log('═'.repeat(50));
  console.log('');
  console.log(`Mode: ${projectMode ? 'Project-level' : 'User-level'}`);
  console.log('The server recommends optimal OpenRouter routers for your tasks.');
  console.log('');

  detectAllHarnesses();

  // Filter to harnesses that support the selected mode
  const eligible = HARNESSES.filter(h => 
    h.detected && 
    (projectMode ? h.supportsProjectLevel : !h.supportsProjectLevel || h.supportsProjectLevel)
  );
  
  const notDetected = HARNESSES.filter(h => !h.detected);

  if (eligible.length === 0) {
    if (projectMode) {
      console.log('No harnesses detected that support project-level config.');
      console.log('');
      console.log('Harnesses supporting project-level config:');
      const supportsProject = HARNESSES.filter(h => h.supportsProjectLevel);
      for (const h of supportsProject) {
        console.log(`  ${h.displayName}: ${h.projectConfigPath}`);
      }
    } else {
      console.log('No harnesses detected. You can still manually configure.');
    }
    console.log('');
    console.log('Config locations:');
    for (const h of HARNESSES) {
      console.log(`  ${h.displayName}:`);
      console.log(`    User: ${h.configPath}`);
      if (h.supportsProjectLevel) {
        console.log(`    Project: ${h.projectConfigPath}`);
      }
    }
    console.log('');
    console.log('To manually add, create the config file with:');
    console.log(`  { "mcpServers": { "openrouter-optimizer": { "command": "bun", "args": ["run", "${MCP_SERVER_PATH}"] } } }`);
    return;
  }

  console.log('Detected harnesses:');
  for (const h of eligible) {
    console.log(`  ✓ ${h.displayName}${projectMode ? ' (project-level)' : ''}`);
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
  console.log(`Default: ${eligible.map(h => h.name).join(', ') || 'none'}`);
  
  // For now, default to configuring all eligible
  const toConfigure = eligible.map(h => h.name);

  console.log('');
  console.log(`Configuring: ${toConfigure.join(', ')}...`);
  console.log('');

  let success = 0;
  let failed = 0;
  let skipped = 0;

  for (const name of toConfigure) {
    const harness = HARNESSES.find(h => h.name === name);
    if (!harness) {
      console.log(`  Unknown harness: ${name}`);
      failed++;
      continue;
    }

    try {
      if (configureHarness(harness, projectMode)) {
        success++;
      } else {
        skipped++;
      }
    } catch (e) {
      console.log(`  Failed to configure ${harness.displayName}: ${e}`);
      failed++;
    }
  }

  console.log('');
  console.log(`Done! ${success} configured, ${skipped} skipped (no project support), ${failed} failed.`);
  console.log('');
  if (projectMode) {
    console.log('Project-level MCP config created. This only affects this project.');
    console.log(`Config file: ${process.cwd()}/${getProjectConfigFilename(eligible[0]?.projectConfigPath || '')}`);
  } else {
    console.log('Restart your AI harnesses to load the MCP server.');
  }
}

function getProjectConfigFilename(path: string): string {
  // Extract just the filename from the full path
  const parts = path.split('/');
  return parts[parts.length - 1] || path;
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

  const projectMode = args.includes('--project');
  
  if (projectMode && !harness.supportsProjectLevel) {
    console.error(`Error: ${harness.displayName} does not support project-level config`);
    console.log('Use without --project for user-level config, or choose a different harness.');
    process.exit(1);
  }

  console.log(`Configuring ${harness.displayName}${projectMode ? ' (project-level)' : ''}...`);
  configureHarness(harness, projectMode);
  console.log('Done.');
  process.exit(0);
}

// Default: interactive setup
const projectMode = args.includes('--project');
interactiveSetup(projectMode);
