import { beforeEach, afterEach, describe, test, expect } from '@jest/globals';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, '..');
const CLI_PATH = path.join(ROOT_DIR, 'bin', 'deset');

// Helper function to run CLI commands
function runCLI(args = '', options = {}) {
  const command = `node "${CLI_PATH}" ${args}`;
  try {
    return execSync(command, {
      encoding: 'utf-8',
      cwd: options.cwd || ROOT_DIR,
      env: {
        ...process.env,
        NODE_OPTIONS: '--experimental-vm-modules',
        PATH: `${process.env.PATH};${path.join(ROOT_DIR, 'node_modules', '.bin')}`,
      },
      ...options,
    });
  } catch (error) {
    console.error(error);
    throw error;
  }
}

// Helper function to create a temporary test directory
async function createTempDir() {
  const tempDir = path.join(ROOT_DIR, 'temp-test-' + Date.now());
  await fs.mkdir(tempDir, { recursive: true });

  // Create a basic package.json
  const packageJson = {
    name: 'test-project',
    version: '1.0.0',
    description: 'Test project',
    type: 'module',
    scripts: {
      test: 'echo "test"',
    },
    dependencies: {
      chalk: '^4.0.0', // Intentionally outdated
    },
    devDependencies: {
      eslint: '^7.0.0', // Intentionally outdated
    },
  };

  await fs.writeFile(path.join(tempDir, 'package.json'), JSON.stringify(packageJson, null, 2));

  return tempDir;
}

// Helper function to cleanup temp directory
async function cleanupTempDir(tempDir) {
  try {
    await fs.rm(tempDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

describe('CLI Integration Tests', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await createTempDir();
  });

  afterEach(async () => {
    if (tempDir) {
      await cleanupTempDir(tempDir);
    }
  });

  describe('deset --help', () => {
    test('should show help information', () => {
      const output = runCLI('--help');

      expect(output).toContain('OAS Developer Environment Setup Tool');
      expect(output).toContain('Automate environment setup');
      expect(output).toContain('init');
      expect(output).toContain('check');
      expect(output).toContain('config');
    });
  });

  describe('deset --version', () => {
    test('should show version information', () => {
      const output = runCLI('--version');

      expect(output.trim()).toBe('1.0.0');
    });
  });

  describe('deset init', () => {
    test('should show dry-run output correctly', () => {
      const output = runCLI('init --dry-run', { cwd: tempDir });

      // The CLI doesn't show progress indicators in integration tests
      expect(output).toContain('Planned actions');
      expect(output).toContain('Setup ESLint configuration');
    });

    test('should create ESLint config file', async () => {
      runCLI('init --no-prettier --no-husky --no-dependabot', { cwd: tempDir });

      const eslintConfig = await fs.readFile(path.join(tempDir, '.eslintrc.json'), 'utf-8');

      const config = JSON.parse(eslintConfig);
      expect(config.extends).toContain('eslint:recommended');
    });

    test('should create Prettier config file', async () => {
      runCLI('init --no-eslint --no-husky --no-dependabot', { cwd: tempDir });

      const prettierConfig = await fs.readFile(path.join(tempDir, '.prettierrc'), 'utf-8');

      const config = JSON.parse(prettierConfig);
      expect(config.semi).toBe(true);
      expect(config.singleQuote).toBe(true);
    });

    test('should handle JSON output format', () => {
      const output = runCLI('init --dry-run --format json', { cwd: tempDir });

      const result = JSON.parse(output);
      expect(result).toHaveProperty('dryRun', true);
      expect(result).toHaveProperty('plannedActions');
      expect(Array.isArray(result.plannedActions)).toBe(true);
    });
  });

  describe('deset check', () => {
    test('should run basic health checks', () => {
      const output = runCLI('check --no-interactive', { cwd: tempDir });

      expect(output).toContain('Project Health Check Results');
      expect(output).toContain('Security Audit');
      expect(output).toContain('Outdated Packages');
    });

    test('should handle JSON output format', () => {
      const output = runCLI('check --no-interactive --format json', { cwd: tempDir });

      // Extract JSON from output (find the JSON object)
      const jsonMatch = output.match(/\{[\s\S]*\}/);
      expect(jsonMatch).not.toBeNull();

      const result = JSON.parse(jsonMatch[0]);
      expect(result).toHaveProperty('audit');
      expect(result).toHaveProperty('outdated');
      expect(result).toHaveProperty('summary');
    });

    test('should detect outdated packages', () => {
      const output = runCLI('check --no-interactive', { cwd: tempDir });

      expect(output).toContain('Outdated Packages');
      // Should detect our intentionally outdated packages
      expect(output).toMatch(/chalk.*→/);
    });

    test('should handle --no-audit flag', () => {
      const output = runCLI('check --no-interactive --no-audit', { cwd: tempDir });

      // Should still run but skip audit
      expect(output).toContain('Project Health Check Results');
    });
  });

  describe('deset config', () => {
    test('should handle --reset flag', () => {
      const output = runCLI('config --reset', {
        cwd: tempDir,
        input: 'y\n', // Confirm reset
      });

      expect(output).toContain('reset');
    });
  });

  describe('Error Handling', () => {
    test('should handle non-existent project directory', () => {
      const nonExistentDir = path.join(ROOT_DIR, 'non-existent-' + Date.now());

      expect(() => {
        runCLI('check', { cwd: nonExistentDir });
      }).toThrow();
    });

    test('should handle invalid command', () => {
      expect(() => {
        runCLI('invalid-command');
      }).toThrow();
    });

    test('should handle missing package.json', async () => {
      // Remove package.json
      await fs.unlink(path.join(tempDir, 'package.json'));

      // The CLI should handle missing package.json gracefully
      const output = runCLI('check --no-interactive', { cwd: tempDir });

      // Should show an error message about missing package.json
      expect(output).toContain('Could not read package.json');
    });
  });

  describe('Command Aliases', () => {
    test('should support init alias "i"', () => {
      const output = runCLI('i --dry-run', { cwd: tempDir });

      expect(output).toContain('Planned actions');
      expect(output).toContain('Setup ESLint configuration');
    });

    test('should support check alias "c"', () => {
      const output = runCLI('c --no-interactive', { cwd: tempDir });

      expect(output).toContain('Project Health Check Results');
    });
  });

  describe('Git Integration', () => {
    test('should handle --changed-only flag in non-git directory', () => {
      const output = runCLI('check --changed-only --no-interactive', { cwd: tempDir });

      // The CLI should work even without git, just process all files
      expect(output).toContain('Project Health Check Results');
    });
  });
});
