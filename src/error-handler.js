 
import chalk from 'chalk';
import { logError } from './utils.js';

// Error types and their handling
export const ERROR_TYPES = {
  VALIDATION: 'validation',
  SYSTEM: 'system',
  CONFIG: 'config',
  COMMAND: 'command',
  NETWORK: 'network',
  PERMISSION: 'permission',
};

// Known error patterns and solutions
const ERROR_PATTERNS = {
  ENOENT: {
    type: ERROR_TYPES.SYSTEM,
    suggestion: 'File or directory not found. Check the path and ensure the file exists.',
    docs: 'https://nodejs.org/api/errors.html#errors_common_system_errors',
  },
  EACCES: {
    type: ERROR_TYPES.PERMISSION,
    suggestion: 'Permission denied. Check file permissions or run with appropriate privileges.',
    docs: 'https://nodejs.org/api/errors.html#errors_common_system_errors',
  },
  EEXIST: {
    type: ERROR_TYPES.SYSTEM,
    suggestion: 'File already exists. Use --force flag to overwrite or choose a different path.',
    docs: 'https://nodejs.org/api/errors.html#errors_common_system_errors',
  },
  MODULE_NOT_FOUND: {
    type: ERROR_TYPES.SYSTEM,
    suggestion: 'Required module not found. Run "npm install" to install dependencies.',
    docs: 'https://nodejs.org/api/modules.html#modules_module_not_found',
  },
  ERR_INVALID_ARG_TYPE: {
    type: ERROR_TYPES.VALIDATION,
    suggestion: 'Invalid argument type provided. Check the command syntax and argument types.',
    docs: 'https://nodejs.org/api/errors.html#errors_err_invalid_arg_type',
  },
};

// Command-specific error handling
const COMMAND_ERRORS = {
  init: {
    'package.json not found': {
      suggestion: 'Initialize npm first with "npm init" or run from a project directory.',
      fix: 'npm init -y',
    },
    'Git not initialized': {
      suggestion: 'Initialize git repository first.',
      fix: 'git init',
    },
    'Node.js version incompatible': {
      suggestion: 'Update Node.js to version 16.x or higher.',
      fix: 'Visit https://nodejs.org to download the latest version',
    },
  },
  check: {
    'No package.json found': {
      suggestion: 'Run this command from a Node.js project directory.',
      fix: 'cd to your project directory or run "npm init"',
    },
    'npm audit failed': {
      suggestion: 'Network issue or npm registry unavailable.',
      fix: 'Check internet connection or try again later',
    },
    'Dependencies not installed': {
      suggestion: 'Install project dependencies first.',
      fix: 'npm install',
    },
  },
  config: {
    'Configuration file corrupted': {
      suggestion: 'Reset configuration to defaults.',
      fix: 'devset config --reset',
    },
    'Invalid JSON in config': {
      suggestion: 'Fix JSON syntax errors in configuration file.',
      fix: 'Use a JSON validator to check syntax',
    },
  },
};

/**
 * Enhanced error handler for CLI commands
 * @param {Error} error - The error object
 * @param {string} context - Context where error occurred
 */
export function handleCommandError(error, context = 'command') {
  const errorCode = error.code || error.name || 'UNKNOWN_ERROR';
  const errorMessage = error.message || 'An unknown error occurred';

  console.error(chalk.red('✗ Command failed:'), chalk.bold(context));
  console.error(chalk.red('  Error:'), errorMessage);

  // Handle specific error patterns
  if (error.code === 'ENOENT' && error.path?.includes('package.json')) {
    logError(error, {
      suggestion: 'Make sure you are in a Node.js project directory with a package.json file',
      command: 'npm init',
      docs: 'https://docs.npmjs.com/creating-a-package-json-file',
      recoverable: true,
    });
  } else if (error.code === 'EACCES') {
    logError(error, {
      suggestion: 'Check file permissions or try running with appropriate privileges',
      command: process.platform === 'win32' ? 'Run as Administrator' : 'sudo chmod +w .',
      docs: 'https://docs.npmjs.com/resolving-eacces-permissions-errors-when-installing-packages-globally',
    });
  } else if (error.code === 'ENOTDIR') {
    logError(error, {
      suggestion: 'The path you specified is not a directory',
      command: 'pwd && ls -la',
      recoverable: true,
    });
  } else if (error.message.includes('fetch')) {
    logError(error, {
      suggestion: 'Check your internet connection and npm registry access',
      command: 'npm ping',
      docs: 'https://docs.npmjs.com/cli/v8/commands/npm-ping',
    });
  } else if (error.message.includes('npm audit')) {
    logError(error, {
      suggestion: 'Try running npm audit manually to see detailed security information',
      command: 'npm audit --audit-level=moderate',
      docs: 'https://docs.npmjs.com/cli/v8/commands/npm-audit',
    });
  } else {
    // Look for known error patterns
    const pattern = Object.keys(ERROR_PATTERNS).find(
      (key) => errorCode.includes(key) || errorMessage.includes(key)
    );

    if (pattern) {
      const info = ERROR_PATTERNS[pattern];
      console.error(chalk.yellow('  Suggestion:'), info.suggestion);
      console.error(chalk.blue('  Docs:'), info.docs);
    }

    // Look for command-specific errors
    const commandErrors = COMMAND_ERRORS[context];
    if (commandErrors) {
      const specificError = Object.keys(commandErrors).find((key) =>
        errorMessage.toLowerCase().includes(key.toLowerCase())
      );

      if (specificError) {
        const info = commandErrors[specificError];
        console.error(chalk.yellow('  Suggestion:'), info.suggestion);
        console.error(chalk.green('  Fix:'), info.fix);
      }
    }

    if (!pattern && !commandErrors) {
      logError(error, {
        suggestion: `An unexpected error occurred in ${context}. Please check the error details above.`,
        docs: 'https://github.com/openabir/oas-devset/issues',
      });
    }
  }

  // Show debug info in development
  if (process.env.NODE_ENV === 'development') {
    console.error(chalk.gray('  Stack trace:'));
    console.error(chalk.gray(error.stack));
  }

  // Show help for recovery
  console.error(
    chalk.cyan('  Need help?'),
    'Run',
    chalk.bold(`devset ${context} --help`),
    'for usage information'
  );
  console.error(
    chalk.cyan('  Still stuck?'),
    'Visit https://github.com/openabir/oas-devset/issues for support'
  );
}

