import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createInterface } from 'readline';
import chalk from 'chalk';

const execAsync = promisify(exec);

/**
 * Check if a file exists
 * @param {string} filePath - Path to the file
 * @returns {Promise<boolean>} True if file exists
 */
export async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Write a JSON file with pretty formatting
 * @param {string} filePath - Path to write the file
 * @param {Object} data - Data to write
 */
export async function writeJsonFile(filePath, data) {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2) + '\n');
}

/**
 * Write a text file
 * @param {string} filePath - Path to write the file
 * @param {string} content - Content to write
 */
export async function writeTextFile(filePath, content) {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(filePath, content);
}

/**
 * Read and parse package.json
 * @returns {Promise<Object>} Package.json content
 */
export async function readPackageJson() {
  try {
    const packagePath = path.join(process.cwd(), 'package.json');
    const content = await fs.readFile(packagePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    throw new Error(
      'Could not read package.json. Make sure you are in a Node.js project directory.'
    );
  }
}

/**
 * Write package.json with updated content
 * @param {Object} packageData - Updated package.json data
 */
export async function writePackageJson(packageData) {
  const packagePath = path.join(process.cwd(), 'package.json');
  await writeJsonFile(packagePath, packageData);
}

/**
 * Run a shell command and return the result
 * @param {string} command - Command to execute
 * @returns {Promise<{stdout: string, stderr: string}>} Command result
 */
export async function runCommand(command) {
  try {
    return await execAsync(command);
  } catch (error) {
    throw new Error(`Command failed: ${command}\n${error.message}`);
  }
}

/**
 * Get list of changed files via git diff
 * @returns {Promise<string[]>} Array of changed file paths
 */
export async function getChangedFiles() {
  try {
    const { stdout } = await execAsync('git diff --name-only HEAD');
    return stdout
      .trim()
      .split('\n')
      .filter((file) => file.length > 0);
  } catch (error) {
    console.warn(chalk.yellow('Warning: Could not get changed files via git diff'));
    return [];
  }
}

/**
 * Check if we're in a git repository
 * @returns {Promise<boolean>} True if in a git repo
 */
export async function isGitRepo() {
  try {
    await execAsync('git rev-parse --git-dir');
    return true;
  } catch {
    return false;
  }
}

/**
 * Log a message with appropriate styling
 * @param {string} level - Log level (success, warning, error, info)
 * @param {string} message - Message to log
 */
export function log(level, message) {
  switch (level) {
    case 'success':
      console.log(chalk.green('✓'), message);
      break;
    case 'warning':
      console.log(chalk.yellow('⚠'), message);
      break;
    case 'error':
      console.log(chalk.red('✗'), message);
      break;
    case 'info':
      console.log(chalk.blue('ℹ'), message);
      break;
    default:
      console.log(message);
  }
}

/**
 * Enhanced error logging with contextual suggestions and documentation links
 * @param {Error|string} error - Error object or message
 * @param {Object} context - Additional context for the error
 * @param {string} context.suggestion - Suggested solution
 * @param {string} context.docs - Documentation URL
 * @param {string} context.command - Suggested command to run
 * @param {boolean} context.recoverable - Whether the error is recoverable
 */
export function logError(error, context = {}) {
  const errorMessage = error instanceof Error ? error.message : error;

  console.error(chalk.red('✗ Error:'), errorMessage);

  if (context.suggestion) {
    console.error(chalk.yellow('💡 Suggestion:'), context.suggestion);
  }

  if (context.command) {
    console.error(chalk.cyan('🔧 Try running:'), chalk.bold(context.command));
  }

  if (context.docs) {
    console.error(chalk.blue('📖 Documentation:'), context.docs);
  }

  if (context.recoverable) {
    console.error(chalk.green('✓ This error can be fixed automatically'));
  }

  // Add spacing for readability
  console.error('');
}

/**
 * Progress indicator utilities
 */
export class ProgressIndicator {
  constructor(message, total = null, silent = false) {
    this.message = message;
    this.total = total;
    this.current = 0;
    this.startTime = Date.now();
    this.spinner = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    this.spinnerIndex = 0;
    this.interval = null;
    this.silent = silent;
  }

  start() {
    if (this.silent) return this;

    if (this.total) {
      process.stdout.write(`${this.message} [0/${this.total}] 0%`);
    } else {
      this.interval = setInterval(() => {
        process.stdout.write(`\r${this.spinner[this.spinnerIndex]} ${this.message}`);
        this.spinnerIndex = (this.spinnerIndex + 1) % this.spinner.length;
      }, 100);
    }
    return this;
  }

  update(current = null) {
    if (this.silent) return this;

    if (this.total && current !== null) {
      this.current = current;
      const percentage = Math.round((current / this.total) * 100);
      const bar =
        '█'.repeat(Math.floor(percentage / 5)) + '░'.repeat(20 - Math.floor(percentage / 5));
      process.stdout.write(`\r${this.message} [${current}/${this.total}] ${percentage}% ${bar}`);
    }
    return this;
  }

  complete(message = null) {
    if (this.interval) {
      clearInterval(this.interval);
    }
    if (this.silent) return this;

    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
    const finalMessage = message || 'Complete';
    process.stdout.write(`\r✓ ${finalMessage} (${elapsed}s)\n`);
    return this;
  }

  fail(message = null) {
    if (this.interval) {
      clearInterval(this.interval);
    }
    if (this.silent) return this;

    const finalMessage = message || 'Failed';
    process.stdout.write(`\r✗ ${finalMessage}\n`);
    return this;
  }
}

/**
 * Format output based on requested format
 * @param {Object} data - Data to format
 * @param {string} format - Format type ('json' or 'text')
 * @returns {string} Formatted output
 */
export function formatOutput(data, format) {
  if (format === 'json') {
    return JSON.stringify(data, null, 2);
  }
  return data;
}

/**
 * Create a readline interface for user prompts
 * @returns {Object} Readline interface
 */
function createReadlineInterface() {
  return createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

/**
 * Ask user a yes/no question
 * @param {string} question - Question to ask
 * @returns {Promise<boolean>} True if user answers yes
 */
export async function askYesNo(question) {
  const rl = createReadlineInterface();

  return new Promise((resolve) => {
    rl.question(chalk.cyan(`${question} (y/n): `), (answer) => {
      rl.close();
      resolve(answer.toLowerCase().trim() === 'y' || answer.toLowerCase().trim() === 'yes');
    });
  });
}

/**
 * Ask user to select from multiple options
 * @param {string} question - Question to ask
 * @param {string[]} options - Array of options
 * @returns {Promise<string[]>} Selected options
 */
export async function askMultipleChoice(question, options) {
  const rl = createReadlineInterface();

  console.log(chalk.cyan(question));
  options.forEach((option, index) => {
    console.log(chalk.gray(`${index + 1}. ${option}`));
  });
  console.log(
    chalk.gray('Enter numbers separated by commas (e.g., 1,3,5) or "all" for all packages:')
  );

  return new Promise((resolve) => {
    rl.question(chalk.cyan('Your choice: '), (answer) => {
      rl.close();

      const trimmedAnswer = answer.toLowerCase().trim();

      if (trimmedAnswer === 'all') {
        resolve(options);
        return;
      }

      const selectedIndices = trimmedAnswer
        .split(',')
        .map((s) => parseInt(s.trim()) - 1)
        .filter((i) => i >= 0 && i < options.length);

      const selectedOptions = selectedIndices.map((i) => options[i]);
      resolve(selectedOptions);
    });
  });
}

/**
 * Update package versions in package.json
 * @param {string[]} packages - Array of package names to update
 * @param {Object} outdatedData - Outdated packages data
 * @returns {Promise<void>}
 */
export async function updatePackageVersions(packages, outdatedData) {
  const packageJson = await readPackageJson();
  let updated = false;

  for (const packageName of packages) {
    const packageInfo = outdatedData.find((pkg) => pkg.name === packageName);
    if (!packageInfo) continue;

    // Update in dependencies
    if (packageJson.dependencies && packageJson.dependencies[packageName]) {
      packageJson.dependencies[packageName] = `^${packageInfo.latest}`;
      updated = true;
      log('success', `Updated ${packageName}: ${packageInfo.current} → ${packageInfo.latest}`);
    }

    // Update in devDependencies
    if (packageJson.devDependencies && packageJson.devDependencies[packageName]) {
      packageJson.devDependencies[packageName] = `^${packageInfo.latest}`;
      updated = true;
      log('success', `Updated ${packageName}: ${packageInfo.current} → ${packageInfo.latest}`);
    }
  }

  if (updated) {
    await writePackageJson(packageJson);
    log('info', 'Package.json has been updated. Run "npm install" to install the new versions.');
  }
}

/**
 * Install updated packages
 * @returns {Promise<void>}
 */
export async function installUpdatedPackages() {
  try {
    log('info', 'Installing updated packages...');
    const { stdout } = await execAsync('npm install');
    log('success', 'Packages installed successfully');
    if (stdout.trim()) {
      console.log(chalk.gray(stdout));
    }
  } catch (error) {
    log('error', `Failed to install packages: ${error.message}`);
    throw error;
  }
}

/**
 * Update configuration files to industry standards
 * @param {string[]} updatedPackages - Array of updated package names
 * @returns {Promise<void>}
 */
export async function updateConfigFiles(updatedPackages) {
  const configUpdates = [];

  // Check if ESLint was updated
  if (updatedPackages.includes('eslint')) {
    const eslintConfig = await getIndustryStandardEslintConfig();
    await updateEslintConfig(eslintConfig);
    configUpdates.push('ESLint configuration');
  }

  // Check if Jest was updated
  if (updatedPackages.includes('jest')) {
    const jestConfig = await getIndustryStandardJestConfig();
    await updateJestConfig(jestConfig);
    configUpdates.push('Jest configuration');
  }

  // Check if Prettier was updated
  if (updatedPackages.includes('prettier')) {
    const prettierConfig = await getIndustryStandardPrettierConfig();
    await updatePrettierConfig(prettierConfig);
    configUpdates.push('Prettier configuration');
  }

  if (configUpdates.length > 0) {
    log('success', `Updated configuration files: ${configUpdates.join(', ')}`);
  }
}

/**
 * Get industry standard ESLint configuration
 * @returns {Object} ESLint configuration
 */
async function getIndustryStandardEslintConfig() {
  // Check ESLint version to determine appropriate config
  const packageJson = await readPackageJson();
  const eslintVersion = packageJson.devDependencies?.eslint || packageJson.dependencies?.eslint;

  if (eslintVersion && eslintVersion.includes('9.')) {
    // ESLint 9.x flat config
    return {
      extends: ['eslint:recommended'],
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
        'prefer-const': 'error',
        'no-var': 'error',
      },
    };
  } else {
    // ESLint 8.x config
    return {
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
        'prefer-const': 'error',
        'no-var': 'error',
      },
    };
  }
}

