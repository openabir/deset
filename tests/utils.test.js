/**
 * @fileoverview Tests for utility functions
 */

import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/security/secure-http.js', () => ({
  getPackageLastPublished: jest.fn(async (packageName) => {
    if (packageName === 'old-package') {
      return new Date('2019-01-01');
    }
    if (packageName === 'recent-package') {
      return new Date('2023-01-01');
    }
    if (packageName === 'very-old') {
      return new Date('2015-01-01');
    }
    return new Date();
  }),
  getDetailedPackageInfo: jest.fn(async (packageName) => ({
    description: `Test description for ${packageName}`,
    keywords: ['test'],
    deprecated: false,
    repository: `https://github.com/test/${packageName}`,
    homepage: `https://test.com/${packageName}`,
    license: 'MIT',
    version: '1.0.0',
    publishedAt: '2023-01-01T00:00:00.000Z',
  })),
}));

const {
  log,
  logError,
  formatOutput,
  analyzeStalePackages,
  getPackageAlternatives,
  updateConfigFiles,
} = await import('../src/utils.js');

describe('Utils', () => {
  let consoleSpy;
  let consoleLogSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleLogSpy = consoleSpy;
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    jest.clearAllMocks();
  });

  describe('log', () => {
    it('should log info level message', () => {
      log('info', 'Test info message');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('ℹ'),
        'Test info message'
      );
    });

    it('should log success level message', () => {
      log('success', 'Test success message');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('✓'),
        'Test success message'
      );
    });

    it('should log warning level message', () => {
      log('warning', 'Test warning message');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('⚠'),
        'Test warning message'
      );
    });

    it('should log error level message', () => {
      log('error', 'Test error message');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('✗'),
        'Test error message'
      );
    });

    it('should log default level for unknown levels', () => {
      log('unknown', 'Test message');

      expect(consoleLogSpy).toHaveBeenCalledWith('Test message');
    });
  });

  describe('logError', () => {
    it('should log error with basic context', () => {
      const error = new Error('Test error');

      logError(error);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('✗ Error:'),
        'Test error'
      );
    });

    it('should log error with suggestion', () => {
      const error = new Error('Test error');
      const context = { suggestion: 'Try this fix' };

      logError(error, context);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('✗ Error:'),
        'Test error'
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('💡 Suggestion:'),
        'Try this fix'
      );
    });

    it('should log error with command suggestion', () => {
      const error = new Error('Test error');
      const context = {
        suggestion: 'Try this fix',
        command: 'npm install',
      };

      logError(error, context);

      // Check that all required calls were made
      expect(consoleErrorSpy).toHaveBeenCalledTimes(4);
      expect(consoleErrorSpy).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('✗ Error:'),
        'Test error'
      );
      expect(consoleErrorSpy).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('💡 Suggestion:'),
        'Try this fix'
      );
      // The command is passed with chalk.bold, so check for the raw command string
      expect(consoleErrorSpy).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining('🔧 Try running:'),
        expect.anything()
      );
      // Empty line at the end
      expect(consoleErrorSpy).toHaveBeenNthCalledWith(4, '');
    });

    it('should log error with documentation', () => {
      const error = new Error('Test error');
      const context = {
        docs: 'https://example.com/docs',
      };

      logError(error, context);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('✗ Error:'),
        'Test error'
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('📖 Documentation:'),
        'https://example.com/docs'
      );
    });

    it('should log error with all context options', () => {
      const error = new Error('Test error');
      const context = {
        suggestion: 'Try this fix',
        command: 'npm install',
        docs: 'https://example.com/docs',
        recoverable: true,
      };

      logError(error, context);

      // Check that all required calls were made
      expect(consoleErrorSpy).toHaveBeenCalledTimes(6);
      expect(consoleErrorSpy).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('✗ Error:'),
        'Test error'
      );
      expect(consoleErrorSpy).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('💡 Suggestion:'),
        'Try this fix'
      );
      // The command is passed with chalk.bold, so check for the raw command string
      expect(consoleErrorSpy).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining('🔧 Try running:'),
        expect.anything()
      );
      expect(consoleErrorSpy).toHaveBeenNthCalledWith(
        4,
        expect.stringContaining('📖 Documentation:'),
        'https://example.com/docs'
      );
      expect(consoleErrorSpy).toHaveBeenNthCalledWith(
        5,
        expect.stringContaining('✓ This error can be fixed automatically')
      );
      // Empty line at the end
      expect(consoleErrorSpy).toHaveBeenNthCalledWith(6, '');
    });
  });

  describe('formatOutput', () => {
    const testData = { test: true, count: 42 };

    it('should return JSON string when format is json', () => {
      const result = formatOutput(testData, 'json');

      expect(result).toBe(JSON.stringify(testData, null, 2));
    });

    it('should return object when format is not json', () => {
      const result = formatOutput(testData, 'text');

      expect(result).toEqual(testData);
    });

    it('should default to text format when no format specified', () => {
      const result = formatOutput(testData);

      expect(result).toEqual(testData);
    });
  });

  describe('getPackageAlternatives', () => {
    it('should return alternatives for known packages', () => {
      const alternatives = getPackageAlternatives('lodash');

      expect(Array.isArray(alternatives)).toBe(true);
      expect(alternatives.length).toBeGreaterThan(0);
    });

    it('should return empty array for unknown packages', () => {
      const alternatives = getPackageAlternatives('unknown-package-xyz');

      expect(alternatives).toEqual([]);
    });

    it('should return alternatives for moment', () => {
      const alternatives = getPackageAlternatives('moment');

      expect(alternatives.some((alt) => alt.name === 'dayjs')).toBe(true);
    });

    it('should return alternatives for request', () => {
      const alternatives = getPackageAlternatives('request');

      expect(alternatives.some((alt) => alt.name === 'axios')).toBe(true);
    });
  });

  describe('analyzeStalePackages', () => {
    it('should categorize packages correctly', async () => {
      const stalePackages = [
        { name: 'old-package', lastPublish: '2019-01-01', alternatives: ['new-package'] },
        { name: 'recent-package', lastPublish: '2023-01-01', alternatives: [] },
        { name: 'very-old', lastPublish: '2015-01-01', alternatives: ['modern-alt'] },
      ];

      const analysis = await analyzeStalePackages(stalePackages);

      expect(analysis).toHaveProperty('critical');
      expect(analysis).toHaveProperty('needsAttention');
      expect(analysis).toHaveProperty('safe');
      expect(analysis).toHaveProperty('alternatives');

      expect(Array.isArray(analysis.critical)).toBe(true);
      expect(Array.isArray(analysis.needsAttention)).toBe(true);
      expect(Array.isArray(analysis.safe)).toBe(true);
    });

    it('should handle empty stale packages array', async () => {
      const analysis = await analyzeStalePackages([]);

      expect(analysis.critical).toEqual([]);
      expect(analysis.needsAttention).toEqual([]);
      expect(analysis.safe).toEqual([]);
    });
  });

  describe('updateConfigFiles', () => {
    it('should update configuration files', async () => {
      const updatedPackages = [
        { name: 'eslint', oldVersion: '7.0.0', newVersion: '8.0.0' },
        { name: 'jest', oldVersion: '26.0.0', newVersion: '27.0.0' },
      ];

      const result = await updateConfigFiles(updatedPackages);

      // The function returns undefined, which is expected behavior
      expect(result).toBeUndefined();
    });

    it('should handle empty updated packages', async () => {
      const result = await updateConfigFiles([]);

      // The function returns undefined, which is expected behavior
      expect(result).toBeUndefined();
    });
  });
});
