/**
 * Input validation schemas and utilities
 * Provides comprehensive validation for all user inputs
 */

/**
 * Package name validation schema
 */
export const PACKAGE_NAME_SCHEMA = {
  type: 'string',
  minLength: 1,
  maxLength: 214,
  pattern: /^(?:@[a-z0-9-*~][a-z0-9-*._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/,
  description: 'Valid npm package name',
  examples: ['lodash', '@types/node', 'my-package'],
};

/**
 * File path validation schema
 */
export const FILE_PATH_SCHEMA = {
  type: 'string',
  minLength: 1,
  maxLength: 260,
  pattern: /^[a-zA-Z0-9._/-]+$/,
  description: 'Valid file path',
  examples: ['.eslintrc.json', 'src/index.js', '.github/workflows/ci.yml'],
  // Custom validation function
  customValidation: (value) => {
    // Check for path traversal
    if (value.includes('..')) {
      throw new Error('Path traversal not allowed');
    }
    // Check for forbidden paths
    const forbiddenPatterns = [/node_modules/i, /\/etc\//i, /\\windows\\/i];
    for (const pattern of forbiddenPatterns) {
      if (pattern.test(value)) {
        throw new Error('Access to forbidden path');
      }
    }
    return true;
  },
};

/**
 * URL validation schema
 */
export const URL_SCHEMA = {
  type: 'string',
  pattern: /^https:\/\/[a-zA-Z0-9.-]+[a-zA-Z0-9]+(\/[a-zA-Z0-9._~!$&'()*+,;=:@%/-]*)?$/,
  description: 'Valid HTTPS URL',
  examples: ['https://registry.npmjs.org', 'https://api.github.com'],
};

/**
 * Command argument validation schema
 */
export const COMMAND_ARG_SCHEMA = {
  type: 'string',
  maxLength: 1000,
  pattern: /^[a-zA-Z0-9._/-]+$/,
  description: 'Valid command argument',
  examples: ['--version', 'install', 'package-name'],
};

/**
 * Version string validation schema
 */
export const VERSION_SCHEMA = {
  type: 'string',
  pattern: /^\d+\.\d+\.\d+(?:-[a-zA-Z0-9-]+)?(?:\+[a-zA-Z0-9-]+)?$/,
  description: 'Valid semantic version',
  examples: ['1.0.0', '2.1.3-beta', '1.0.0+build.1'],
};

/**
 * Configuration object validation schema
 */
export const CONFIG_SCHEMA = {
  type: 'object',
  properties: {
    version: VERSION_SCHEMA,
    features: {
      type: 'object',
      properties: {
        eslint: { type: 'boolean' },
        prettier: { type: 'boolean' },
        husky: { type: 'boolean' },
        lintStaged: { type: 'boolean' },
        dependabot: { type: 'boolean' },
        audit: { type: 'boolean' },
        staleCheck: { type: 'boolean' },
        interactive: { type: 'boolean' },
      },
      additionalProperties: false,
    },
    defaults: {
      type: 'object',
      properties: {
        outputFormat: {
          type: 'string',
          enum: ['text', 'json'],
        },
      },
      additionalProperties: false,
    },
  },
  required: ['version', 'features'],
  additionalProperties: false,
};

/**
 * Validation error class
 */
export class ValidationError extends Error {
  constructor(message, field, value, schema) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    this.value = value;
    this.schema = schema;
  }
}

/**
 * Validate a value against a schema
 * @param {any} value - Value to validate
 * @param {Object} schema - Validation schema
 * @param {string} fieldName - Name of the field being validated
 * @returns {any} Validated value
 * @throws {ValidationError} If validation fails
 */
export function validateValue(value, schema, fieldName = 'value') {
  // Type validation
  if (schema.type) {
    const actualType = Array.isArray(value) ? 'array' : typeof value;
    if (actualType !== schema.type) {
      throw new ValidationError(
        `${fieldName} must be of type ${schema.type}, got ${actualType}`,
        fieldName,
        value,
        schema
      );
    }
  }

  // String validations
  if (schema.type === 'string' && typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      throw new ValidationError(
        `${fieldName} must be at least ${schema.minLength} characters long`,
        fieldName,
        value,
        schema
      );
    }

    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      throw new ValidationError(
        `${fieldName} must be at most ${schema.maxLength} characters long`,
        fieldName,
        value,
        schema
      );
    }

    if (schema.pattern && !schema.pattern.test(value)) {
      throw new ValidationError(
        `${fieldName} does not match the required pattern`,
        fieldName,
        value,
        schema
      );
    }
  }

  // Number validations
  if (schema.type === 'number' && typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) {
      throw new ValidationError(
        `${fieldName} must be at least ${schema.minimum}`,
        fieldName,
        value,
        schema
      );
    }

    if (schema.maximum !== undefined && value > schema.maximum) {
      throw new ValidationError(
        `${fieldName} must be at most ${schema.maximum}`,
        fieldName,
        value,
        schema
      );
    }
  }

  // Enum validation
  if (schema.enum && !schema.enum.includes(value)) {
    throw new ValidationError(
      `${fieldName} must be one of: ${schema.enum.join(', ')}`,
      fieldName,
      value,
      schema
    );
  }

  // Object validation
  if (schema.type === 'object' && typeof value === 'object' && value !== null) {
    // Required properties
    if (schema.required) {
      for (const requiredField of schema.required) {
        if (!(requiredField in value)) {
          throw new ValidationError(
            `Missing required property: ${requiredField}`,
            `${fieldName}.${requiredField}`,
            undefined,
            schema
          );
        }
      }
    }

    // Property validation
    if (schema.properties) {
      for (const [propName, propValue] of Object.entries(value)) {
        const propSchema = schema.properties[propName];
        if (propSchema) {
          validateValue(propValue, propSchema, `${fieldName}.${propName}`);
        } else if (!schema.additionalProperties) {
          throw new ValidationError(
            `Additional property not allowed: ${propName}`,
            `${fieldName}.${propName}`,
            propValue,
            schema
          );
        }
      }
    }
  }

  // Custom validation
  if (schema.customValidation && typeof schema.customValidation === 'function') {
    try {
      schema.customValidation(value);
    } catch (error) {
      throw new ValidationError(
        `${fieldName} failed custom validation: ${error.message}`,
        fieldName,
        value,
        schema
      );
    }
  }

  return value;
}

/**
 * Validate package name
 * @param {string} packageName - Package name to validate
 * @returns {string} Validated package name
 * @throws {ValidationError} If validation fails
 */
export function validatePackageName(packageName) {
  return validateValue(packageName, PACKAGE_NAME_SCHEMA, 'packageName');
}

/**
 * Validate file path
 * @param {string} filePath - File path to validate
 * @returns {string} Validated file path
 * @throws {ValidationError} If validation fails
 */
export function validateFilePath(filePath) {
  return validateValue(filePath, FILE_PATH_SCHEMA, 'filePath');
}

/**
 * Validate URL
 * @param {string} url - URL to validate
 * @returns {string} Validated URL
 * @throws {ValidationError} If validation fails
 */
export function validateUrlString(url) {
  return validateValue(url, URL_SCHEMA, 'url');
}

/**
 * Validate command argument
 * @param {string} arg - Command argument to validate
 * @returns {string} Validated argument
 * @throws {ValidationError} If validation fails
 */
export function validateCommandArg(arg) {
  return validateValue(arg, COMMAND_ARG_SCHEMA, 'commandArg');
}

/**
 * Validate version string
 * @param {string} version - Version string to validate
 * @returns {string} Validated version
 * @throws {ValidationError} If validation fails
 */
export function validateVersion(version) {
  return validateValue(version, VERSION_SCHEMA, 'version');
}

/**
 * Validate configuration object
 * @param {Object} config - Configuration object to validate
 * @returns {Object} Validated configuration
 * @throws {ValidationError} If validation fails
 */
export function validateConfig(config) {
  return validateValue(config, CONFIG_SCHEMA, 'config');
}

/**
 * Batch validation utility
 * @param {Array} validations - Array of validation functions
 * @returns {Array} Array of validation results
 * @throws {ValidationError} If any validation fails
 */
export function validateBatch(validations) {
  const results = [];
  const errors = [];

  for (const { value, schema, fieldName, validator } of validations) {
    try {
      if (validator) {
        results.push(validator(value));
      } else {
        results.push(validateValue(value, schema, fieldName));
      }
    } catch (error) {
      errors.push(error);
    }
  }

  if (errors.length > 0) {
    const message = `Validation failed for ${errors.length} field(s): ${errors.map((e) => e.field).join(', ')}`;
    const error = new ValidationError(message);
    error.errors = errors;
    throw error;
  }

  return results;
}

/**
 * Safe JSON parsing with validation
 * @param {string} jsonString - JSON string to parse
 * @param {Object} schema - Optional schema to validate against
 * @returns {any} Parsed and validated JSON
 * @throws {ValidationError} If parsing or validation fails
 */
export function parseAndValidateJson(jsonString, schema = null) {
  if (typeof jsonString !== 'string') {
    throw new ValidationError('Input must be a string', 'jsonString', jsonString);
  }

  let parsed;
  try {
    parsed = JSON.parse(jsonString);
  } catch (error) {
    throw new ValidationError(`Invalid JSON: ${error.message}`, 'jsonString', jsonString);
  }

  if (schema) {
    return validateValue(parsed, schema, 'parsedJson');
  }

  return parsed;
}

/**
 * Create a validation middleware for async functions
 * @param {Object} schemas - Object mapping parameter names to schemas
 * @returns {Function} Validation middleware
 */
export function createValidationMiddleware(schemas) {
  return function validationMiddleware(target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args) {
      const paramNames = originalMethod
        .toString()
        .match(/\(([^)]*)\)/)[1]
        .split(',')
        .map((param) => param.trim().split('=')[0].trim())
        .filter((param) => param.length > 0);

      // Validate each argument
      for (let i = 0; i < args.length; i++) {
        const paramName = paramNames[i];
        const schema = schemas[paramName];

        if (schema && args[i] !== undefined) {
          args[i] = validateValue(args[i], schema, paramName);
        }
      }

      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}
