import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { loadConfig, mergeConfigWithFlags } from '../config.js';
import {
  fileExists,
  writeJsonFile,
  writeTextFile,
  readPackageJson,
  writePackageJson,
  log,
  formatOutput,
} from '../utils.js';
import { validateOptions } from '../error-handler.js';

// Validation schema for init command options
const INIT_OPTIONS_SCHEMA = {
  types: {
    'dry-run': 'boolean',
    format: 'string',
    eslint: 'boolean',
    prettier: 'boolean',
    husky: 'boolean',
    'lint-staged': 'boolean',
    dependabot: 'boolean',
    audit: 'boolean',
    'stale-check': 'boolean',
  },
  enum: {
    format: ['text', 'json'],
  },
};

/**
 * ESLint configuration
 */
const ESLINT_CONFIG = {
  extends: ['eslint:recommended', 'prettier'],
  env: {
    node: true,
    es2022: true,
  },
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  rules: {
    'no-console': 'warn',
    'no-unused-vars': 'error',
  },
};

/**
 * Prettier configuration
 */
const PRETTIER_CONFIG = {
  semi: true,
  singleQuote: true,
  tabWidth: 2,
  trailingComma: 'es5',
  printWidth: 100,
};

/**
 * Dependabot configuration
 */
const DEPENDABOT_CONFIG = {
  version: 2,
  updates: [
    {
      'package-ecosystem': 'npm',
      directory: '/',
      schedule: {
        interval: 'weekly',
      },
      'open-pull-requests-limit': 5,
    },
  ],
};

/**
 * Husky pre-commit hook content
 */
const HUSKY_PRE_COMMIT = `#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

npx lint-staged
`;

/**
 * Initialize developer environment
 * @param {Object} options - Command options
 */
