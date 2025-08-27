import { jest } from '@jest/globals';
import { checkCommand } from '../src/commands/check.js';

// Mock the config module
const mockLoadConfig = jest.fn();
const mockMergeConfigWithFlags = jest.fn();

// Mock the utils module
const mockLog = jest.fn();
const mockReadPackageJson = jest.fn();
const mockGetChangedFiles = jest.fn();
const mockIsGitRepo = jest.fn();
const mockFormatOutput = jest.fn();

jest.unstable_mockModule('../src/config.js', () => ({
  loadConfig: mockLoadConfig,
  mergeConfigWithFlags: mockMergeConfigWithFlags,
}));

jest.unstable_mockModule('../src/utils.js', () => ({
  log: mockLog,
  readPackageJson: mockReadPackageJson,
  getChangedFiles: mockGetChangedFiles,
  isGitRepo: mockIsGitRepo,
  formatOutput: mockFormatOutput,
}));

describe('check command', () => {
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

  test('should handle basic configuration loading', async () => {
    const mockConfig = {
      features: {
        audit: false,
        staleCheck: false,
      },
    };

    mockLoadConfig.mockResolvedValue(mockConfig);
    mockMergeConfigWithFlags.mockReturnValue(mockConfig);
    mockFormatOutput.mockImplementation((data, format) =>
      format === 'json' ? JSON.stringify(data) : data
    );

    const options = { format: 'text' };

    await checkCommand(options);

    expect(mockLoadConfig).toHaveBeenCalled();
    expect(mockMergeConfigWithFlags).toHaveBeenCalledWith(mockConfig, options);
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

    mockLoadConfig.mockResolvedValue(mockBaseConfig);
    mockMergeConfigWithFlags.mockReturnValue(mockMergedConfig);
    mockFormatOutput.mockImplementation((data, format) =>
      format === 'json' ? JSON.stringify(data) : data
    );

    const options = { audit: false, format: 'text' };

    await checkCommand(options);

    expect(mockMergeConfigWithFlags).toHaveBeenCalledWith(mockBaseConfig, options);
    expect(processExitSpy).toHaveBeenCalledWith(0);
  });

  test('should handle changed-only flag with git repository', async () => {
    const mockConfig = {
      features: {
        audit: false,
        staleCheck: false,
      },
    };

    mockLoadConfig.mockResolvedValue(mockConfig);
    mockMergeConfigWithFlags.mockReturnValue(mockConfig);
    mockIsGitRepo.mockResolvedValue(true);
    mockGetChangedFiles.mockResolvedValue(['src/test.js', 'README.md']);
    mockFormatOutput.mockImplementation((data, format) =>
      format === 'json' ? JSON.stringify(data) : data
    );

    const options = { changedOnly: true, format: 'text' };

    await checkCommand(options);

    expect(mockIsGitRepo).toHaveBeenCalled();
    expect(mockGetChangedFiles).toHaveBeenCalled();
    expect(mockLog).toHaveBeenCalledWith('info', 'Found 2 changed files');
  });

  test('should handle changed-only flag without git repository', async () => {
    const mockConfig = {
      features: {
        audit: false,
        staleCheck: false,
      },
    };

    mockLoadConfig.mockResolvedValue(mockConfig);
    mockMergeConfigWithFlags.mockReturnValue(mockConfig);
    mockIsGitRepo.mockResolvedValue(false);
    mockFormatOutput.mockImplementation((data, format) =>
      format === 'json' ? JSON.stringify(data) : data
    );

    const options = { changedOnly: true, format: 'text' };

    await checkCommand(options);

    expect(mockLog).toHaveBeenCalledWith(
      'warning',
      'Not in a git repository, ignoring --changed-only flag'
    );
  });

  test('should handle errors gracefully', async () => {
    mockLoadConfig.mockRejectedValue(new Error('Config error'));

    const options = { format: 'text' };

    await checkCommand(options);

    expect(mockLog).toHaveBeenCalledWith('error', expect.stringContaining('Check failed'));
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  test('should handle JSON output format', async () => {
    const mockConfig = {
      features: {
        audit: false,
        staleCheck: false,
      },
    };

    mockLoadConfig.mockResolvedValue(mockConfig);
    mockMergeConfigWithFlags.mockReturnValue(mockConfig);
    mockFormatOutput.mockImplementation((data, format) => {
      if (format === 'json') {
        return JSON.stringify(data, null, 2);
      }
      return data;
    });

    const options = { format: 'json' };

    await checkCommand(options);

    expect(mockFormatOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        summary: expect.any(Object),
      }),
      'json'
    );
  });
});
