import path from 'path';
import chalk from 'chalk';
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
        console.log(chalk.cyan('Dry run - planned actions:'));
        actions.forEach((action) => {
          console.log(chalk.gray('-'), action.name);
          if (action.file) {
            console.log(chalk.gray('  File:'), action.file);
          }
        });
      }
      return;
    }

    // Execute actions
    for (const action of actions) {
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

    // Output results
    if (options.format === 'json') {
      console.log(formatOutput(results, 'json'));
    } else {
      console.log(
        chalk.green(`\n✓ Initialization complete! ${results.success.length} actions completed.`)
      );
      if (results.warnings.length > 0) {
        console.log(chalk.yellow(`⚠ ${results.warnings.length} warnings`));
      }
      if (results.errors.length > 0) {
        console.log(chalk.red(`✗ ${results.errors.length} errors`));
        process.exit(1);
      }
    }
  } catch (error) {
    log('error', `Initialization failed: ${error.message}`);
    process.exit(1);
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

  if (!packageJson['lint-staged']) {
    packageJson['lint-staged'] = {
      '*.{js,jsx,ts,tsx}': ['eslint --fix', 'prettier --write'],
      '*.{json,css,md}': ['prettier --write'],
    };

    await writePackageJson(packageJson);
  } else {
    log('warning', 'lint-staged already configured in package.json');
  }
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
    } catch (error) {
      log('warning', 'Could not make pre-commit hook executable');
    }
  }
}