/**
 * Get industry standard Jest configuration
 * @returns {Object} Jest configuration
 */
async function getIndustryStandardJestConfig() {
  return {
    testEnvironment: 'node',
    collectCoverageFrom: ['src/**/*.js', '!src/**/*.test.js'],
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov'],
    testMatch: ['**/__tests__/**/*.js', '**/?(*.)+(spec|test).js'],
  };
}

/**
 * Get industry standard Prettier configuration
 * @returns {Object} Prettier configuration
 */
async function getIndustryStandardPrettierConfig() {
  return {
    semi: true,
    singleQuote: true,
    tabWidth: 2,
    trailingComma: 'es5',
    printWidth: 100,
    bracketSpacing: true,
    arrowParens: 'avoid',
  };
}

/**
 * Update ESLint configuration file
 * @param {Object} config - ESLint configuration
 * @returns {Promise<void>}
 */
async function updateEslintConfig(config) {
  const eslintPath = path.join(process.cwd(), '.eslintrc.json');
  if (await fileExists(eslintPath)) {
    await writeJsonFile(eslintPath, config);
    log('info', 'Updated .eslintrc.json to industry standards');
  }
}

/**
 * Update Jest configuration in package.json
 * @param {Object} config - Jest configuration
 * @returns {Promise<void>}
 */
