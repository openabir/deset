/**
 * Secure Error Handling Module
 * Prevents information disclosure and provides safe error reporting
 */

import crypto from 'crypto';
import { logError } from '../utils.js';

/**
 * Custom error class for security-related errors
 */
export class SecurityError extends Error {
  constructor(message, code, context = {}) {
    super(message);
    this.name = 'SecurityError';
    this.code = code;
    this.context = context;
    this.timestamp = new Date().toISOString();
    this.errorId = generateErrorId();
  }
}

/**
 * Custom error class for validation errors
 */
export class ValidationError extends Error {
  constructor(message, field, value) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    this.sanitizedValue = sanitizeForLogging(value);
    this.timestamp = new Date().toISOString();
  }
}

/**
 * Generate a unique error ID for tracking
 */
function generateErrorId() {
  return crypto.randomBytes(8).toString('hex');
}

/**
 * Sanitize values for safe logging (remove sensitive data)
 */
function sanitizeForLogging(value) {
  if (typeof value !== 'string') {
    return '[non-string value]';
  }

  // Remove potential sensitive patterns
  return value
    .replace(/password[=:]\s*[^\s&]+/gi, 'password=***')
    .replace(/token[=:]\s*[^\s&]+/gi, 'token=***')
    .replace(/api[_-]?key[=:]\s*[^\s&]+/gi, 'api_key=***')
    .replace(/secret[=:]\s*[^\s&]+/gi, 'secret=***')
    .substring(0, 200); // Limit length
}

/**
 * Secure error handler that prevents information disclosure
 */
export function handleSecureError(error, context = {}) {
  const isDevelopment = process.env.NODE_ENV === 'development' || process.env.DEBUG;

  // Log full error details for development/debugging
  if (isDevelopment) {
    console.error('🔒 Security Error Details:');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    console.error('Context:', context);
  }

  // Determine error severity and response
  let userMessage;
  let shouldExit = false;

  if (error instanceof SecurityError) {
    switch (error.code) {
      case 'COMMAND_INJECTION':
        userMessage = 'Invalid command detected. Operation blocked for security.';
        shouldExit = true;
        break;
      case 'PATH_TRAVERSAL':
        userMessage = 'Invalid file path detected. Operation blocked for security.';
        shouldExit = true;
        break;
      case 'MALICIOUS_INPUT':
        userMessage = 'Suspicious input detected. Operation blocked for security.';
        shouldExit = true;
        break;
      case 'RATE_LIMIT':
        userMessage = 'Too many requests. Please wait before trying again.';
        break;
      default:
        userMessage = 'Security validation failed. Please check your input.';
    }

    logError(userMessage, {
      suggestion: 'Review your command and try again with valid input',
      errorId: error.errorId,
    });
  } else if (error instanceof ValidationError) {
    userMessage = `Invalid input for ${error.field}. Please check the format and try again.`;
    logError(userMessage, {
      suggestion: 'Ensure all inputs follow the expected format',
      field: error.field,
    });
  } else {
    // Generic error handling
    userMessage = 'An unexpected error occurred. Please try again.';
    const errorId = generateErrorId();

    logError(userMessage, {
      suggestion: 'If the problem persists, please report this issue',
      errorId,
    });

    // Log detailed error for investigation (but don't show to user)
    if (isDevelopment) {
      console.error(`Error ID ${errorId}:`, error);
    }
  }

  if (shouldExit) {
    process.exit(1);
  }

  return {
    userMessage,
    errorId: error.errorId || generateErrorId(),
    handled: true,
  };
}

/**
 * Wrap async functions with secure error handling
 */
export function withSecureErrorHandling(fn, context = {}) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      return handleSecureError(error, { ...context, function: fn.name });
    }
  };
}

/**
 * Create standardized security errors
 */
export const createSecurityError = {
  commandInjection: (command) =>
    new SecurityError('Command injection attempt detected', 'COMMAND_INJECTION', {
      command: sanitizeForLogging(command),
    }),

  pathTraversal: (path) =>
    new SecurityError('Path traversal attempt detected', 'PATH_TRAVERSAL', {
      path: sanitizeForLogging(path),
    }),

  maliciousInput: (input, type) =>
    new SecurityError('Malicious input pattern detected', 'MALICIOUS_INPUT', {
      inputType: type,
      pattern: sanitizeForLogging(input),
    }),

  rateLimit: (identifier) =>
    new SecurityError('Rate limit exceeded', 'RATE_LIMIT', {
      identifier: sanitizeForLogging(identifier),
    }),

  invalidPackageName: (name) =>
    new ValidationError('Invalid package name format', 'packageName', name),

  invalidFilePath: (path) => new ValidationError('Invalid file path format', 'filePath', path),
};

/**
 * Security event logger for monitoring
 */
export class SecurityEventLogger {
  constructor() {
    this.events = [];
  }

  logEvent(type, details) {
    const event = {
      timestamp: new Date().toISOString(),
      type,
      details: sanitizeForLogging(JSON.stringify(details)),
      severity: this.getSeverity(type),
    };

    this.events.push(event);

    // In production, you might want to send these to a monitoring service
    if (process.env.NODE_ENV === 'production') {
      this.sendToMonitoring(event);
    }
  }

  getSeverity(type) {
    const severityMap = {
      command_injection: 'CRITICAL',
      path_traversal: 'HIGH',
      malicious_input: 'HIGH',
      rate_limit: 'MEDIUM',
      validation_error: 'LOW',
    };

    return severityMap[type] || 'MEDIUM';
  }

  sendToMonitoring(event) {
    // Placeholder for monitoring service integration
    console.log(`[SECURITY EVENT] ${event.type}: ${event.details}`);
  }

  getEvents() {
    return [...this.events];
  }

  clearEvents() {
    this.events = [];
  }
}

// Global security event logger instance
export const securityLogger = new SecurityEventLogger();