/**
 * Validate environment before running commands
 */
export async function validateEnvironment() {
  const issues = [];

  // Check Node.js version
  const nodeVersion = process.version;
  const requiredVersion = '16.0.0';
  if (!isVersionSupported(nodeVersion, requiredVersion)) {
    issues.push({
      type: 'error',
      message: `Node.js ${requiredVersion}+ is required. Current version: ${nodeVersion}`,
      fix: 'Install a newer version of Node.js from https://nodejs.org',
    });
  }

  // Check if npm is available
  try {
    const { execSync } = await import('child_process');
    execSync('npm --version', { stdio: 'ignore' });
  } catch {
    issues.push({
      type: 'error',
      message: 'npm is not available in PATH',
      fix: 'Install npm or add it to your PATH environment variable',
    });
  }

  // Check write permissions
  try {
    const fs = await import('fs/promises');
    await fs.access(process.cwd(), fs.constants.W_OK);
  } catch {
    issues.push({
      type: 'warning',
      message: 'Current directory is not writable',
      fix: 'Navigate to a directory where you have write permissions',
    });
  }

  return issues;
}

/**
 * Check if current version meets minimum requirement
 */
function isVersionSupported(current, required) {
  const currentParts = current.replace('v', '').split('.').map(Number);
  const requiredParts = required.split('.').map(Number);

  for (let i = 0; i < 3; i++) {
    if (currentParts[i] > requiredParts[i]) return true;
    if (currentParts[i] < requiredParts[i]) return false;
  }
  return true;
}

/**
 * Validates command options and arguments
 * @param {Object} options - Command options to validate
 * @param {Object} schema - Validation schema
 * @returns {Array} Array of validation errors
 */
export function validateOptions(options, schema) {
  const errors = [];

  if (schema.required) {
    schema.required.forEach((field) => {
      if (!(field in options) || options[field] === undefined) {
        errors.push({
          field,
          message: `Required option --${field} is missing`,
          code: 'MISSING_REQUIRED_OPTION',
        });
      }
    });
  }

  if (schema.types) {
    Object.entries(schema.types).forEach(([field, expectedType]) => {
      if (field in options && typeof options[field] !== expectedType) {
        errors.push({
          field,
          message: `Option --${field} must be of type ${expectedType}`,
          code: 'INVALID_OPTION_TYPE',
        });
      }
    });
  }

  if (schema.enum) {
    Object.entries(schema.enum).forEach(([field, allowedValues]) => {
      if (field in options && !allowedValues.includes(options[field])) {
        errors.push({
          field,
          message: `Option --${field} must be one of: ${allowedValues.join(', ')}`,
          code: 'INVALID_OPTION_VALUE',
        });
      }
    });
  }

  return errors;
}

/**
 * Creates a user-friendly error with suggestions
 * @param {string} message - Error message
 * @param {string} suggestion - Suggestion for fixing the error
 * @param {string} code - Error code
 * @returns {Error} Enhanced error object
 */
export function createError(message, suggestion, code) {
  const error = new Error(message);
  error.suggestion = suggestion;
  error.code = code;
  return error;
}

/**
 * Wraps async functions with error handling
 * @param {Function} fn - Function to wrap
 * @param {string} context - Context for error reporting
 * @returns {Function} Wrapped function
 */
export function withErrorHandling(fn, context) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      console.error(chalk.red(`Error in ${context}:`), error.message);
      if (error.suggestion) {
        console.error(chalk.yellow('Suggestion:'), error.suggestion);
      }
      throw error;
    }
  };
}
