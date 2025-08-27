import { jest } from '@jest/globals';
import { initCommand } from '../src/commands/init.js';

// Mock the config module
const mockLoadConfig = jest.fn();
const mockMergeConfigWithFlags = jest.fn();

// Mock the utils module
const mockFileExists = jest.fn();
const mockWriteJsonFile = jest.fn();
const mockWriteTextFile = jest.fn();
const mockReadPackageJson = jest.fn();
const mockWritePackageJson = jest.fn();
const mockLog = jest.fn();

jest.unstable_mockModule('../src/config.js', () => ({
  loadConfig: mockLoadConfig,
  mergeConfigWithFlags: mockMergeConfigWithFlags,
}));

jest.unstable_mockModule('../src/utils.js', () => ({
  fileExists: mockFileExists,
  writeJsonFile: mockWriteJsonFile,
  writeTextFile: mockWriteTextFile,
  readPackageJson: mockReadPackageJson,
  writePackageJson: mockWritePackageJson,
  log: mockLog,
  formatOutput: jest.fn((data, format) => (format === 'json' ? JSON.stringify(data) : data)),
}));

describe('init command', () => {
  let consoleLogSpy;
  let processExitSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
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

    mockLoadConfig.mockResolvedValue(mockConfig);
    mockMergeConfigWithFlags.mockReturnValue(mockConfig);

    const options = { dryRun: true, format: 'text' };

    await initCommand(options);

    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringMatching(/Dry run.*planned actions/));
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

    mockLoadConfig.mockResolvedValue(mockBaseConfig);
    mockMergeConfigWithFlags.mockReturnValue(mockMergedConfig);

    const options = { eslint: false, dryRun: true };

    await initCommand(options);

    expect(mockMergeConfigWithFlags).toHaveBeenCalledWith(mockBaseConfig, options);
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

    mockLoadConfig.mockResolvedValue(mockConfig);
    mockMergeConfigWithFlags.mockReturnValue(mockConfig);
    mockFileExists.mockResolvedValue(false);
    mockWriteJsonFile.mockResolvedValue();

    const options = { dryRun: false, format: 'text' };

    await initCommand(options);

    expect(mockWriteJsonFile).toHaveBeenCalled();
    expect(mockLog).toHaveBeenCalledWith('success', expect.any(String));
  });

  test('should handle errors gracefully', async () => {
    mockLoadConfig.mockRejectedValue(new Error('Config file error'));

    const options = { dryRun: false };

    await initCommand(options);

    expect(mockLog).toHaveBeenCalledWith('error', expect.stringContaining('Initialization failed'));
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });
});