async function updateJestConfig(config) {
  const packageJson = await readPackageJson();
  if (packageJson.jest) {
    packageJson.jest = { ...packageJson.jest, ...config };
    await writePackageJson(packageJson);
    log('info', 'Updated Jest configuration in package.json to industry standards');
  }
}

/**
 * Update Prettier configuration file
 * @param {Object} config - Prettier configuration
 * @returns {Promise<void>}
 */
async function updatePrettierConfig(config) {
  const prettierPath = path.join(process.cwd(), '.prettierrc');
  if (await fileExists(prettierPath)) {
    await writeJsonFile(prettierPath, config);
    log('info', 'Updated .prettierrc to industry standards');
  }
}

/**
 * Package alternative recommendations database
 */
const PACKAGE_ALTERNATIVES = {
  // Testing frameworks
  mocha: [
    {
      name: 'jest',
      description: 'Zero-config testing framework with built-in assertions and coverage',
    },
    { name: 'vitest', description: 'Fast unit test framework powered by Vite' },
    { name: 'tap', description: 'Test Anything Protocol library for Node.js' },
    { name: 'ava', description: 'Minimal and fast test runner' },
    { name: 'jasmine', description: 'Behavior-driven development framework' },
  ],
  karma: [
    {
      name: 'jest',
      description: 'Modern testing framework with built-in browser testing via jsdom',
    },
    { name: 'vitest', description: 'Next generation testing framework' },
    { name: 'web-test-runner', description: 'Test runner for web applications' },
    { name: 'cypress', description: 'End-to-end testing framework' },
    { name: 'playwright', description: 'Cross-browser end-to-end testing' },
  ],

  // Build tools
  gulp: [
    { name: 'vite', description: 'Next generation frontend build tool' },
    { name: 'webpack', description: 'Module bundler for modern JavaScript applications' },
    { name: 'rollup', description: 'Module bundler optimized for libraries' },
    { name: 'parcel', description: 'Zero-configuration build tool' },
    { name: 'esbuild', description: 'Extremely fast JavaScript bundler' },
  ],
  grunt: [
    { name: 'npm-scripts', description: 'Use package.json scripts for build tasks' },
    { name: 'vite', description: 'Modern build tool with hot reload' },
    { name: 'webpack', description: 'Powerful module bundler' },
    { name: 'rollup', description: 'Tree-shaking bundler' },
    { name: 'just', description: 'Task runner and build tool' },
  ],

  // Utility libraries
  lodash: [
    { name: 'ramda', description: 'Functional programming utility library' },
    { name: 'rambda', description: 'Lightweight alternative to Ramda' },
    { name: 'underscore', description: 'Utility belt library' },
    { name: 'native-methods', description: 'Use native JavaScript methods instead' },
    { name: 'just', description: 'Collection of dependency-free utilities' },
  ],
  moment: [
    { name: 'dayjs', description: 'Lightweight alternative to Moment.js' },
    { name: 'date-fns', description: 'Modern date utility library' },
    { name: 'luxon', description: 'DateTime library by Moment.js team' },
    { name: 'js-joda', description: 'Immutable date and time API' },
    { name: 'native-date', description: 'Use native JavaScript Date API' },
  ],

  // HTTP clients
  request: [
    { name: 'axios', description: 'Promise-based HTTP client' },
    { name: 'node-fetch', description: 'Fetch API for Node.js' },
    { name: 'got', description: 'Human-friendly HTTP request library' },
    { name: 'ky', description: 'Tiny HTTP client based on Fetch API' },
    { name: 'superagent', description: 'Small progressive client-side HTTP request library' },
  ],

  // Linting
  jshint: [
    { name: 'eslint', description: 'Pluggable JavaScript linter' },
    { name: '@typescript-eslint/eslint-plugin', description: 'ESLint plugin for TypeScript' },
    { name: 'standard', description: 'JavaScript Standard Style linter' },
    { name: 'xo', description: 'Opinionated but configurable ESLint wrapper' },
    { name: 'biome', description: 'Fast linter and formatter' },
  ],
  tslint: [
    { name: 'eslint', description: 'Use ESLint with TypeScript support' },
    { name: '@typescript-eslint/eslint-plugin', description: 'Official TypeScript ESLint plugin' },
    { name: 'biome', description: 'Fast TypeScript linter and formatter' },
    { name: 'rome', description: 'Unified developer tools (archived, use Biome)' },
    { name: 'dprint', description: 'Code formatter with TypeScript support' },
  ],
};

