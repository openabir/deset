/**
 * Secure command execution utilities
 * Prevents command injection and implements secure subprocess handling
 */

import { spawn } from 'child_process';
import { sanitizeCommandArgs } from './input-sanitizer.js';

/**
 * Default timeout for command execution (30 seconds)
 */
const DEFAULT_TIMEOUT = 30000;

/**
 * Maximum allowed command output size (1MB)
 */
const MAX_OUTPUT_SIZE = 1024 * 1024;

/**
 * Whitelist of allowed commands
 */
const ALLOWED_COMMANDS = new Set(['npm', 'node', 'git', 'yarn', 'pnpm']);

/**
 * Secure command execution with input validation and injection prevention
 * @param {string} command - Command to execute
 * @param {string[]} args - Command arguments
 * @param {Object} options - Execution options
 * @param {number} options.timeout - Timeout in milliseconds
 * @param {string} options.cwd - Working directory
 * @param {boolean} options.silent - Suppress output
 * @returns {Promise<{stdout: string, stderr: string, exitCode: number}>}
 * @throws {Error} If command is not allowed or execution fails
 */
export async function execSecure(command, args = [], options = {}) {
  // Validate command
  if (typeof command !== 'string' || !command.trim()) {
    throw new Error('Command must be a non-empty string');
  }

  const sanitizedCommand = command.trim();

  // Check if command is in whitelist
  if (!ALLOWED_COMMANDS.has(sanitizedCommand)) {
    throw new Error(`Command not allowed: ${sanitizedCommand}`);
  }

  // Sanitize arguments
  let sanitizedArgs;
  try {
    sanitizedArgs = sanitizeCommandArgs(args);
  } catch (error) {
    throw new Error(`Invalid command arguments: ${error.message}`);
  }

  // Set up options with security defaults
  const secureOptions = {
    timeout: options.timeout || DEFAULT_TIMEOUT,
    cwd: options.cwd || process.cwd(),
    silent: options.silent || false,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32', // Use shell on Windows for .cmd files
    windowsHide: true, // Hide on Windows
    env: {
      ...process.env,
      NODE_ENV: process.env.NODE_ENV || 'production',
      // Remove potentially dangerous environment variables
      LD_PRELOAD: undefined,
      LD_LIBRARY_PATH: undefined,
    },
  };

  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let outputSize = 0;
    let timedOut = false;

    // Spawn the process
    const child = spawn(sanitizedCommand, sanitizedArgs, secureOptions);

    // Set up timeout
    const timeoutId = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');

      // Force kill after 5 seconds if process doesn't respond
      setTimeout(() => {
        if (!child.killed) {
          child.kill('SIGKILL');
        }
      }, 5000);
    }, secureOptions.timeout);

    // Handle stdout
    child.stdout?.on('data', (data) => {
      const chunk = data.toString();
      outputSize += chunk.length;

      if (outputSize > MAX_OUTPUT_SIZE) {
        child.kill('SIGTERM');
        reject(new Error('Command output too large (max 1MB)'));
        return;
      }

      stdout += chunk;
    });

    // Handle stderr
    child.stderr?.on('data', (data) => {
      const chunk = data.toString();
      outputSize += chunk.length;

      if (outputSize > MAX_OUTPUT_SIZE) {
        child.kill('SIGTERM');
        reject(new Error('Command output too large (max 1MB)'));
        return;
      }

      stderr += chunk;
    });

    // Handle process completion
    child.on('close', (exitCode, signal) => {
      clearTimeout(timeoutId);

      if (timedOut) {
        reject(new Error(`Command timed out after ${secureOptions.timeout}ms`));
        return;
      }

      if (signal) {
        reject(new Error(`Command killed with signal: ${signal}`));
        return;
      }

      resolve({
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: exitCode || 0,
      });
    });

    // Handle errors
    child.on('error', (error) => {
      clearTimeout(timeoutId);
      reject(new Error(`Command execution failed: ${error.message}`));
    });
  });
}

/**
 * Execute npm commands securely
 * @param {string[]} args - npm command arguments
 * @param {Object} options - Execution options
 * @returns {Promise<{stdout: string, stderr: string, exitCode: number}>}
 */
export async function execNpm(args, options = {}) {
  // Add security flags to npm commands
  const secureArgs = [
    ...args,
    '--no-fund', // Don't show funding messages
    '--no-audit', // Skip audit for this execution (we handle it separately)
    '--prefer-offline', // Prefer cached packages
    '--progress=false', // Disable progress output
  ];

  return execSecure('npm', secureArgs, options);
}

/**
 * Execute git commands securely
 * @param {string[]} args - git command arguments
 * @param {Object} options - Execution options
 * @returns {Promise<{stdout: string, stderr: string, exitCode: number}>}
 */
export async function execGit(args, options = {}) {
  // Validate git arguments for safety
  const dangerousGitArgs = [
    'push',
    'pull',
    'clone',
    'remote',
    'submodule',
    'config',
    'hook',
    'filter-branch',
    'rebase',
    'reset',
    '--hard',
  ];

  const argsString = args.join(' ').toLowerCase();
  for (const dangerous of dangerousGitArgs) {
    if (argsString.includes(dangerous)) {
      throw new Error(`Git command not allowed for security reasons: ${dangerous}`);
    }
  }

  return execSecure('git', args, options);
}

/**
 * Execute node commands securely
 * @param {string[]} args - node command arguments
 * @param {Object} options - Execution options
 * @returns {Promise<{stdout: string, stderr: string, exitCode: number}>}
 */
export async function execNode(args, options = {}) {
  // Add security flags to node commands
  const secureArgs = [
    '--no-warnings', // Suppress warnings
    '--max-old-space-size=512', // Limit memory usage
    ...args,
  ];

  return execSecure('node', secureArgs, options);
}

/**
 * Command execution with retry logic
 * @param {Function} commandFn - Function that returns a promise for command execution
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} baseDelay - Base delay between retries in milliseconds
 * @returns {Promise<any>} Command result
 */
export async function execWithRetry(commandFn, maxRetries = 3, baseDelay = 1000) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await commandFn();
    } catch (error) {
      lastError = error;

      // Don't retry on certain types of errors
      if (
        error.message.includes('not allowed') ||
        error.message.includes('timeout') ||
        error.message.includes('too large')
      ) {
        throw error;
      }

      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

/**
 * Batch command execution with concurrency control
 * @param {Array} commands - Array of command functions
 * @param {number} maxConcurrency - Maximum concurrent executions
 * @returns {Promise<Array>} Array of results
 */
export async function execBatch(commands, maxConcurrency = 3) {
  const results = [];
  const executing = [];

  for (const commandFn of commands) {
    const promise = commandFn().then((result) => {
      const index = executing.indexOf(promise);
      if (index > -1) {
        executing.splice(index, 1);
      }
      return result;
    });

    results.push(promise);
    executing.push(promise);

    if (executing.length >= maxConcurrency) {
      await Promise.race(executing);
    }
  }

  return Promise.allSettled(results);
}
