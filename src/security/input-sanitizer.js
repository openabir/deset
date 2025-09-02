/**
 * Input sanitization and validation utilities
 * Prevents injection attacks and validates user inputs
 */

import { createHash } from 'crypto';
import path from 'path';
import { URL } from 'url';

/**
 * Sanitize package names to prevent SSRF and injection attacks
 * @param {string} packageName - Raw package name input
 * @returns {string} Sanitized package name
 * @throws {Error} If package name is invalid
 */
export function sanitizePackageName(packageName) {
  if (typeof packageName !== 'string') {
    throw new Error('Package name must be a string');
  }

  // Trim whitespace
  const trimmed = packageName.trim();

  // Check length constraints (npm package name limits)
  if (trimmed.length === 0) {
    throw new Error('Package name cannot be empty');
  }
  if (trimmed.length > 214) {
    throw new Error('Package name too long (max 214 characters)');
  }

  // Check for dangerous patterns first
  const dangerousPatterns = [
    '|',
    ';',
    '&',
    '&&',
    '||',
    '$',
    '`',
    '$(',
    '${',
    '../',
    '..\\',
    '/./',
    '\\.\\',
    '//',
    '\\\\',
    'file://',
    'http://',
    'https://',
    'ftp://',
    'data:',
    'curl',
    'wget',
    'bash',
    'powershell',
    'base64',
    'whoami',
    'rm ',
    'del ',
    'format',
  ];

  // Separate check for shell-related patterns that need word boundaries
  const shellPatterns = ['\\bsh\\b', '\\bcmd\\b'];

  for (const pattern of dangerousPatterns) {
    if (trimmed.toLowerCase().includes(pattern.toLowerCase())) {
      throw new Error(`Dangerous pattern detected: ${pattern}`);
    }
  }

  for (const pattern of shellPatterns) {
    const regex = new RegExp(pattern, 'i');
    if (regex.test(trimmed)) {
      throw new Error(
        `Dangerous pattern detected: ${pattern.replace('\\\\b', '').replace('\\\\b', '')}`
      );
    }
  }

  // Validate against npm package name rules
  const validNamePattern = /^(?:@[a-z0-9-*~][a-z0-9-*._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;
  if (!validNamePattern.test(trimmed)) {
    throw new Error('Invalid package name format');
  }

  // Additional security: ensure it doesn't start with suspicious prefixes
  const suspiciousPrefixes = ['node_modules', '.git', '.env', 'etc/', 'usr/', 'var/', 'tmp/'];
  for (const prefix of suspiciousPrefixes) {
    if (trimmed.toLowerCase().startsWith(prefix)) {
      throw new Error(`Package name cannot start with: ${prefix}`);
    }
  }

  return trimmed;
}

/**
 * Sanitize file paths to prevent path traversal attacks
 * @param {string} filePath - Raw file path input
 * @param {string} baseDir - Base directory to restrict access to
 * @returns {string} Sanitized absolute path
 * @throws {Error} If path is invalid or dangerous
 */
export function sanitizeFilePath(filePath, baseDir = process.cwd()) {
  if (typeof filePath !== 'string') {
    throw new Error('File path must be a string');
  }

  const trimmed = filePath.trim();

  if (trimmed.length === 0) {
    throw new Error('File path cannot be empty');
  }

  // Prevent excessively long paths
  if (trimmed.length > 260) {
    throw new Error('File path too long (max 260 characters)');
  }

  // Normalize and resolve path
  const resolved = path.resolve(baseDir, trimmed);
  const normalizedBase = path.resolve(baseDir);

  // Ensure the resolved path is within the base directory
  if (!resolved.startsWith(normalizedBase + path.sep) && resolved !== normalizedBase) {
    throw new Error(`File path outside allowed directory: ${trimmed}`);
  }

  // Prevent access to sensitive files and directories
  const forbiddenPatterns = [
    /node_modules/i,
    /\.git(?![/\\]workflows)/i, // Allow .github/workflows but not .git
    /\.env$/i,
    /\.ssh/i,
    /\.aws/i,
    /\.docker/i,
    /[/\\]etc[/\\]/i,
    /[/\\]usr[/\\]bin/i,
    /[/\\]var[/\\]log/i,
    /[/\\]tmp[/\\]/i,
    /\.\.[/\\]\.\./,
  ];

  for (const pattern of forbiddenPatterns) {
    if (pattern.test(resolved)) {
      throw new Error(`Access to forbidden path: ${trimmed}`);
    }
  }

  // Validate file extension if provided
  const ext = path.extname(resolved).toLowerCase();
  const allowedExtensions = [
    '.js',
    '.json',
    '.md',
    '.txt',
    '.yml',
    '.yaml',
    '.ts',
    '.jsx',
    '.tsx',
    '.css',
    '.html',
    '.xml',
    '.gitignore',
    '.eslintrc',
    '.prettierrc',
  ];

  if (ext && !allowedExtensions.includes(ext) && !ext.startsWith('.')) {
    throw new Error(`File extension not allowed: ${ext}`);
  }

  return resolved;
}

/**
 * Sanitize shell command arguments
 * @param {string|string[]} args - Command arguments
 * @returns {string[]} Sanitized arguments array
 * @throws {Error} If arguments contain dangerous patterns
 */
export function sanitizeCommandArgs(args) {
  const argsArray = Array.isArray(args) ? args : [args];

  return argsArray.map((arg) => {
    if (typeof arg !== 'string') {
      throw new Error('Command argument must be a string');
    }

    const trimmed = arg.trim();

    // Check for command injection patterns
    const dangerousPatterns = [
      ';',
      '|',
      '&',
      '&&',
      '||',
      '`',
      '$(',
      '$()',
      '${',
      '>',
      '>>',
      '<',
      '<<',
      '\n',
      '\r',
      '\t',
      '\\',
      'rm ',
      'del ',
      'format ',
      'mkfs',
      'dd ',
      'wget ',
      'curl ',
      'nc ',
      'netcat',
      'telnet',
      'ssh',
      'ftp',
      '..',
      '~',
      '/etc/',
      '/tmp/',
      'eval',
      'exec',
      'system',
    ];

    for (const pattern of dangerousPatterns) {
      if (trimmed.toLowerCase().includes(pattern.toLowerCase())) {
        throw new Error(`Dangerous pattern detected in command argument: ${pattern}`);
      }
    }

    // Ensure reasonable length
    if (trimmed.length > 1000) {
      throw new Error('Command argument too long');
    }

    return trimmed;
  });
}

/**
 * Generate a secure hash for error tracking
 * @param {string} input - Input to hash
 * @returns {string} Secure hash
 */
export function generateSecureHash(input) {
  return createHash('sha256')
    .update(input + Date.now())
    .digest('hex')
    .substring(0, 8);
}

/**
 * Validate URL for safe external requests
 * @param {string} url - URL to validate
 * @returns {URL} Validated URL object
 * @throws {Error} If URL is invalid or dangerous
 */
export function validateUrl(url) {
  if (typeof url !== 'string') {
    throw new Error('URL must be a string');
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error('Invalid URL format');
  }

  // Only allow HTTPS for external requests
  if (parsedUrl.protocol !== 'https:') {
    throw new Error('Only HTTPS URLs are allowed');
  }

  // Whitelist allowed domains for API calls
  const allowedDomains = ['registry.npmjs.org', 'api.github.com', 'raw.githubusercontent.com'];

  if (!allowedDomains.includes(parsedUrl.hostname)) {
    throw new Error(`Domain not in whitelist: ${parsedUrl.hostname}`);
  }

  // Prevent access to private IP ranges
  const hostname = parsedUrl.hostname;
  const privateIpPatterns = [
    /^127\./, // Loopback
    /^10\./, // Private Class A
    /^172\.(1[6-9]|2\d|3[01])\./, // Private Class B
    /^192\.168\./, // Private Class C
    /^169\.254\./, // Link-local
    /^::1$/, // IPv6 loopback
    /^fc00::/, // IPv6 private
    /^fe80::/, // IPv6 link-local
  ];

  for (const pattern of privateIpPatterns) {
    if (pattern.test(hostname)) {
      throw new Error('Access to private IP ranges not allowed');
    }
  }

  return parsedUrl;
}

/**
 * Rate limiter for API calls
 */
export class RateLimiter {
  constructor(maxRequests = 10, windowMs = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requests = new Map();
  }

  /**
   * Check if request is allowed under rate limit
   * @param {string} identifier - Unique identifier for the request source
   * @returns {boolean} True if request is allowed
   */
  isAllowed(identifier = 'global') {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Clean old entries
    for (const [key, timestamps] of this.requests.entries()) {
      const validTimestamps = timestamps.filter((ts) => ts > windowStart);
      if (validTimestamps.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, validTimestamps);
      }
    }

    // Check current request count
    const currentRequests = this.requests.get(identifier) || [];
    const validRequests = currentRequests.filter((ts) => ts > windowStart);

    if (validRequests.length >= this.maxRequests) {
      return false;
    }

    // Add current request
    validRequests.push(now);
    this.requests.set(identifier, validRequests);
    return true;
  }

  /**
   * Get time until next allowed request
   * @param {string} identifier - Unique identifier for the request source
   * @returns {number} Milliseconds until next request is allowed
   */
  getTimeUntilReset(identifier = 'global') {
    const requests = this.requests.get(identifier) || [];
    if (requests.length === 0) return 0;

    const oldestRequest = Math.min(...requests);
    const resetTime = oldestRequest + this.windowMs;
    return Math.max(0, resetTime - Date.now());
  }
}