/**
 * Safe packages that are generally okay to keep even if stale
 */
const SAFE_STALE_PACKAGES = [
  'core-js',
  'polyfill',
  'shim',
  'ponyfill', // Polyfills
  'typescript',
  '@types/', // Type definitions
  'jquery',
  'bootstrap',
  'foundation', // Mature UI libraries
  'react',
  'vue',
  'angular', // Major frameworks (stable versions)
  'express',
  'koa',
  'fastify', // Stable server frameworks
  'lodash',
  'underscore', // Stable utility libraries
  'debug',
  'chalk',
  'colors', // Stable utility packages
];

/**
 * Analyze stale packages and categorize them
 * @param {Array} stalePackages - Array of stale package objects
 * @returns {Promise<Object>} Analysis results with recommendations
 */
export async function analyzeStalePackages(stalePackages) {
  const analysis = {
    safe: [],
    needsAttention: [],
    critical: [],
    alternatives: {},
  };

  for (const pkg of stalePackages) {
    const packageInfo = await getDetailedPackageInfo(pkg.name);
    const isSafe = isSafeStalePackage(pkg.name);
    const alternatives = getPackageAlternatives(pkg.name);

    const analyzedPackage = {
      ...pkg,
      ...packageInfo,
      isSafe,
      alternatives: alternatives.length > 0,
    };

    if (alternatives.length > 0) {
      analysis.alternatives[pkg.name] = alternatives;
    }

    if (isSafe) {
      analysis.safe.push(analyzedPackage);
    } else if (pkg.daysSince > 730) {
      // More than 2 years
      analysis.critical.push(analyzedPackage);
    } else {
      analysis.needsAttention.push(analyzedPackage);
    }
  }

  return analysis;
}

