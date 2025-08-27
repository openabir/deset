import { performance } from 'perf_hooks';
import chalk from 'chalk';

/**
 * Performance monitoring utilities
 */
export class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
    this.startTimes = new Map();
  }

  /**
   * Start timing an operation
   * @param {string} name - Operation name
   */
  start(name) {
    this.startTimes.set(name, performance.now());
  }

  /**
   * End timing an operation
   * @param {string} name - Operation name
   * @returns {number} Duration in milliseconds
   */
  end(name) {
    const startTime = this.startTimes.get(name);
    if (!startTime) {
      console.warn(chalk.yellow(`Warning: No start time found for operation: ${name}`));
      return 0;
    }

    const duration = performance.now() - startTime;
    this.metrics.set(name, duration);
    this.startTimes.delete(name);
    return duration;
  }

  /**
   * Get duration for an operation
   * @param {string} name - Operation name
   * @returns {number} Duration in milliseconds
   */
  getDuration(name) {
    return this.metrics.get(name) || 0;
  }

  /**
   * Get formatted duration string
   * @param {string} name - Operation name
   * @returns {string} Formatted duration
   */
  getFormattedDuration(name) {
    const duration = this.getDuration(name);
    if (duration === 0) return 'N/A';

    if (duration < 1000) {
      return `${Math.round(duration)}ms`;
    } else {
      return `${(duration / 1000).toFixed(1)}s`;
    }
  }

  /**
   * Display performance summary
   */
  displaySummary() {
    if (this.metrics.size === 0) return;

    console.log(chalk.cyan('\n📊 Performance Summary:'));
    const sortedMetrics = Array.from(this.metrics.entries()).sort((a, b) => b[1] - a[1]);

    sortedMetrics.forEach(([name, duration]) => {
      const formatted = this.getFormattedDuration(name);
      const color = duration > 5000 ? 'red' : duration > 2000 ? 'yellow' : 'green';
      console.log(chalk.gray(`  ${name}: ${chalk[color](formatted)}`));
    });

    const total = Array.from(this.metrics.values()).reduce((sum, duration) => sum + duration, 0);
    console.log(
      chalk.cyan(
        `  Total: ${this.getFormattedDuration('total') || (total / 1000).toFixed(1) + 's'}`
      )
    );
  }

  /**
   * Clear all metrics
   */
  clear() {
    this.metrics.clear();
    this.startTimes.clear();
  }
}

/**
 * Global performance monitor instance
 */
export const perfMonitor = new PerformanceMonitor();

/**
 * Decorator function to automatically monitor function performance
 * @param {string} name - Operation name
 * @returns {Function} Decorator function
 */
export function monitor(name) {
  return function (target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args) {
      perfMonitor.start(name);
      try {
        const result = await originalMethod.apply(this, args);
        return result;
      } finally {
        perfMonitor.end(name);
      }
    };

    return descriptor;
  };
}
