import { jest, beforeEach, afterEach, describe, test, expect } from '@jest/globals';

// Mock dependencies before importing the module
jest.unstable_mockModule('../src/config.js', () => ({
  loadConfig: jest.fn(),
  mergeConfigWithFlags: jest.fn(),
}));

jest.unstable_mockModule('../src/utils.js', () => ({
  fileExists: jest.fn(),
  writeJsonFile: jest.fn(),
  writeTextFile: jest.fn(),
  readPackageJson: jest.fn(),
  writePackageJson: jest.fn(),
  log: jest.fn(),
  formatOutput: jest.fn((data, format) => (format === 'json' ? JSON.stringify(data) : data)),
  logError: jest.fn(),
}));

// Import modules after mocking
const { initCommand } = await import('../src/commands/init.js');
const { loadConfig, mergeConfigWithFlags } = await import('../src/config.js');
const { fileExists, writeJsonFile, readPackageJson, writePackageJson, log } = await import(
  '../src/utils.js'
);

describe('init command', () => {
  let consoleLogSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('should output correct plan with --dry-run flag', async () => {
    const mockConfig = {
      features: {
        eslint: true,
        prettier: true,
        husky: false,
        lintStaged: false,
        dependabot: false,
        audit: true,
        staleCheck: true,
      },
    };

    loadConfig.mockResolvedValue(mockConfig);
    mergeConfigWithFlags.mockReturnValue(mockConfig);

    const options = { dryRun: true, format: 'text' };

    await initCommand(options);

    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Planned actions'));
  });

  test('should handle --no-eslint flag', async () => {
    const mockBaseConfig = {
      features: {
        eslint: true,
        prettier: true,
        husky: true,
        lintStaged: true,
        dependabot: false,
        audit: true,
        staleCheck: true,
      },
    };

    const mockMergedConfig = {
      features: {
        ...mockBaseConfig.features,
        eslint: false,
      },
    };

    loadConfig.mockResolvedValue(mockBaseConfig);
    mergeConfigWithFlags.mockReturnValue(mockMergedConfig);

    const options = { eslint: false, dryRun: true };

    await initCommand(options);

    expect(mergeConfigWithFlags).toHaveBeenCalledWith(mockBaseConfig, options);
  });

  test('should create configuration files when not in dry-run mode', async () => {
    const mockConfig = {
      features: {
        eslint: true,
        prettier: true,
        husky: false,
        lintStaged: false,
        dependabot: false,
        audit: true,
        staleCheck: true,
      },
    };

    loadConfig.mockResolvedValue(mockConfig);
    mergeConfigWithFlags.mockReturnValue(mockConfig);
    fileExists.mockResolvedValue(false);
    writeJsonFile.mockResolvedValue();
    readPackageJson.mockResolvedValue({ name: 'test', scripts: {} });
    writePackageJson.mockResolvedValue();

    const options = { dryRun: false, format: 'text' };

    await initCommand(options);

    expect(writeJsonFile).toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith('success', expect.any(String));
  });

  test('should handle errors gracefully', async () => {
    loadConfig.mockRejectedValue(new Error('Config file error'));

    const options = { dryRun: false };

    await expect(initCommand(options)).rejects.toThrow('Config file error');
    expect(log).toHaveBeenCalledWith('error', expect.stringContaining('Initialization failed'));
  });
});
