import fs from 'fs/promises';
import path from 'path';

export const DEFAULT_CONFIG = {
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

/**
 * Load configuration from devenv.config.json with fallback to defaults
 * @returns {Promise<Object>} Configuration object
 */
export async function loadConfig() {
  try {
    const configPath = path.join(process.cwd(), 'devenv.config.json');
    const configFile = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(configFile);

    // Merge with defaults
    return {
      features: {
        ...DEFAULT_CONFIG.features,
        ...config.features,
      },
    };
  } catch {
    // If config file doesn't exist or is invalid, use defaults
    return DEFAULT_CONFIG;
  }
}

/**
 * Merge configuration with command line flags
 * Config merging order: flags > config file > defaults
 * @param {Object} config - Base configuration
 * @param {Object} options - Command line options
 * @returns {Object} Merged configuration
 */
export function mergeConfigWithFlags(config, options) {
  const mergedConfig = {
    features: { ...(config?.features || {}) },
  };

  // If no options provided, return the config as is
  if (!options) {
    return config || DEFAULT_CONFIG;
  }

  // Override with command line flags (--no-* flags)
  if (options.eslint === false) mergedConfig.features.eslint = false;
  if (options.prettier === false) mergedConfig.features.prettier = false;
  if (options.husky === false) mergedConfig.features.husky = false;
  if (options.lintStaged === false) mergedConfig.features.lintStaged = false;
  if (options.dependabot === false) mergedConfig.features.dependabot = false;
  if (options.audit === false) mergedConfig.features.audit = false;
  if (options.staleCheck === false) mergedConfig.features.staleCheck = false;

  return mergedConfig;
}

/**
 * Get default configuration
 * @returns {Object} Default configuration
 */
export function getDefaultConfig() {
  return DEFAULT_CONFIG;
}
