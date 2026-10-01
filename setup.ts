#!/usr/bin/env bun
/**
 * OpenRouter Optimizer - Setup CLI
 * 
 * Detects installed AI harnesses and configures MCP server integration.
 * 
 * Usage:
 *   bun run setup.ts              # Interactive setup (prompts for user/project + harnesses)
 *   bun run setup.ts --project    # Project-level only (skips user/project prompt)
 *   bun run setup.ts --user       # User-level only (skips user/project prompt)
 *   bun run setup.ts --detect     # Detect only, no config
 *   bun run setup.ts --add <harness>  # Add specific harness
 *   bun run setup.ts --add <harness> --project  # Add specific harness (project-level)
 *   bun run setup.ts --noninteractive        # Non-interactive (default: user-level, all detected)
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';
import { homedir } from 'os';

// --- Prompt Helpers ---

function prompt(question: string, defaultValue?: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(`${question}${defaultValue ? ` [${defaultValue}]` : ''}: `);
    const buf = Buffer.alloc(1024);
    process.stdin.once('data', (data: Buffer) => {
      const answer = data.toString().trim();
      resolve(answer || defaultValue || '');
    });
  });
}

function promptYN(question: string, defaultValue = true): Promise<boolean> {
  return prompt(question, defaultValue ? 'Y/n' : 'y/N').then(answer => answer.toLowerCase() !== 'n');
}

// --- Configuration ---

interface HarnessConfig {
  name: string;
  displayName: string;
  configPath: string;
  projectConfigPath: string;
  configKey: string;
  command: string;
  args: string[];
  detected: boolean;
  supportsProjectLevel: boolean;
}

const MCP_SERVER_PATH = resolve(__dirname, 'src/mcp-server.ts');

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
    supportsProjectLevel: false,
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
    supportsProjectLevel: true,
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
    supportsProjectLevel: false,
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
    supportsProjectLevel: true,
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
    supportsProjectLevel: true,
  },
];

// --- Detection ---

function detectHarness(harness: HarnessConfig): boolean {
  if (existsSync(harness.configPath)) return true;
  
  const cliChecks: Record<string, string[]> = {
    opencode: ['opencode', 'opencode-ai'],
    claude: ['claude', 'claude-code'],
    'claude-desktop': [],
    'vscode-copilot': [],
    cursor: ['cursor'],
  };

  for (const cmd of cliChecks[harness.name] || []) {
    try {
      const result = require('child_process').spawnSync(cmd, ['--version'], { encoding: 'utf-8', stdio: 'pipe' });
      if (result.status === 0) return true;
    } catch {
      // ignore
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
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return null;
  }
}

function writeConfigFile(path: string, config: Record<string, unknown>): void {
  const dir = resolve(path, '..');
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(path, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}

function addMcpServer(config: Record<string, unknown>, harness: HarnessConfig): Record<string, unknown> {
  const existing = config[harness.configKey] as Record<string, unknown> | undefined;
  const serverConfig = {
    command: harness.command,
    args: harness.args,
  };

  if (!existing) {
    config[harness.configKey] = { 'openrouter-optimizer': serverConfig };
  } else {
    (existing as Record<string, unknown>)['openrouter-optimizer'] = serverConfig;
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
  const existing = config[harness.configKey] as Record<string, unknown> | undefined;
  
  if (existing && (existing as Record<string, unknown>)['openrouter-optimizer']) {
    console.log(`  Already configured for ${harness.displayName}${projectMode ? ' (project)' : ''}`);
    return true;
  }

  const newConfig = addMcpServer(config, harness);
  writeConfigFile(configPath, newConfig);
  console.log(`  ✓ Configured for ${harness.displayName}${projectMode ? ' (project)' : ''}`);
  return true;
}

// --- Interactive Setup ---

async function interactiveSetup(projectMode = false): Promise<void> {
  console.log('OpenRouter Optimizer Setup');
  console.log('═'.repeat(50));
  console.log('');
  console.log('This will configure the MCP server for your AI harnesses.');
  console.log('The server recommends optimal OpenRouter routers for your tasks.');
  console.log('');

  detectAllHarnesses();

  let finalProjectMode = projectMode;
  if (!projectMode) {
    const useProject = await promptYN('Install for this project only?', false);
    finalProjectMode = useProject;
    console.log('');
  }

  const eligible = HARNESSES.filter(h => h.detected && (finalProjectMode ? h.supportsProjectLevel : true));
  const notDetected = HARNESSES.filter(h => !h.detected);

  if (eligible.length === 0) {
    if (finalProjectMode) {
      console.log('No harnesses detected that support project-level config.');
      console.log('');
      console.log('Harnesses supporting project-level config:');
      for (const h of HARNESSES.filter(h => h.supportsProjectLevel)) {
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
      if (h.supportsProjectLevel) console.log(`    Project: ${h.projectConfigPath}`);
    }
    console.log('');
    console.log('To manually add, create the config file with:');
    console.log(`  { "mcpServers": { "openrouter-optimizer": { "command": "bun", "args": ["run", "${MCP_SERVER_PATH}"] } } }`);
    return;
  }

  console.log(`${finalProjectMode ? 'Project-level' : 'User-level'} config for:`);
  for (const h of eligible) console.log(`  ✓ ${h.displayName}`);
  console.log('');

  if (notDetected.length > 0) {
    console.log('Not detected (may still be installed):');
    for (const h of notDetected) console.log(`  ○ ${h.displayName}`);
    console.log('');
  }

  const defaultSelections = eligible.map(h => h.name).join(',');
  const selection = await prompt(`Configure which harnesses? (comma-separated names, or "all")`, defaultSelections);
  console.log('');

  let toConfigure: string[];
  if (selection.toLowerCase() === 'all') {
    toConfigure = eligible.map(h => h.name);
  } else {
    toConfigure = selection.split(',').map(s => s.trim()).filter(s => s.length > 0);
  }
  toConfigure = toConfigure.filter(name => eligible.some(h => h.name === name));
  
  if (toConfigure.length === 0) {
    console.log('No valid harnesses selected. Exiting.');
    return;
  }

  console.log(`Configuring: ${toConfigure.join(', ')}...`);
  console.log('');

  let success = 0, failed = 0, skipped = 0;
  for (const name of toConfigure) {
    const harness = HARNESSES.find(h => h.name === name);
    if (!harness) { failed++; continue; }
    try {
      if (configureHarness(harness, finalProjectMode)) success++;
      else skipped++;
    } catch (e) { console.log(`  Failed: ${harness.displayName}: ${e}`); failed++; }
  }

  console.log('');
  console.log(`Done! ${success} configured, ${skipped} skipped, ${failed} failed.`);
  console.log('');
  if (finalProjectMode) {
    console.log('Project-level MCP config created. This only affects this project.');
    console.log(`Config: ${process.cwd()}/${getProjectConfigFilename(eligible[0]?.projectConfigPath || '')}`);
    console.log('');
    console.log('To use in another project, run setup again in that project.');
  } else {
    console.log('Restart your AI harnesses to load the MCP server.');
  }
}

function getProjectConfigFilename(path: string): string {
  const parts = path.split('/');
  return parts[parts.length - 1] || path;
}

// --- CLI ---

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
    if (h.supportsProjectLevel) console.log(`    Project: ${h.projectConfigPath}`);
  }
  process.exit(0);
}

if (args.includes('--list')) {
  console.log('Supported harnesses:');
  for (const h of HARNESSES) {
    console.log(`  ${h.name}: ${h.displayName}`);
    console.log(`    User config: ${h.configPath}`);
    if (h.supportsProjectLevel) console.log(`    Project config: ${h.projectConfigPath}`);
  }
  process.exit(0);
}

if (args.includes('--add')) {
  const harnessName = args[args.indexOf('--add') + 1];
  if (!harnessName) { console.error('Error: --add requires a harness name'); printUsage(); process.exit(1); }

  const harness = HARNESSES.find(h => h.name === harnessName);
  if (!harness) { console.error(`Unknown harness: ${harnessName}`); console.log('Use --list to see available harnesses'); process.exit(1); }

  const projectMode = args.includes('--project');
  if (projectMode && !harness.supportsProjectLevel) {
    console.error(`Error: ${harness.displayName} does not support project-level config`);
    console.log('Use without --project for user-level config.');
    process.exit(1);
  }

  console.log(`Configuring ${harness.displayName}${projectMode ? ' (project-level)' : ''}...`);
  configureHarness(harness, projectMode);
  console.log('Done.');
  process.exit(0);
}

const nonInteractive = args.includes('--noninteractive');
const explicitProject = args.includes('--project');
const explicitUser = args.includes('--user');

if (nonInteractive) {
  interactiveSetup(false);
} else if (explicitProject && explicitUser) {
  console.error('Error: cannot specify both --project and --user');
  process.exit(1);
} else if (explicitProject || explicitUser) {
  interactiveSetup(explicitProject);
} else {
  interactiveSetup();
}

function printUsage(): void {
  console.log(`
openrouter-optimizer setup - Configure MCP server for AI harnesses

USAGE:
  bun run setup.ts              Interactive setup (prompts for user/project + harnesses)
  bun run setup.ts --project     Project-level only
  bun run setup.ts --user        User-level only
  bun run setup.ts --detect      Detect only, no config
  bun run setup.ts --add <name>  Add specific harness
  bun run setup.ts --add <name> --project  Add specific harness (project-level)
  bun run setup.ts --noninteractive     Non-interactive (default: user-level, all detected)

FLAGS:
  --project       Project-level config
  --user          User-level config
  --noninteractive Non-interactive mode

HARNSES:
${HARNESSES.map(h => `  ${h.name.padEnd(20)} ${h.displayName}${h.supportsProjectLevel ? ' [project-level]' : ''}`).join('\n')}

EXAMPLES:
  bun run setup.ts                    # Interactive (prompts)
  bun run setup.ts --project          # Project-level only
  bun run setup.ts --add claude       # User-level: Claude Code
  bun run setup.ts --add claude --project  # Project-level: Claude Code
`);
}
