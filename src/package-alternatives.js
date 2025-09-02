/**
 * Package alternatives database for suggesting modern replacements
 */

export const PACKAGE_ALTERNATIVES = {
  // Testing frameworks
  mocha: [
    {
      name: 'jest',
      description: 'Zero-config testing framework with built-in assertions and coverage',
    },
    { name: 'vitest', description: 'Fast unit test framework powered by Vite' },
    { name: 'tap', description: 'Test Anything Protocol library for Node.js' },
    { name: 'ava', description: 'Minimal and fast test runner' },
    { name: 'jasmine', description: 'Behavior-driven development framework' },
  ],
  karma: [
    {
      name: 'jest',
      description: 'Modern testing framework with built-in browser testing via jsdom',
    },
    { name: 'vitest', description: 'Next generation testing framework' },
    { name: 'web-test-runner', description: 'Test runner for web applications' },
    { name: 'cypress', description: 'End-to-end testing framework' },
    { name: 'playwright', description: 'Cross-browser end-to-end testing' },
  ],

  // Build tools
  gulp: [
    { name: 'vite', description: 'Next generation frontend build tool' },
    { name: 'webpack', description: 'Module bundler for modern JavaScript applications' },
    { name: 'rollup', description: 'Module bundler optimized for libraries' },
    { name: 'parcel', description: 'Zero-configuration build tool' },
    { name: 'esbuild', description: 'Extremely fast JavaScript bundler' },
  ],
  grunt: [
    { name: 'npm-scripts', description: 'Use package.json scripts for build tasks' },
    { name: 'vite', description: 'Modern build tool with hot reload' },
    { name: 'webpack', description: 'Powerful module bundler' },
    { name: 'rollup', description: 'Tree-shaking bundler' },
    { name: 'just', description: 'Task runner and build tool' },
  ],

  // Utility libraries
  lodash: [
    { name: 'ramda', description: 'Functional programming utility library' },
    { name: 'rambda', description: 'Lightweight alternative to Ramda' },
    { name: 'underscore', description: 'Utility belt library' },
    { name: 'native-methods', description: 'Use native JavaScript methods instead' },
    { name: 'just', description: 'Collection of dependency-free utilities' },
  ],
  moment: [
    { name: 'dayjs', description: 'Lightweight alternative to Moment.js' },
    { name: 'date-fns', description: 'Modern date utility library' },
    { name: 'luxon', description: 'DateTime library by Moment.js team' },
    { name: 'js-joda', description: 'Immutable date and time API' },
    { name: 'native-date', description: 'Use native JavaScript Date API' },
  ],

  // HTTP clients
  request: [
    { name: 'axios', description: 'Promise-based HTTP client' },
    { name: 'node-fetch', description: 'Fetch API for Node.js' },
    { name: 'got', description: 'Human-friendly HTTP request library' },
    { name: 'ky', description: 'Tiny HTTP client based on Fetch API' },
    { name: 'superagent', description: 'Small progressive client-side HTTP request library' },
  ],

  // Linting
  jshint: [
    { name: 'eslint', description: 'Pluggable JavaScript linter' },
    { name: '@typescript-eslint/eslint-plugin', description: 'ESLint plugin for TypeScript' },
    { name: 'standard', description: 'JavaScript Standard Style linter' },
    { name: 'xo', description: 'Opinionated but configurable ESLint wrapper' },
    { name: 'biome', description: 'Fast linter and formatter' },
  ],
  tslint: [
    { name: 'eslint', description: 'Use ESLint with TypeScript support' },
    { name: '@typescript-eslint/eslint-plugin', description: 'Official TypeScript ESLint plugin' },
    { name: 'biome', description: 'Fast TypeScript linter and formatter' },
    { name: 'rome', description: 'Unified developer tools (archived, use Biome)' },
    { name: 'dprint', description: 'Code formatter with TypeScript support' },
  ],
};

/**
 * Safe packages that are generally okay to keep even if stale
 */
export const SAFE_STALE_PACKAGES = [
  'core-js',
  'polyfill',
  'shim',
  'ponyfill', // Polyfills
  'typescript',
  '@types/', // Type definitions
  'jquery',
  'bootstrap',
  'foundation', // Mature UI libraries
  'react',
  'vue',
  'angular', // Major frameworks (stable versions)
  'express',
  'koa',
  'fastify', // Stable server frameworks
  'lodash',
  'ramda',
  'chalk',
  'debug',
];

/**
 * Get alternatives for a specific package
 * @param {string} packageName - Name of the package
 * @returns {Array} Array of alternative packages
 */
export function getPackageAlternatives(packageName) {
  return PACKAGE_ALTERNATIVES[packageName] || [];
}

/**
 * Check if a package is considered safe when stale
 * @param {string} packageName - Name of the package
 * @returns {boolean} True if package is safe when stale
 */
export function isSafeStalePackage(packageName) {
  return SAFE_STALE_PACKAGES.some((safe) => {
    if (safe.endsWith('/')) {
      return packageName.startsWith(safe);
    }
    return packageName === safe || packageName.startsWith(`${safe}-`);
  });
}
