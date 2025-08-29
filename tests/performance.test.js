/**
 * @fileoverview Tests for performance monitoring utilities
 */

import { jest } from '@jest/globals';

const { PerformanceMonitor, perfMonitor, monitor } = await import('../src/performance.js');

describe('PerformanceMonitor', () => {
  let performanceMonitor;
  let consoleSpy;
  let consoleWarnSpy;

  beforeEach(() => {
    performanceMonitor = new PerformanceMonitor();
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe('constructor', () => {
    it('should initialize with empty metrics and startTimes', () => {
      expect(performanceMonitor.metrics).toEqual(new Map());
      expect(performanceMonitor.startTimes).toEqual(new Map());
    });
  });

  describe('start', () => {
    it('should record start time for an operation', () => {
      const result = performanceMonitor.start('test-operation');

      expect(result).toBeUndefined();
      expect(performanceMonitor.startTimes.has('test-operation')).toBe(true);
      expect(typeof performanceMonitor.startTimes.get('test-operation')).toBe('number');
    });

    it('should allow multiple operations to be started', () => {
      performanceMonitor.start('operation1');
      performanceMonitor.start('operation2');

      expect(performanceMonitor.startTimes.has('operation1')).toBe(true);
      expect(performanceMonitor.startTimes.has('operation2')).toBe(true);
      expect(performanceMonitor.startTimes.size).toBe(2);
    });

    it('should overwrite start time if operation is started again', () => {
      performanceMonitor.start('test-operation');
      const firstStartTime = performanceMonitor.startTimes.get('test-operation');

      // Small delay to ensure different timestamps
      setTimeout(() => {
        performanceMonitor.start('test-operation');
        const secondStartTime = performanceMonitor.startTimes.get('test-operation');

        expect(secondStartTime).toBeGreaterThan(firstStartTime);
      }, 1);
    });
  });

  describe('end', () => {
    it('should calculate and store duration when operation ends', () => {
      performanceMonitor.start('test-operation');

      // Small delay to ensure measurable duration
      setTimeout(() => {
        const duration = performanceMonitor.end('test-operation');

        expect(duration).toBeGreaterThan(0);
        expect(performanceMonitor.metrics.has('test-operation')).toBe(true);
        expect(performanceMonitor.metrics.get('test-operation')).toBe(duration);
        expect(performanceMonitor.startTimes.has('test-operation')).toBe(false);
      }, 5);
    });

    it('should return 0 and warn when ending non-existent operation', () => {
      const duration = performanceMonitor.end('non-existent');

      expect(duration).toBe(0);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Warning: No start time found for operation: non-existent')
      );
    });

    it('should remove start time after ending operation', () => {
      performanceMonitor.start('test-operation');
      performanceMonitor.end('test-operation');

      expect(performanceMonitor.startTimes.has('test-operation')).toBe(false);
    });
  });

  describe('getDuration', () => {
    it('should return stored duration for completed operation', () => {
      performanceMonitor.start('test-operation');
      const endDuration = performanceMonitor.end('test-operation');
      const getDuration = performanceMonitor.getDuration('test-operation');

      expect(getDuration).toBe(endDuration);
    });

    it('should return 0 for non-existent operation', () => {
      const duration = performanceMonitor.getDuration('non-existent');
      expect(duration).toBe(0);
    });

    it('should return 0 for started but not ended operation', () => {
      performanceMonitor.start('test-operation');
      const duration = performanceMonitor.getDuration('test-operation');
      expect(duration).toBe(0);
    });
  });

  describe('getFormattedDuration', () => {
    it('should return "N/A" for non-existent operation', () => {
      const formatted = performanceMonitor.getFormattedDuration('non-existent');
      expect(formatted).toBe('N/A');
    });

    it('should format duration in milliseconds for short operations', () => {
      // Mock a 150ms duration
      performanceMonitor.metrics.set('short-operation', 150.5);
      const formatted = performanceMonitor.getFormattedDuration('short-operation');
      expect(formatted).toBe('151ms');
    });

    it('should format duration in seconds for long operations', () => {
      // Mock a 2.5 second duration
      performanceMonitor.metrics.set('long-operation', 2500);
      const formatted = performanceMonitor.getFormattedDuration('long-operation');
      expect(formatted).toBe('2.5s');
    });

    it('should handle exactly 1 second duration', () => {
      performanceMonitor.metrics.set('one-second', 1000);
      const formatted = performanceMonitor.getFormattedDuration('one-second');
      expect(formatted).toBe('1.0s');
    });
  });

  describe('displaySummary', () => {
    it('should do nothing when no metrics exist', () => {
      performanceMonitor.displaySummary();
      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('should display performance summary with sorted metrics', () => {
      // Add some test metrics
      performanceMonitor.metrics.set('operation1', 100);
      performanceMonitor.metrics.set('operation2', 50);
      performanceMonitor.metrics.set('operation3', 200);

      performanceMonitor.displaySummary();

      // Check that console.log was called multiple times
      expect(consoleSpy).toHaveBeenCalledTimes(5); // header + 3 operations + total
      // Check that the first call is the header
      expect(consoleSpy.mock.calls[0][0]).toContain('📊 Performance Summary:');
      // Check that operations are sorted by duration (descending)
      expect(consoleSpy.mock.calls[1][0]).toContain('operation3');
      expect(consoleSpy.mock.calls[2][0]).toContain('operation1');
      expect(consoleSpy.mock.calls[3][0]).toContain('operation2');
    });

    it('should use appropriate colors for different durations', () => {
      // Add metrics with different durations
      performanceMonitor.metrics.set('fast', 50);
      performanceMonitor.metrics.set('medium', 150);
      performanceMonitor.metrics.set('slow', 600);

      performanceMonitor.displaySummary();

      // Check that console.log was called multiple times
      expect(consoleSpy).toHaveBeenCalledTimes(5); // header + 3 operations + total
      // Check that the header is correct
      expect(consoleSpy.mock.calls[0][0]).toContain('📊 Performance Summary:');
      // Check that operations appear with correct names (sorted by duration descending)
      expect(consoleSpy.mock.calls[1][0]).toContain('slow');
      expect(consoleSpy.mock.calls[2][0]).toContain('medium');
      expect(consoleSpy.mock.calls[3][0]).toContain('fast');
    });
  });

  describe('clear', () => {
    it('should clear all metrics and start times', () => {
      performanceMonitor.start('operation1');
      performanceMonitor.start('operation2');
      performanceMonitor.end('operation1');

      expect(performanceMonitor.metrics.size).toBe(1);
      expect(performanceMonitor.startTimes.size).toBe(1);

      performanceMonitor.clear();

      expect(performanceMonitor.metrics.size).toBe(0);
      expect(performanceMonitor.startTimes.size).toBe(0);
    });
  });
});

describe('Global perfMonitor instance', () => {
  it('should be an instance of PerformanceMonitor', () => {
    expect(perfMonitor).toBeInstanceOf(PerformanceMonitor);
  });

  it('should work as a singleton across the application', () => {
    perfMonitor.start('global-test');
    const duration = perfMonitor.end('global-test');

    expect(duration).toBeGreaterThanOrEqual(0);
    expect(perfMonitor.metrics.has('global-test')).toBe(true);
  });
});

describe('monitor decorator', () => {
  it('should be a function that returns a decorator', () => {
    expect(typeof monitor).toBe('function');
    const decorator = monitor('test-op');
    expect(typeof decorator).toBe('function');
  });

  it('should automatically monitor async function performance', async () => {
    // Create a test function that we can monitor
    const testObj = {
      async testMethod() {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return 'result';
      },
    };

    // Apply the monitor decorator
    const descriptor = { value: testObj.testMethod };
    monitor('async-test')(testObj, 'testMethod', descriptor);
    testObj.testMethod = descriptor.value;

    const result = await testObj.testMethod();

    expect(result).toBe('result');
    expect(perfMonitor.metrics.has('async-test')).toBe(true);
    expect(perfMonitor.getDuration('async-test')).toBeGreaterThan(0);
  });

  it('should handle function errors and still record performance', async () => {
    const testObj = {
      async errorMethod() {
        throw new Error('Test error');
      },
    };

    const descriptor = { value: testObj.errorMethod };
    monitor('error-test')(testObj, 'errorMethod', descriptor);
    testObj.errorMethod = descriptor.value;

    await expect(testObj.errorMethod()).rejects.toThrow('Test error');
    expect(perfMonitor.metrics.has('error-test')).toBe(true);
  });

  it('should work with synchronous functions by making them async', async () => {
    const testObj = {
      syncMethod() {
        return 'sync result';
      },
    };

    const descriptor = { value: testObj.syncMethod };
    monitor('sync-test')(testObj, 'syncMethod', descriptor);
    testObj.syncMethod = descriptor.value;

    const result = await testObj.syncMethod();

    expect(result).toBe('sync result');
    expect(perfMonitor.metrics.has('sync-test')).toBe(true);
  });
});

describe('Integration tests', () => {
  it('should handle multiple concurrent operations', async () => {
    const promises = [];

    for (let i = 0; i < 5; i++) {
      const testObj = {
        async concurrentMethod() {
          await new Promise((resolve) => setTimeout(resolve, Math.random() * 20));
          return i;
        },
      };

      const descriptor = { value: testObj.concurrentMethod };
      monitor(`concurrent-${i}`)(testObj, 'concurrentMethod', descriptor);
      testObj.concurrentMethod = descriptor.value;

      promises.push(testObj.concurrentMethod());
    }

    const results = await Promise.all(promises);

    expect(results).toEqual([0, 1, 2, 3, 4]);

    for (let i = 0; i < 5; i++) {
      expect(perfMonitor.metrics.has(`concurrent-${i}`)).toBe(true);
      expect(perfMonitor.getDuration(`concurrent-${i}`)).toBeGreaterThan(0);
    }
  });

  it('should handle real-world CLI operation simulation', async () => {
    const testObj = {
      async cliMethod() {
        // Simulate file reading
        perfMonitor.start('file-read');
        await new Promise((resolve) => setTimeout(resolve, 30));
        perfMonitor.end('file-read');

        // Simulate package analysis
        perfMonitor.start('package-analysis');
        await new Promise((resolve) => setTimeout(resolve, 50));
        perfMonitor.end('package-analysis');

        // Simulate output generation
        perfMonitor.start('output-generation');
        await new Promise((resolve) => setTimeout(resolve, 20));
        perfMonitor.end('output-generation');

        return 'CLI completed';
      },
    };

    const descriptor = { value: testObj.cliMethod };
    monitor('cli-simulation')(testObj, 'cliMethod', descriptor);
    testObj.cliMethod = descriptor.value;

    const result = await testObj.cliMethod();

    expect(result).toBe('CLI completed');
    expect(perfMonitor.metrics.has('cli-simulation')).toBe(true);
    expect(perfMonitor.metrics.has('file-read')).toBe(true);
    expect(perfMonitor.metrics.has('package-analysis')).toBe(true);
    expect(perfMonitor.metrics.has('output-generation')).toBe(true);

    // Verify all operations have reasonable durations
    expect(perfMonitor.getDuration('file-read')).toBeGreaterThan(25);
    expect(perfMonitor.getDuration('package-analysis')).toBeGreaterThan(45);
    expect(perfMonitor.getDuration('output-generation')).toBeGreaterThan(15);
  });
});