/**
 * Get detailed package information from npm registry
 * @param {string} packageName - Name of the package
 * @returns {Promise<Object>} Package details
 */
async function getDetailedPackageInfo(packageName) {
  try {
    const response = await fetch(`https://registry.npmjs.org/${packageName}`);
    if (!response.ok) {
      return { description: 'Unknown package', keywords: [], deprecated: false };
    }

    const data = await response.json();
    const latestVersion = data['dist-tags']?.latest;
    const versionInfo = data.versions?.[latestVersion] || {};

    return {
      description: data.description || versionInfo.description || 'No description available',
      keywords: data.keywords || versionInfo.keywords || [],
      deprecated: versionInfo.deprecated || false,
      repository: data.repository?.url || versionInfo.repository?.url,
      homepage: data.homepage || versionInfo.homepage,
      license: data.license || versionInfo.license,
      weeklyDownloads: 'Unknown',
    };
  } catch (error) {
    return {
      description: 'Error fetching package info',
      keywords: [],
      deprecated: false,
      error: error.message,
    };
  }
}

/**
 * Check if a package is generally safe to keep even when stale
 * @param {string} packageName - Name of the package
 * @returns {boolean} True if package is safe to keep
 */
function isSafeStalePackage(packageName) {
  return SAFE_STALE_PACKAGES.some(
    (safe) => packageName.includes(safe) || packageName.startsWith(safe)
  );
}

/**
 * Get alternative package recommendations
 * @param {string} packageName - Name of the package
 * @returns {Array} Array of alternative packages
 */
export function getPackageAlternatives(packageName) {
  return PACKAGE_ALTERNATIVES[packageName] || [];
}

/**
 * Ask user to select package alternatives
 * @param {string} packageName - Name of the stale package
 * @param {Array} alternatives - Array of alternative packages
 * @returns {Promise<string|null>} Selected alternative or null
 */
export async function selectPackageAlternative(packageName, alternatives) {
  console.log(chalk.cyan(`\nRecommended alternatives for ${chalk.bold(packageName)}:`));

  alternatives.forEach((alt, index) => {
    console.log(chalk.gray(`${index + 1}. ${chalk.bold(alt.name)} - ${alt.description}`));
  });

  console.log(chalk.gray(`${alternatives.length + 1}. Enter custom alternative`));
  console.log(chalk.gray(`${alternatives.length + 2}. Keep current package`));

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(
      chalk.cyan('Select an option (1-' + (alternatives.length + 2) + '): '),
      async (answer) => {
        const choice = parseInt(answer.trim());

        if (choice >= 1 && choice <= alternatives.length) {
          rl.close();
          resolve(alternatives[choice - 1].name);
        } else if (choice === alternatives.length + 1) {
          rl.question(chalk.cyan('Enter custom package name: '), (customName) => {
            rl.close();
            resolve(customName.trim() || null);
          });
        } else {
          rl.close();
          resolve(null); // Keep current package
        }
      }
    );
  });
}

/**
 * Replace stale package with alternative
 * @param {string} oldPackage - Name of package to replace
 * @param {string} newPackage - Name of replacement package
 * @param {boolean} isDev - Whether package is in devDependencies
 * @returns {Promise<void>}
 */
