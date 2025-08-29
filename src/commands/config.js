import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import { askYesNo, askMultipleChoice, fileExists, logError, ProgressIndicator } from '../utils.js';

/**
 * Interactive configuration wizard
 * @param {Object} options - Command options
 */
export async function configCommand(options) {
  try {
    console.log(chalk.blue.bold('\n🔧 @oas/devset Configuration Wizard\n'));
    console.log('This wizard will help you set up a custom configuration for your project.\n');

    if (options.reset) {
      await resetConfiguration();
      return;
    }

    // Check if config already exists
    const configPath = path.join(process.cwd(), 'devenv.config.json');
    const configExists = await fileExists(configPath);

    if (configExists) {
      const overwrite = await askYesNo(
        'A devenv.config.json file already exists. Do you want to overwrite it?'
      );
      if (!overwrite) {
        console.log(chalk.yellow('Configuration wizard cancelled.'));
        return;
      }
    }

    // Start configuration wizard
    const config = await runConfigurationWizard();

    // Save configuration
    const saveProgress = new ProgressIndicator('Saving configuration');
    saveProgress.start();

    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');

    saveProgress.complete('Configuration saved');

    console.log(chalk.green('\n✓ Configuration wizard completed!'));
    console.log(chalk.blue('📄 Configuration saved to:'), chalk.bold('devenv.config.json'));
    console.log(
      chalk.blue('🚀 You can now run:'),
      chalk.bold('devset init'),
      'or',
      chalk.bold('devset check')
    );
  } catch (error) {
    logError(error, {
      suggestion: 'Make sure you have write permissions in the current directory',
      command: 'ls -la devenv.config.json',
      docs: 'https://nodejs.org/api/fs.html#fs_file_system',
    });
    process.exit(1);
  }
}

/**
 * Run the interactive configuration wizard
 * @returns {Promise<Object>} Configuration object
 */
async function runConfigurationWizard() {
  console.log(chalk.cyan('📋 Project Setup Features\n'));

  // ESLint configuration
  const eslint = await askYesNo('Do you want to set up ESLint for code linting?');

  // Prettier configuration
  const prettier = await askYesNo('Do you want to set up Prettier for code formatting?');

  // Husky configuration
  const husky = await askYesNo('Do you want to set up Git hooks with Husky?');

  // lint-staged configuration
  let lintStaged = false;
  if (husky) {
    lintStaged = await askYesNo('Do you want to set up lint-staged for pre-commit checks?');
  }

  // Dependabot configuration
  const dependabot = await askYesNo(
    'Do you want to set up Dependabot for automated dependency updates?'
  );

  console.log(chalk.cyan('\n🔍 Health Check Features\n'));

  // Audit configuration
  const audit = await askYesNo('Do you want to enable security audit checks?');

  // Stale package check configuration
  const staleCheck = await askYesNo('Do you want to enable stale package detection?');

  console.log(chalk.cyan('\n⚙️ General Settings\n'));

  // Interactive mode configuration
  const interactive = await askYesNo('Do you want to enable interactive prompts by default?');

  // Default output format
  const outputFormat = await askMultipleChoice('What should be the default output format?', [
    { name: 'text', description: 'Human-readable text output (recommended)' },
    { name: 'json', description: 'JSON output for programmatic use' },
  ]);

  // Advanced configuration options
  console.log(chalk.cyan('\n🔧 Advanced Options\n'));

  const advancedConfig = await askYesNo('Do you want to configure advanced options?');

  let advanced = {};
  if (advancedConfig) {
    // CI/CD mode
    const ciMode = await askYesNo('Will this primarily be used in CI/CD environments?');

    // Strictness level
    const strictness = await askMultipleChoice('What level of strictness do you prefer?', [
      { name: 'relaxed', description: 'Lenient - warnings for most issues' },
      { name: 'balanced', description: 'Balanced - errors for critical issues only' },
      { name: 'strict', description: 'Strict - errors for all issues' },
    ]);

    advanced = {
      ciMode,
      strictness,
      exitOnWarnings: strictness === 'strict',
    };
  }

  // Build configuration object
  const config = {
    version: '1.0.0',
    features: {
      eslint,
      prettier,
      husky,
      lintStaged,
      dependabot,
      audit,
      staleCheck,
      interactive,
    },
    defaults: {
      outputFormat: outputFormat.name,
    },
    ...advanced,
  };

  // Show configuration preview
  console.log(chalk.cyan('\n📋 Configuration Preview:\n'));
  console.log(JSON.stringify(config, null, 2));
  console.log('');

  const confirm = await askYesNo('Does this configuration look correct?');
  if (!confirm) {
    console.log(chalk.yellow('Configuration cancelled. You can run the wizard again.'));
    process.exit(0);
  }

  return config;
}

/**
 * Reset configuration to defaults
 */
async function resetConfiguration() {
  const configPath = path.join(process.cwd(), 'devenv.config.json');
  const configExists = await fileExists(configPath);

  if (!configExists) {
    console.log(chalk.yellow('No configuration file found to reset.'));
    return;
  }

  const confirm = await askYesNo('Are you sure you want to reset the configuration to defaults?');

  if (confirm) {
    const resetProgress = new ProgressIndicator('Resetting configuration');
    resetProgress.start();

    // Default configuration
    const defaultConfig = {
      version: '1.0.0',
      features: {
        eslint: true,
        prettier: true,
        husky: true,
        lintStaged: true,
        dependabot: true,
        audit: true,
        staleCheck: true,
        interactive: true,
      },
      defaults: {
        outputFormat: 'text',
      },
    };

    await fs.writeFile(configPath, JSON.stringify(defaultConfig, null, 2), 'utf8');

    resetProgress.complete('Configuration reset to defaults');
    console.log(chalk.green('✓ Configuration has been reset to defaults.'));
  } else {
    console.log(chalk.yellow('Reset cancelled.'));
  }
}
