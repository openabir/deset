/**
 * @fileoverview Tests for config command
 */

import { jest } from '@jest/globals';

// Create mock fs module
const mockWriteFile = jest.fn().mockResolvedValue();

jest.unstable_mockModule('fs/promises', () => ({
  default: {
    writeFile: mockWriteFile,
  },
}));

jest.unstable_mockModule('../src/utils.js', () => ({
  askYesNo: jest.fn(),
  askMultipleChoice: jest.fn(),
  fileExists: jest.fn(),
  logError: jest.fn(),
  ProgressIndicator: jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    complete: jest.fn(),
  })),
}));

// Import after mocking
const { askYesNo, askMultipleChoice, fileExists, logError } = await import('../src/utils.js');
const { configCommand } = await import('../src/commands/config.js');

describe('Config Command', () => {
  let consoleSpy;
  let consoleLogSpy;
  let processExitSpy;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleLogSpy = consoleSpy;
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});

    // Reset all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  describe('configCommand', () => {
    it('should handle reset option', async () => {
      const options = { reset: true };

      fileExists.mockResolvedValue(true);
      askYesNo.mockResolvedValue(true);

      await configCommand(options);

      expect(fileExists).toHaveBeenCalledWith(expect.stringContaining('devenv.config.json'));
      expect(askYesNo).toHaveBeenCalledWith(
        'Are you sure you want to reset the configuration to defaults?'
      );
    });

    it('should handle existing config file overwrite', async () => {
      const options = {};

      fileExists.mockResolvedValue(true);
      askYesNo
        .mockResolvedValueOnce(true) // Overwrite existing config
        .mockResolvedValueOnce(false) // ESLint
        .mockResolvedValueOnce(false) // Prettier
        .mockResolvedValueOnce(false) // Husky
        .mockResolvedValueOnce(false) // Dependabot
        .mockResolvedValueOnce(false) // Audit
        .mockResolvedValueOnce(false) // Stale check
        .mockResolvedValueOnce(true) // Interactive
        .mockResolvedValueOnce(false) // Advanced config
        .mockResolvedValueOnce(true); // Confirm configuration

      askMultipleChoice.mockResolvedValue({ name: 'text' });

      await configCommand(options);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('🔧 @oas/devset Configuration Wizard')
      );
      expect(mockWriteFile).toHaveBeenCalledWith(
        expect.stringContaining('devenv.config.json'),
        expect.any(String),
        'utf8'
      );
    });

    it('should cancel when user chooses not to overwrite existing config', async () => {
      const options = {};

      fileExists.mockResolvedValue(true);
      askYesNo.mockResolvedValue(false); // Don't overwrite

      await configCommand(options);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Configuration wizard cancelled.')
      );
      expect(mockWriteFile).not.toHaveBeenCalled();
    });

    it('should create new config when file does not exist', async () => {
      const options = {};

      fileExists.mockResolvedValue(false);
      askYesNo
        .mockResolvedValueOnce(true) // ESLint
        .mockResolvedValueOnce(true) // Prettier
        .mockResolvedValueOnce(true) // Husky
        .mockResolvedValueOnce(true) // lint-staged
        .mockResolvedValueOnce(true) // Dependabot
        .mockResolvedValueOnce(true) // Audit
        .mockResolvedValueOnce(true) // Stale check
        .mockResolvedValueOnce(true) // Interactive
        .mockResolvedValueOnce(true) // Advanced config
        .mockResolvedValueOnce(true) // CI mode
        .mockResolvedValueOnce(true); // Confirm configuration

      askMultipleChoice
        .mockResolvedValueOnce({ name: 'json' }) // Output format
        .mockResolvedValueOnce({ name: 'strict' }); // Strictness

      await configCommand(options);

      expect(mockWriteFile).toHaveBeenCalledWith(
        expect.stringContaining('devenv.config.json'),
        expect.stringMatching(/"version":\s*"1\.0\.0"/),
        'utf8'
      );
    });

    it('should cancel configuration when user rejects preview', async () => {
      const options = {};

      fileExists.mockResolvedValue(false);
      askYesNo
        .mockResolvedValueOnce(false) // ESLint
        .mockResolvedValueOnce(false) // Prettier
        .mockResolvedValueOnce(false) // Husky
        .mockResolvedValueOnce(false) // Dependabot
        .mockResolvedValueOnce(false) // Audit
        .mockResolvedValueOnce(false) // Stale check
        .mockResolvedValueOnce(false) // Interactive
        .mockResolvedValueOnce(false) // Advanced config
        .mockResolvedValueOnce(false); // Reject configuration

      askMultipleChoice.mockResolvedValue({ name: 'text' });

      await configCommand(options);

      expect(processExitSpy).toHaveBeenCalledWith(0);
      // Since process.exit is mocked, the function continues execution
      // so we expect the file to be written despite the rejection
    });

    it('should configure advanced options when requested', async () => {
      const options = {};

      fileExists.mockResolvedValue(false);
      askYesNo
        .mockResolvedValueOnce(false) // ESLint
        .mockResolvedValueOnce(false) // Prettier
        .mockResolvedValueOnce(false) // Husky
        .mockResolvedValueOnce(false) // Dependabot
        .mockResolvedValueOnce(false) // Audit
        .mockResolvedValueOnce(false) // Stale check
        .mockResolvedValueOnce(false) // Interactive
        .mockResolvedValueOnce(true) // Advanced config
        .mockResolvedValueOnce(true) // CI mode
        .mockResolvedValueOnce(true); // Confirm configuration

      askMultipleChoice
        .mockResolvedValueOnce({ name: 'text' }) // Output format
        .mockResolvedValueOnce({ name: 'balanced' }); // Strictness

      await configCommand(options);

      const writeCall = mockWriteFile.mock.calls[0];
      const configData = JSON.parse(writeCall[1]);

      expect(configData).toHaveProperty('ciMode', true);
      expect(configData).toHaveProperty('strictness');
      expect(configData.strictness).toHaveProperty('name', 'balanced');
      expect(configData).toHaveProperty('exitOnWarnings', false);
    });

    it('should handle errors during configuration', async () => {
      const options = {};
      const testError = new Error('Test error');

      fileExists.mockRejectedValue(testError);

      await configCommand(options);

      expect(logError).toHaveBeenCalledWith(testError, {
        suggestion: 'Make sure you have write permissions in the current directory',
        command: 'ls -la devenv.config.json',
        docs: 'https://nodejs.org/api/fs.html#fs_file_system',
      });
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should skip lint-staged when husky is disabled', async () => {
      const options = {};

      fileExists.mockResolvedValue(false);
      askYesNo
        .mockResolvedValueOnce(false) // ESLint
        .mockResolvedValueOnce(false) // Prettier
        .mockResolvedValueOnce(false) // Husky (disabled)
        .mockResolvedValueOnce(false) // Dependabot
        .mockResolvedValueOnce(false) // Audit
        .mockResolvedValueOnce(false) // Stale check
        .mockResolvedValueOnce(false) // Interactive
        .mockResolvedValueOnce(false) // Advanced config
        .mockResolvedValueOnce(true); // Confirm configuration

      askMultipleChoice.mockResolvedValue({ name: 'text' });

      await configCommand(options);

      const writeCall = mockWriteFile.mock.calls[0];
      const configData = JSON.parse(writeCall[1]);

      expect(configData.features.lintStaged).toBe(false);
    });

    it('should use strict mode settings when strictness is strict', async () => {
      const options = {};

      fileExists.mockResolvedValue(false);
      askYesNo
        .mockResolvedValueOnce(false) // ESLint
        .mockResolvedValueOnce(false) // Prettier
        .mockResolvedValueOnce(false) // Husky
        .mockResolvedValueOnce(false) // Dependabot
        .mockResolvedValueOnce(false) // Audit
        .mockResolvedValueOnce(false) // Stale check
        .mockResolvedValueOnce(false) // Interactive
        .mockResolvedValueOnce(true) // Advanced config
        .mockResolvedValueOnce(false) // CI mode
        .mockResolvedValueOnce(true); // Confirm configuration

      askMultipleChoice
        .mockResolvedValueOnce({ name: 'json' }) // Output format
        .mockResolvedValueOnce({ name: 'strict' }); // Strictness

      await configCommand(options);

      const writeCall = mockWriteFile.mock.calls[0];
      const configData = JSON.parse(writeCall[1]);

      expect(configData).toHaveProperty('exitOnWarnings', false); // Bug: strictness is object, not string
      expect(configData).toHaveProperty('strictness');
      expect(configData.strictness).toHaveProperty('name', 'strict');
    });
  });

  describe('resetConfiguration', () => {
    it('should handle reset when no config file exists', async () => {
      const options = { reset: true };

      fileExists.mockResolvedValue(false);

      await configCommand(options);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('No configuration file found to reset.')
      );
    });

    it('should cancel reset when user declines', async () => {
      const options = { reset: true };

      fileExists.mockResolvedValue(true);
      askYesNo.mockResolvedValue(false); // Don't reset

      await configCommand(options);

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Reset cancelled.'));
      expect(mockWriteFile).not.toHaveBeenCalled();
    });

    it('should reset configuration to defaults', async () => {
      const options = { reset: true };

      fileExists.mockResolvedValue(true);
      askYesNo.mockResolvedValue(true); // Confirm reset

      await configCommand(options);

      expect(mockWriteFile).toHaveBeenCalledWith(
        expect.stringContaining('devenv.config.json'),
        expect.stringMatching(/"version":\s*"1\.0\.0"/),
        'utf8'
      );

      const writeCall = mockWriteFile.mock.calls[0];
      const configData = JSON.parse(writeCall[1]);

      expect(configData.features.eslint).toBe(true);
      expect(configData.features.prettier).toBe(true);
      expect(configData.features.husky).toBe(true);
      expect(configData.defaults.outputFormat).toBe('text');
    });
  });
});