export async function replaceStalePackage(oldPackage, newPackage, isDev = false) {
  try {
    log('info', `Replacing ${oldPackage} with ${newPackage}...`);

    // Remove old package
    const removeCmd = `npm uninstall ${oldPackage}`;
    await execAsync(removeCmd);
    log('success', `Removed ${oldPackage}`);

    // Install new package
    const installCmd = `npm install ${isDev ? '--save-dev' : '--save'} ${newPackage}`;
    await execAsync(installCmd);
    log('success', `Installed ${newPackage}`);

    // Update package.json to remove any remaining references
    const packageJson = await readPackageJson();

    // Remove from dependencies
    if (packageJson.dependencies && packageJson.dependencies[oldPackage]) {
      delete packageJson.dependencies[oldPackage];
    }

    // Remove from devDependencies
    if (packageJson.devDependencies && packageJson.devDependencies[oldPackage]) {
      delete packageJson.devDependencies[oldPackage];
    }

    await writePackageJson(packageJson);

    log('info', `Successfully replaced ${oldPackage} with ${newPackage}`);
    log('warning', `Please update your code to use ${newPackage} instead of ${oldPackage}`);
  } catch (error) {
    log('error', `Failed to replace ${oldPackage}: ${error.message}`);
    throw error;
  }
}

/**
 * Handle interactive stale package management
 * @param {Object} staleAnalysis - Analysis results from analyzeStalePackages
 * @returns {Promise<void>}
 */
export async function handleStalePackageManagement(staleAnalysis) {
  if (staleAnalysis.critical.length === 0 && staleAnalysis.needsAttention.length === 0) {
    return;
  }

  console.log();
  const shouldManage = await askYesNo('Would you like to manage your stale packages?');

  if (!shouldManage) {
    return;
  }

  // Handle critical packages first
  for (const pkg of staleAnalysis.critical) {
    console.log(chalk.red(`\n🚨 Critical stale package: ${pkg.name}`));
    console.log(chalk.gray(`Last updated: ${Math.floor(pkg.daysSince / 365)} years ago`));
    console.log(chalk.gray(`Description: ${pkg.description}`));

    if (pkg.deprecated) {
      console.log(chalk.red('⚠️ This package is deprecated!'));
    }

    const alternatives = staleAnalysis.alternatives[pkg.name];
    if (alternatives && alternatives.length > 0) {
      const replacement = await selectPackageAlternative(pkg.name, alternatives);
      if (replacement) {
        const isDev = await isDevDependency(pkg.name);
        await replaceStalePackage(pkg.name, replacement, isDev);
      }
    } else {
      console.log(chalk.yellow('No automatic alternatives found for this package.'));
      const shouldReplace = await askYesNo('Would you like to manually specify a replacement?');
      if (shouldReplace) {
        const customReplacement = await askCustomReplacement();
        if (customReplacement) {
          const isDev = await isDevDependency(pkg.name);
          await replaceStalePackage(pkg.name, customReplacement, isDev);
        }
      }
    }
  }

  // Handle packages that need attention
  if (staleAnalysis.needsAttention.length > 0) {
    console.log(chalk.yellow('\n⚠️ Packages that need attention:'));
    for (const pkg of staleAnalysis.needsAttention) {
      console.log(chalk.gray(`- ${pkg.name} (${Math.floor(pkg.daysSince / 30)} months old)`));
    }

    const shouldManageWarnings = await askYesNo('Would you like to review these packages as well?');
    if (shouldManageWarnings) {
      for (const pkg of staleAnalysis.needsAttention) {
        const alternatives = staleAnalysis.alternatives[pkg.name];
        if (alternatives && alternatives.length > 0) {
          console.log(chalk.yellow(`\n⚠️ Package: ${pkg.name}`));
          const replacement = await selectPackageAlternative(pkg.name, alternatives);
          if (replacement) {
            const isDev = await isDevDependency(pkg.name);
            await replaceStalePackage(pkg.name, replacement, isDev);
          }
        }
      }
    }
  }
}

/**
 * Check if package is in devDependencies
 * @param {string} packageName - Name of the package
 * @returns {Promise<boolean>} True if in devDependencies
 */
async function isDevDependency(packageName) {
  const packageJson = await readPackageJson();
  return !!(packageJson.devDependencies && packageJson.devDependencies[packageName]);
}

/**
 * Ask user for custom replacement package
 * @returns {Promise<string|null>} Custom package name or null
 */
async function askCustomReplacement() {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(chalk.cyan('Enter replacement package name: '), (answer) => {
      rl.close();
      resolve(answer.trim() || null);
    });
  });
}