export async function initCommand(options) {
  // Validate options first
  const validationErrors = validateOptions(options, INIT_OPTIONS_SCHEMA);
  if (validationErrors.length > 0) {
    validationErrors.forEach((error) => {
      log('error', error.message);
    });
    throw new Error('Invalid command options. Check the command syntax and try again.');
  }

  const spinner = ora('Initializing developer environment...').start();
  const startTime = Date.now();

  try {
    // Load and merge configuration
    const baseConfig = await loadConfig();
    const config = mergeConfigWithFlags(baseConfig, options);

    const actions = [];
    const results = {
      success: [],
      warnings: [],
      errors: [],
      skipped: [],
      timing: {},
    };

    // Plan actions based on configuration
    if (config.features.eslint) {
      actions.push({
        name: 'Setup ESLint configuration',
        type: 'eslint',
        file: '.eslintrc.json',
        config: ESLINT_CONFIG,
      });
    }

    if (config.features.prettier) {
      actions.push({
        name: 'Setup Prettier configuration',
        type: 'prettier',
        file: '.prettierrc',
        config: PRETTIER_CONFIG,
      });
    }

    if (config.features.lintStaged) {
      actions.push({
        name: 'Setup lint-staged in package.json',
        type: 'lint-staged',
      });
    }

    if (config.features.husky) {
      actions.push({
        name: 'Setup Husky pre-commit hook',
        type: 'husky',
        file: '.husky/pre-commit',
        content: HUSKY_PRE_COMMIT,
      });
    }

    if (config.features.dependabot) {
      actions.push({
        name: 'Setup Dependabot configuration',
        type: 'dependabot',
        file: '.github/dependabot.yml',
        config: DEPENDABOT_CONFIG,
      });
    }

    // Show planned actions if dry-run
    if (options.dryRun) {
      spinner.succeed(chalk.blue('Dry run completed - showing planned actions'));

      if (options.format === 'json') {
        console.log(
          formatOutput(
            {
              dryRun: true,
              plannedActions: actions.map((action) => ({
                name: action.name,
                file: action.file || 'package.json',
                type: action.type,
              })),
            },
            'json'
          )
        );
      } else {
        console.log(chalk.cyan('\nPlanned actions:'));
        actions.forEach((action) => {
          console.log(chalk.gray('-'), action.name);
          if (action.file) {
            console.log(chalk.gray('  File:'), action.file);
          }
        });
      }
      return;
    }

    // Execute actions with progress indication
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      spinner.text = `${action.name} (${i + 1}/${actions.length})`;

      try {
        switch (action.type) {
          case 'eslint':
          case 'prettier':
          case 'dependabot':
            await executeConfigAction(action);
            results.success.push(action.name);
            log('success', action.name);
            break;

          case 'lint-staged':
            await executeLintStagedAction();
            results.success.push(action.name);
            log('success', action.name);
            break;

          case 'husky':
            await executeHuskyAction(action);
            results.success.push(action.name);
            log('success', action.name);
            break;

          default:
            results.skipped.push(action.name);
            log('warning', `Skipped: ${action.name} (unknown type)`);
        }
      } catch (error) {
        results.errors.push({
          action: action.name,
          error: error.message,
        });
        log('error', `Failed: ${action.name} - ${error.message}`);
      }
    }

    const endTime = Date.now();
    results.timing.total = endTime - startTime;

    spinner.succeed(chalk.green('✓ Developer environment initialized successfully'));

    // Output results
    if (options.format === 'json') {
      console.log(formatOutput(results, 'json'));
    } else {
      console.log(
        chalk.green(
          `\n✓ Initialization complete! ${results.success.length} actions completed in ${results.timing.total}ms.`
        )
      );

      if (results.warnings.length > 0) {
        console.log(chalk.yellow(`⚠ ${results.warnings.length} warnings`));
      }

      if (results.errors.length > 0) {
        console.log(chalk.red(`✗ ${results.errors.length} errors`));
        results.errors.forEach((error) => {
          console.log(chalk.red(`  - ${error.action}: ${error.error}`));
        });
      }

      // Show next steps
      if (results.success.length > 0) {
        console.log(chalk.cyan('\nNext steps:'));
        console.log(chalk.cyan('  1. Run "npm install" to install dev dependencies'));
        console.log(chalk.cyan('  2. Run "devset check" to verify your setup'));
        console.log(chalk.cyan('  3. Commit your changes to git'));
      }
    }

    // Exit with error code if there were errors
    if (results.errors.length > 0) {
      throw new Error(
        `Initialization completed with ${results.errors.length} errors. Review the error details above and fix any issues.`
      );
    }
  } catch (error) {
    spinner.fail(chalk.red('✗ Failed to initialize developer environment'));
    if (error.message && !error.message.includes('completed with')) {
      log('error', `Initialization failed: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Execute a configuration file action
 * @param {Object} action - Action to execute
 */
async function executeConfigAction(action) {
  const filePath = path.join(process.cwd(), action.file);

  if (await fileExists(filePath)) {
    log('warning', `${action.file} already exists, skipping`);
    return;
  }

  await writeJsonFile(filePath, action.config);
}

/**
 * Execute lint-staged setup
 */
async function executeLintStagedAction() {
  const packageJson = await readPackageJson();

  if (packageJson['lint-staged']) {
    log('warning', 'lint-staged already configured in package.json');
    return;
  }

  packageJson['lint-staged'] = {
    '*.{js,jsx,ts,tsx}': ['eslint --fix', 'prettier --write'],
    '*.{json,css,md}': ['prettier --write'],
  };

  await writePackageJson(packageJson);
}

/**
 * Execute Husky setup
 * @param {Object} action - Action to execute
 */
async function executeHuskyAction(action) {
  const filePath = path.join(process.cwd(), action.file);

  if (await fileExists(filePath)) {
    log('warning', `${action.file} already exists, skipping`);
    return;
  }

  await writeTextFile(filePath, action.content);

  // Make the hook executable (on Unix-like systems)
  if (process.platform !== 'win32') {
    try {
      const { chmod } = await import('fs/promises');
      await chmod(filePath, '755');
    } catch {
      log(
        'warning',
        'Could not make pre-commit hook executable - you may need to run: chmod +x .husky/pre-commit'
      );
    }
  }
}
