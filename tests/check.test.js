import { jest, beforeEach, afterEach, describe, test, expect } from '@jest/globals';

// Mock dependencies before importing the module
jest.unstable_mockModule('../src/config.js', () => ({
  loadConfig: jest.fn(),
  mergeConfigWithFlags: jest.fn(),
}));

jest.unstable_mockModule('../src/utils.js', () => ({
  log: jest.fn(),
  readPackageJson: jest.fn(),
  getChangedFiles: jest.fn(),
  isGitRepo: jest.fn(),
  formatOutput: jest.fn((data, format) => (format === 'json' ? JSON.stringify(data) : data)),
  ProgressIndicator: jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    complete: jest.fn(),
    fail: jest.fn(),
  })),
  logError: jest.fn(),
  askYesNo: jest.fn(),
  askMultipleChoice: jest.fn(),
  updatePackageVersions: jest.fn(),
  installUpdatedPackages: jest.fn(),
  updateConfigFiles: jest.fn(),
  analyzeStalePackages: jest.fn(),
  handleStalePackageManagement: jest.fn(),
}));

// Import modules after mocking
const { checkCommand } = await import('../src/commands/check.js');
const { loadConfig, mergeConfigWithFlags } = await import('../src/config.js');
const { log, isGitRepo, getChangedFiles, formatOutput } = await import('../src/utils.js');

describe('check command', () => {
  let processExitSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('should handle basic configuration loading', async () => {
    const mockConfig = {
      features: {
        audit: false,
        staleCheck: false,
      },
    };

    loadConfig.mockResolvedValue(mockConfig);
    mergeConfigWithFlags.mockReturnValue(mockConfig);
    formatOutput.mockImplementation((data, format) =>
      format === 'json' ? JSON.stringify(data) : data
    );

    const options = { format: 'text' };

    await checkCommand(options);

    expect(loadConfig).toHaveBeenCalled();
    expect(mergeConfigWithFlags).toHaveBeenCalledWith(mockConfig, options);
    expect(processExitSpy).toHaveBeenCalledWith(0);
  });

  test('should handle config merging with command line flags', async () => {
    const mockBaseConfig = {
      features: {
        audit: true,
        staleCheck: true,
      },
    };

    const mockMergedConfig = {
      features: {
        audit: false,
        staleCheck: true,
      },
    };

    loadConfig.mockResolvedValue(mockBaseConfig);
    mergeConfigWithFlags.mockReturnValue(mockMergedConfig);
    formatOutput.mockImplementation((data, format) =>
      format === 'json' ? JSON.stringify(data) : data
    );

    const options = { audit: false, format: 'text' };

    await checkCommand(options);

    expect(mergeConfigWithFlags).toHaveBeenCalledWith(mockBaseConfig, options);
    expect(processExitSpy).toHaveBeenCalledWith(0);
  });

  test('should handle changed-only flag with git repository', async () => {
    const mockConfig = {
      features: {
        audit: false,
        staleCheck: false,
      },
    };

    loadConfig.mockResolvedValue(mockConfig);
    mergeConfigWithFlags.mockReturnValue(mockConfig);
    isGitRepo.mockResolvedValue(true);
    getChangedFiles.mockResolvedValue(['src/test.js', 'README.md']);
    formatOutput.mockImplementation((data, format) =>
      format === 'json' ? JSON.stringify(data) : data
    );

    const options = { changedOnly: true, format: 'text' };

    await checkCommand(options);

    expect(isGitRepo).toHaveBeenCalled();
    expect(getChangedFiles).toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith('info', 'Found 2 changed files');
  });

  test('should handle changed-only flag without git repository', async () => {
    const mockConfig = {
      features: {
        audit: false,
        staleCheck: false,
      },
    };

    loadConfig.mockResolvedValue(mockConfig);
    mergeConfigWithFlags.mockReturnValue(mockConfig);
    isGitRepo.mockResolvedValue(false);
    formatOutput.mockImplementation((data, format) =>
      format === 'json' ? JSON.stringify(data) : data
    );

    const options = { changedOnly: true, format: 'text' };

    await checkCommand(options);

    expect(log).toHaveBeenCalledWith(
      'warning',
      'Not in a git repository, ignoring --changed-only flag'
    );
  });

  test('should handle errors gracefully', async () => {
    loadConfig.mockRejectedValue(new Error('Config error'));

    const options = { format: 'text' };

    // Check command handles errors internally and doesn't throw
    await checkCommand(options);

    // The command should still complete (with error logging internally)
    expect(loadConfig).toHaveBeenCalled();
  });

  test('should handle JSON output format', async () => {
    const mockConfig = {
      features: {
        audit: false,
        staleCheck: false,
      },
    };

    loadConfig.mockResolvedValue(mockConfig);
    mergeConfigWithFlags.mockReturnValue(mockConfig);
    formatOutput.mockImplementation((data, format) => {
      if (format === 'json') {
        return JSON.stringify(data, null, 2);
      }
      return data;
    });

    const options = { format: 'json' };

    await checkCommand(options);

    expect(formatOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        summary: expect.any(Object),
      }),
      'json'
    );
  });
});
