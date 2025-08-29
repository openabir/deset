/**
 * @fileoverview Tests for error handling utilities
 */

import { jest } from '@jest/globals';

const originalEnv = process.env.NODE_ENV;
const originalVersion = process.version;

const {
  ERROR_TYPES,
  handleCommandError,
  validateEnvironment,
  validateOptions,
  createError,
  withErrorHandling,
} = await import('../src/error-handler.js');

describe('error-handler', () => {
  let consoleSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    process.env.NODE_ENV = originalEnv;
    // Reset process.version if it was modified
    Object.defineProperty(process, 'version', {
      value: originalVersion,
      writable: true,
    });
  });

  describe('ERROR_TYPES', () => {
    it('should export all error types', () => {
      expect(ERROR_TYPES.VALIDATION).toBe('validation');
      expect(ERROR_TYPES.SYSTEM).toBe('system');
      expect(ERROR_TYPES.CONFIG).toBe('config');
      expect(ERROR_TYPES.COMMAND).toBe('command');
      expect(ERROR_TYPES.NETWORK).toBe('network');
      expect(ERROR_TYPES.PERMISSION).toBe('permission');
    });
  });

  describe('handleCommandError', () => {
    it('should handle basic error without specific pattern', () => {
      const error = new Error('Generic error message');

      handleCommandError(error, 'test-command');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('✗ Command failed:'),
        expect.stringContaining('test-command')
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error:'),
        'Generic error message'
      );
    });

    it('should handle ENOENT error with package.json path', () => {
      const error = new Error('File not found');
      error.code = 'ENOENT';
      error.path = '/path/to/package.json';

      handleCommandError(error, 'init');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('✗ Command failed:'),
        expect.stringContaining('init')
      );
    });

    it('should handle EACCES permission error', () => {
      const error = new Error('Permission denied');
      error.code = 'EACCES';

      handleCommandError(error, 'install');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('✗ Command failed:'),
        expect.stringContaining('install')
      );
    });

    it('should handle ENOTDIR error', () => {
      const error = new Error('Not a directory');
      error.code = 'ENOTDIR';

      handleCommandError(error, 'check');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('✗ Command failed:'),
        expect.stringContaining('check')
      );
    });

    it('should handle fetch errors', () => {
      const error = new Error('fetch failed due to network');

      handleCommandError(error, 'check');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('✗ Command failed:'),
        expect.stringContaining('check')
      );
    });

    it('should handle npm audit errors', () => {
      const error = new Error('npm audit security scan failed');

      handleCommandError(error, 'check');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('✗ Command failed:'),
        expect.stringContaining('check')
      );
    });

    it('should handle command-specific errors for init command', () => {
      const error = new Error('package.json not found in directory');

      handleCommandError(error, 'init');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('✗ Command failed:'),
        expect.stringContaining('init')
      );
    });

    it('should handle command-specific errors for check command', () => {
      const error = new Error('No package.json found in current directory');

      handleCommandError(error, 'check');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('✗ Command failed:'),
        expect.stringContaining('check')
      );
    });

    it('should handle command-specific errors for config command', () => {
      const error = new Error('Configuration file corrupted or invalid');

      handleCommandError(error, 'config');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('✗ Command failed:'),
        expect.stringContaining('config')
      );
    });

    it('should show debug info in development mode', () => {
      process.env.NODE_ENV = 'development';
      const error = new Error('Test error');
      error.stack = 'Error: Test error\n    at test (/path/to/test.js:1:1)';

      handleCommandError(error, 'test');

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Stack trace:'));
      // Check that some part of the stack trace was logged
      const stackCalls = consoleErrorSpy.mock.calls.filter((call) =>
        call.some((arg) => typeof arg === 'string' && arg.includes('test.js'))
      );
      expect(stackCalls.length).toBeGreaterThan(0);
    });

    it('should not show debug info in production mode', () => {
      process.env.NODE_ENV = 'production';
      const error = new Error('Test error');
      error.stack = 'Error: Test error\n    at test (/path/to/test.js:1:1)';

      handleCommandError(error, 'test');

      expect(consoleErrorSpy).not.toHaveBeenCalledWith(expect.stringContaining('Stack trace:'));
    });

    it('should show help information', () => {
      const error = new Error('Test error');

      handleCommandError(error, 'test-command');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Need help?'),
        expect.anything(),
        expect.stringContaining('deset test-command --help'),
        expect.anything()
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Still stuck?'),
        expect.stringContaining('https://github.com/openabir/oas-deset/issues')
      );
    });

    it('should handle errors with custom error codes', () => {
      const error = new Error('Module not found');
      error.code = 'MODULE_NOT_FOUND';

      handleCommandError(error, 'install');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('✗ Command failed:'),
        expect.stringContaining('install')
      );
    });

    it('should handle errors with error names', () => {
      const error = new Error('Invalid argument type');
      error.name = 'ERR_INVALID_ARG_TYPE';

      handleCommandError(error, 'command');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('✗ Command failed:'),
        expect.stringContaining('command')
      );
    });
  });

  describe('validateEnvironment', () => {
    beforeEach(() => {
      // Reset any process modifications
      jest.resetModules();
    });

    it('should validate successful environment', async () => {
      // Mock Node.js version check
      Object.defineProperty(process, 'version', {
        value: 'v18.0.0',
        writable: true,
      });

      // Mock execSync to succeed
      jest.unstable_mockModule('child_process', () => ({
        execSync: jest.fn(() => '8.0.0'),
      }));

      // Mock fs access to succeed
      jest.unstable_mockModule('fs/promises', () => ({
        access: jest.fn().mockResolvedValue(),
        constants: { W_OK: 2 },
      }));

      const issues = await validateEnvironment();

      expect(issues).toEqual([]);
    });

    it('should detect Node.js version issues', async () => {
      // Mock old Node.js version
      Object.defineProperty(process, 'version', {
        value: 'v14.0.0',
        writable: true,
      });

      // Mock execSync to succeed for npm
      jest.unstable_mockModule('child_process', () => ({
        execSync: jest.fn(() => '8.0.0'),
      }));

      // Mock fs access to succeed
      jest.unstable_mockModule('fs/promises', () => ({
        access: jest.fn().mockResolvedValue(),
        constants: { W_OK: 2 },
      }));

      const issues = await validateEnvironment();

      expect(issues).toHaveLength(1);
      expect(issues[0].type).toBe('error');
      expect(issues[0].message).toContain('Node.js 16.0.0+ is required');
    });

    it('should detect npm availability issues', async () => {
      // Mock Node.js version check to pass
      Object.defineProperty(process, 'version', {
        value: 'v18.0.0',
        writable: true,
      });

      // Mock execSync to fail for npm
      jest.unstable_mockModule('child_process', () => ({
        execSync: jest.fn(() => {
          throw new Error('npm not found');
        }),
      }));

      // Mock fs access to succeed
      jest.unstable_mockModule('fs/promises', () => ({
        access: jest.fn().mockResolvedValue(),
        constants: { W_OK: 2 },
      }));

      const issues = await validateEnvironment();

      expect(issues).toHaveLength(1);
      expect(issues[0].type).toBe('error');
      expect(issues[0].message).toContain('npm is not available');
    });

    it('should detect write permission issues', async () => {
      // Mock Node.js version check to pass
      Object.defineProperty(process, 'version', {
        value: 'v18.0.0',
        writable: true,
      });

      // Mock execSync to succeed for npm
      jest.unstable_mockModule('child_process', () => ({
        execSync: jest.fn(() => '8.0.0'),
      }));

      // Mock fs access to fail
      jest.unstable_mockModule('fs/promises', () => ({
        access: jest.fn().mockRejectedValue(new Error('Permission denied')),
        constants: { W_OK: 2 },
      }));

      const issues = await validateEnvironment();

      expect(issues).toHaveLength(1);
      expect(issues[0].type).toBe('warning');
      expect(issues[0].message).toContain('not writable');
    });

    it('should detect multiple issues', async () => {
      // Mock old Node.js version
      Object.defineProperty(process, 'version', {
        value: 'v12.0.0',
        writable: true,
      });

      // Mock execSync to fail for npm
      jest.unstable_mockModule('child_process', () => ({
        execSync: jest.fn(() => {
          throw new Error('npm not found');
        }),
      }));

      // Mock fs access to fail
      jest.unstable_mockModule('fs/promises', () => ({
        access: jest.fn().mockRejectedValue(new Error('Permission denied')),
        constants: { W_OK: 2 },
      }));

      const issues = await validateEnvironment();

      expect(issues).toHaveLength(3);
      expect(issues[0].type).toBe('error');
      expect(issues[1].type).toBe('error');
      expect(issues[2].type).toBe('warning');
    });
  });

  describe('validateOptions', () => {
    it('should pass validation with valid options', () => {
      const options = {
        name: 'test',
        count: 5,
        format: 'json',
      };

      const schema = {
        required: ['name'],
        types: { count: 'number', name: 'string' },
        enum: { format: ['json', 'text'] },
      };

      const errors = validateOptions(options, schema);

      expect(errors).toEqual([]);
    });

    it('should detect missing required fields', () => {
      const options = {
        count: 5,
      };

      const schema = {
        required: ['name', 'type'],
        types: { count: 'number' },
      };

      const errors = validateOptions(options, schema);

      expect(errors).toHaveLength(2);
      expect(errors[0].field).toBe('name');
      expect(errors[0].code).toBe('MISSING_REQUIRED_OPTION');
      expect(errors[1].field).toBe('type');
      expect(errors[1].code).toBe('MISSING_REQUIRED_OPTION');
    });

    it('should detect invalid types', () => {
      const options = {
        name: 'test',
        count: 'five', // should be number
        enabled: 'yes', // should be boolean
      };

      const schema = {
        types: {
          count: 'number',
          name: 'string',
          enabled: 'boolean',
        },
      };

      const errors = validateOptions(options, schema);

      expect(errors).toHaveLength(2);
      expect(errors[0].field).toBe('count');
      expect(errors[0].code).toBe('INVALID_OPTION_TYPE');
      expect(errors[1].field).toBe('enabled');
      expect(errors[1].code).toBe('INVALID_OPTION_TYPE');
    });

    it('should detect invalid enum values', () => {
      const options = {
        format: 'xml', // should be json or text
        level: 'extreme', // should be low, medium, high
      };

      const schema = {
        enum: {
          format: ['json', 'text'],
          level: ['low', 'medium', 'high'],
        },
      };

      const errors = validateOptions(options, schema);

      expect(errors).toHaveLength(2);
      expect(errors[0].field).toBe('format');
      expect(errors[0].code).toBe('INVALID_OPTION_VALUE');
      expect(errors[1].field).toBe('level');
      expect(errors[1].code).toBe('INVALID_OPTION_VALUE');
    });

    it('should handle undefined options gracefully', () => {
      const options = {
        name: 'test',
        // count is missing, not set to undefined
      };

      const schema = {
        required: ['name'],
        types: { count: 'number' },
      };

      const errors = validateOptions(options, schema);

      expect(errors).toEqual([]);
    });

    it('should handle empty schema', () => {
      const options = { anything: 'goes' };
      const schema = {};

      const errors = validateOptions(options, schema);

      expect(errors).toEqual([]);
    });

    it('should handle complex validation scenarios', () => {
      const options = {
        name: 'test',
        count: 'invalid',
        format: 'invalid',
        missing: undefined,
      };

      const schema = {
        required: ['name', 'missing'],
        types: { count: 'number', name: 'string' },
        enum: { format: ['json', 'text'] },
      };

      const errors = validateOptions(options, schema);

      expect(errors).toHaveLength(3);
      expect(errors.map((e) => e.code)).toContain('MISSING_REQUIRED_OPTION');
      expect(errors.map((e) => e.code)).toContain('INVALID_OPTION_TYPE');
      expect(errors.map((e) => e.code)).toContain('INVALID_OPTION_VALUE');
    });
  });

  describe('createError', () => {
    it('should create error with suggestion and code', () => {
      const error = createError(
        'Something went wrong',
        'Try running the command again',
        'TEST_ERROR'
      );

      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Something went wrong');
      expect(error.suggestion).toBe('Try running the command again');
      expect(error.code).toBe('TEST_ERROR');
    });

    it('should create error with minimal parameters', () => {
      const error = createError('Basic error');

      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Basic error');
      expect(error.suggestion).toBeUndefined();
      expect(error.code).toBeUndefined();
    });
  });

  describe('withErrorHandling', () => {
    it('should wrap successful async function', async () => {
      const successFn = async (x, y) => x + y;
      const wrappedFn = withErrorHandling(successFn, 'test-context');

      const result = await wrappedFn(2, 3);

      expect(result).toBe(5);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should handle errors from wrapped function', async () => {
      const errorFn = async () => {
        throw new Error('Function failed');
      };
      const wrappedFn = withErrorHandling(errorFn, 'test-context');

      await expect(wrappedFn()).rejects.toThrow('Function failed');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error in test-context:'),
        'Function failed'
      );
    });

    it('should show suggestion if error has one', async () => {
      const errorFn = async () => {
        const error = new Error('Function failed');
        error.suggestion = 'Try a different approach';
        throw error;
      };
      const wrappedFn = withErrorHandling(errorFn, 'test-context');

      await expect(wrappedFn()).rejects.toThrow('Function failed');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error in test-context:'),
        'Function failed'
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Suggestion:'),
        'Try a different approach'
      );
    });

    it('should preserve function arguments', async () => {
      let receivedArgs;
      const testFn = async (...args) => {
        receivedArgs = args;
        return 'success';
      };
      const wrappedFn = withErrorHandling(testFn, 'test-context');

      await wrappedFn('arg1', 42, { key: 'value' });

      expect(receivedArgs).toEqual(['arg1', 42, { key: 'value' }]);
    });

    it('should handle sync functions that return promises', async () => {
      const promiseFn = () => Promise.resolve('async result');
      const wrappedFn = withErrorHandling(promiseFn, 'test-context');

      const result = await wrappedFn();

      expect(result).toBe('async result');
    });
  });

  describe('isVersionSupported (internal function behavior)', () => {
    it('should handle version checks correctly through validateEnvironment', async () => {
      // Test with supported version
      Object.defineProperty(process, 'version', {
        value: 'v16.0.0',
        writable: true,
      });

      jest.unstable_mockModule('child_process', () => ({
        execSync: jest.fn(() => '8.0.0'),
      }));

      jest.unstable_mockModule('fs/promises', () => ({
        access: jest.fn().mockResolvedValue(),
        constants: { W_OK: 2 },
      }));

      const issues = await validateEnvironment();
      const nodeIssues = issues.filter((issue) => issue.message.includes('Node.js'));

      expect(nodeIssues).toHaveLength(0);
    });

    it('should detect version requirements through validateEnvironment', async () => {
      // Test with exact minimum version
      Object.defineProperty(process, 'version', {
        value: 'v16.0.0',
        writable: true,
      });

      jest.unstable_mockModule('child_process', () => ({
        execSync: jest.fn(() => '8.0.0'),
      }));

      jest.unstable_mockModule('fs/promises', () => ({
        access: jest.fn().mockResolvedValue(),
        constants: { W_OK: 2 },
      }));

      const issues = await validateEnvironment();
      const nodeIssues = issues.filter((issue) => issue.message.includes('Node.js'));

      expect(nodeIssues).toHaveLength(0);
    });
  });
});
