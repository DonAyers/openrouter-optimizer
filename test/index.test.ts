import { describe, expect, test } from 'bun:test';
import { spawn } from 'node:child_process';
import { resolve } from 'path';

// Helper to run CLI commands and capture output
function runCLI(args: string[], timeout = 30000, scriptPath = resolve(__dirname, '..', 'index.ts'), stdinInput?: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const proc = spawn('bun', ['run', scriptPath, ...args], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    proc.stdout.on('data', (data: Buffer) => { stdoutChunks.push(data); });
    proc.stderr.on('data', (data: Buffer) => { stderrChunks.push(data); });

    if (stdinInput) {
      proc.stdin.write(stdinInput);
      proc.stdin.end();
    }

    proc.on('close', (code) => {
      resolve({
        stdout: Buffer.concat(stdoutChunks).toString(),
        stderr: Buffer.concat(stderrChunks).toString(),
        exitCode: code ?? 1,
      });
    });
    proc.on('error', reject);
  });
}

describe('Slaygent CLI', () => {
  describe('index.ts - CLI tool', () => {
    test('shows help when no args provided', async () => {
      const result = await runCLI([]);
      expect(result.stdout).toContain('USAGE:');
      expect(result.stdout).toContain('--task');
      expect(result.exitCode).toBe(1);
    });

    test('shows help with --help flag', async () => {
      const result = await runCLI(['--help']);
      expect(result.stdout).toContain('USAGE:');
      expect(result.exitCode).toBe(0);
    });

    test('requires --task argument', async () => {
      const result = await runCLI(['--budget', '0.01']);
      // When no --task, shows help AND error message, exits with code 1
      expect(result.stdout).toContain('USAGE:');
      expect(result.stderr).toContain('Error: --task is required');
      expect(result.exitCode).toBe(1);
    });

    test('accepts --task with budget', async () => {
      const result = await runCLI(['--task', 'Fix a bug', '--budget', '0.01']);
      expect(result.stdout).toContain('Task classified as:');
      expect(result.exitCode).toBe(0);
    });

    test('accepts -t shorthand for --task', async () => {
      const result = await runCLI(['-t', 'Write code', '--budget', '0.001']);
      expect(result.stdout).toContain('Task classified as:');
      expect(result.exitCode).toBe(0);
    });

    test('accepts --json flag', async () => {
      const result = await runCLI(['--task', 'Test task', '--json']);
      // JSON output should be parseable
      const output = JSON.parse(result.stdout);
      expect(output.task).toBe('Test task');
      expect(output.task_type).toBeDefined();
      expect(result.exitCode).toBe(0);
    });

    test('accepts context flags', async () => {
      const result = await runCLI([
        '--task', 'Fix authentication',
        '--context-framework', 'express',
        '--context-language', 'typescript'
      ]);
      expect(result.stdout).toContain('Task classified as:');
      expect(result.exitCode).toBe(0);
    });

    test('accepts --free-only flag', async () => {
      const result = await runCLI(['--task', 'Summarize this', '--free-only']);
      expect(result.stdout).toContain('Task classified as:');
      expect(result.exitCode).toBe(0);
    });

    test('accepts --min-coding flag', async () => {
      const result = await runCLI(['--task', 'Write code', '--min-coding', '0.5']);
      expect(result.stdout).toContain('Task classified as:');
      expect(result.exitCode).toBe(0);
    });

    test('accepts --quiet flag', async () => {
      const result = await runCLI(['--task', 'Test', '--quiet']);
      // Quiet mode should still output something
      expect(result.exitCode).toBe(0);
    });

    test('accepts --session flag', async () => {
      const result = await runCLI(['--task', 'Multi-turn task', '--session', 'test-session']);
      expect(result.stdout).toContain('Task classified as:');
      expect(result.exitCode).toBe(0);
    });
  });

  describe('index.ts - setup delegation', () => {
    test('delegates to setup.ts when first arg is "setup"', async () => {
      // Pipe input: answer "n" for user-level, then "all" for harnesses
      const result = await runCLI(['setup'], 15000, resolve(__dirname, '..', 'index.ts'), 'n\nall\n');
      expect(result.stdout).toContain('Slaygent Setup');
      expect(result.stdout).toContain('Loading...');
      expect(result.stdout).toContain('User-level config for:');
      expect(result.exitCode).toBe(0);
    });

    test('delegates to setup.ts with --project flag', async () => {
      // With --project, skips user/project prompt, just asks for harnesses
      const result = await runCLI(['setup', '--project'], 15000, resolve(__dirname, '..', 'index.ts'), 'all\n');
      expect(result.stdout).toContain('Slaygent Setup');
      expect(result.stdout).toContain('Configuring');
      expect(result.exitCode).toBe(0);
    });

    test('delegates to setup.ts with --detect flag', async () => {
      const result = await runCLI(['setup', '--detect'], 10000, resolve(__dirname, '..', 'index.ts'));
      expect(result.stdout).toContain('Harness detection:');
      expect(result.exitCode).toBe(0);
    });

    test('delegates to setup.ts with --add flag', async () => {
      const result = await runCLI(['setup', '--add', 'claude'], 10000, resolve(__dirname, '..', 'index.ts'));
      expect(result.stdout).toContain('Configuring');
      expect(result.exitCode).toBe(0);
    });
  });

  describe('setup.ts - setup CLI', () => {
    const setupPath = resolve(__dirname, '..', 'setup.ts');

    test('shows help with --help flag', async () => {
      const result = await runCLI(['setup.ts', '--help'], 10000, setupPath);
      expect(result.stdout).toContain('slaygent setup');
      expect(result.exitCode).toBe(0);
    });

    test('--detect shows harness detection', async () => {
      const result = await runCLI(['setup.ts', '--detect'], 10000, setupPath);
      expect(result.stdout).toContain('Harness detection:');
      expect(result.stdout).toContain('claude');
      expect(result.exitCode).toBe(0);
    });

    test('--list shows supported harnesses', async () => {
      const result = await runCLI(['setup.ts', '--list'], 10000, setupPath);
      expect(result.stdout).toContain('Supported harnesses:');
      expect(result.stdout).toContain('claude');
      expect(result.stdout).toContain('zed');
      expect(result.exitCode).toBe(0);
    });

    test('--add claude configures Claude Code', async () => {
      const result = await runCLI(['setup.ts', '--add', 'claude'], 10000, setupPath);
      expect(result.stdout).toContain('Configuring Claude Code');
      expect(result.stdout).toContain('Installed skills');
      expect(result.stdout).toContain('Installed commands');
      expect(result.exitCode).toBe(0);
    });

    test('--add with --project for project-level config', async () => {
      const result = await runCLI(['setup.ts', '--add', 'claude', '--project'], 10000, setupPath);
      expect(result.stdout).toContain('Configuring Claude Code');
      expect(result.stdout).toContain('project-level');
      expect(result.exitCode).toBe(0);
    });

    test('--add with unsupported project harness fails', async () => {
      const result = await runCLI(['setup.ts', '--add', 'claude-desktop', '--project'], 10000, setupPath);
      expect(result.stdout).toContain('Use without --project for user-level config');
      expect(result.exitCode).toBe(1);
    });
  });

  describe('npx flow simulation', () => {
    // This tests that npx github:DonAyers/slaygent setup works
    test('npx setup command delegates correctly', async () => {
      // When npx runs the package, it runs the bin entry (index.ts)
      // If first arg is "setup", it should delegate to setup.ts
      // Pipe input: answer "n" for user-level, then "all" for harnesses
      const result = await runCLI(['setup'], 15000, resolve(__dirname, '..', 'index.ts'), 'n\nall\n');
      expect(result.stdout).toContain('Slaygent Setup');
      expect(result.stdout).toContain('Loading...');
      expect(result.stdout).toContain('User-level config for:');
      expect(result.exitCode).toBe(0);
    });
  });

});