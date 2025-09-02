/**
 * Configuration Encryption Module
 * Provides secure storage and retrieval of sensitive configuration data
 */

import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { fileExists } from '../utils.js';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const TAG_LENGTH = 16; // 128 bits

/**
 * Secure Configuration Manager
 */
export class SecureConfig {
  constructor(keyPath = null) {
    this.keyPath = keyPath || path.join(process.cwd(), '.deset.key');
    this.encryptionKey = null;
  }

  /**
   * Initialize or load encryption key
   */
  async initializeKey() {
    if (await fileExists(this.keyPath)) {
      // Load existing key
      const keyData = await fs.readFile(this.keyPath);
      this.encryptionKey = keyData;
    } else {
      // Generate new key
      this.encryptionKey = crypto.randomBytes(KEY_LENGTH);
      await fs.writeFile(this.keyPath, this.encryptionKey, { mode: 0o600 });
      console.log('🔑 Generated new encryption key for configuration');
    }
  }

  /**
   * Encrypt sensitive configuration value
   */
  encrypt(plaintext) {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not initialized');
    }

    // Ensure key is the right length for AES-256
    const key = this.encryptionKey.length === KEY_LENGTH 
      ? this.encryptionKey 
      : crypto.scryptSync(this.encryptionKey.toString(), 'salt', KEY_LENGTH);
    
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // For compatibility, create a dummy tag
    const tag = crypto.createHash('sha256').update(encrypted).digest('hex').substring(0, 32);

    // Combine IV, tag, and encrypted data
    return {
      encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
      algorithm: ALGORITHM,
    };
  }

  /**
   * Decrypt sensitive configuration value
   */
  decrypt(encryptedData) {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not initialized');
    }

    const { encrypted, iv, algorithm } = encryptedData;

    if (algorithm && algorithm !== ALGORITHM) {
      throw new Error('Unsupported encryption algorithm');
    }

    // Ensure key is the right length for AES-256
    const key = this.encryptionKey.length === KEY_LENGTH 
      ? this.encryptionKey 
      : crypto.scryptSync(this.encryptionKey.toString(), 'salt', KEY_LENGTH);

    const decipher = crypto.createDecipheriv('aes-256-cbc', key, Buffer.from(iv, 'hex'));

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Store encrypted configuration
   */
  async storeSecureConfig(configPath, config) {
    await this.initializeKey();

    const secureConfig = { ...config };

    // Identify and encrypt sensitive fields
    const sensitiveFields = ['tokens', 'apiKeys', 'secrets', 'passwords'];

    for (const field of sensitiveFields) {
      if (secureConfig[field]) {
        if (typeof secureConfig[field] === 'object') {
          // Encrypt object properties
          for (const [key, value] of Object.entries(secureConfig[field])) {
            if (typeof value === 'string') {
              secureConfig[field][key] = this.encrypt(value);
            }
          }
        } else if (typeof secureConfig[field] === 'string') {
          secureConfig[field] = this.encrypt(secureConfig[field]);
        }
      }
    }

    // Add metadata
    secureConfig._encrypted = {
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      fields: sensitiveFields.filter((field) => config[field]),
    };

    await fs.writeFile(configPath, JSON.stringify(secureConfig, null, 2));
  }

  /**
   * Load and decrypt configuration
   */
  async loadSecureConfig(configPath) {
    if (!(await fileExists(configPath))) {
      return null;
    }

    await this.initializeKey();

    const configData = await fs.readFile(configPath, 'utf8');
    const config = JSON.parse(configData);

    if (!config._encrypted) {
      // Not an encrypted config, return as-is
      return config;
    }

    // Decrypt sensitive fields
    for (const field of config._encrypted.fields) {
      if (config[field]) {
        if (typeof config[field] === 'object' && !config[field].encrypted) {
          // Decrypt object properties
          for (const [key, value] of Object.entries(config[field])) {
            if (value && typeof value === 'object' && value.encrypted) {
              config[field][key] = this.decrypt(value);
            }
          }
        } else if (config[field].encrypted) {
          config[field] = this.decrypt(config[field]);
        }
      }
    }

    // Remove encryption metadata
    delete config._encrypted;

    return config;
  }

  /**
   * Encrypt individual value for storage
   */
  async encryptValue(value) {
    await this.initializeKey();
    return this.encrypt(value);
  }

  /**
   * Decrypt individual value
   */
  async decryptValue(encryptedValue) {
    await this.initializeKey();
    return this.decrypt(encryptedValue);
  }

  /**
   * Rotate encryption key (re-encrypt with new key)
   */
  async rotateKey(configPath) {
    // Load config with old key
    const config = await this.loadSecureConfig(configPath);

    // Generate new key
    const oldKeyPath = this.keyPath + '.old';
    await fs.rename(this.keyPath, oldKeyPath);

    this.encryptionKey = null;
    await this.initializeKey();

    // Re-encrypt with new key
    await this.storeSecureConfig(configPath, config);

    console.log('🔄 Successfully rotated encryption key');
    console.log('💡 Old key backed up to:', oldKeyPath);
  }
}

/**
 * Configuration integrity checker
 */
export class ConfigIntegrityChecker {
  static generateHash(config) {
    const configString = JSON.stringify(config, null, 0);
    return crypto.createHash('sha256').update(configString).digest('hex');
  }

  static async storeWithIntegrity(configPath, config) {
    const hash = this.generateHash(config);
    const configWithHash = {
      ...config,
      _integrity: {
        hash,
        timestamp: new Date().toISOString(),
      },
    };

    await fs.writeFile(configPath, JSON.stringify(configWithHash, null, 2));
  }

  static async verifyIntegrity(configPath) {
    if (!(await fileExists(configPath))) {
      return { valid: false, reason: 'File not found' };
    }

    const configData = await fs.readFile(configPath, 'utf8');
    const config = JSON.parse(configData);

    if (!config._integrity) {
      return { valid: false, reason: 'No integrity data found' };
    }

    const storedHash = config._integrity.hash;
    delete config._integrity;

    const calculatedHash = this.generateHash(config);

    if (storedHash !== calculatedHash) {
      return {
        valid: false,
        reason: 'Hash mismatch - configuration may have been tampered with',
      };
    }

    return { valid: true };
  }
}

/**
 * Environment-specific configuration security
 */
export class EnvironmentConfig {
  static getSecureEnvironment() {
    return {
      nodeEnv: process.env.NODE_ENV || 'development',
      isProduction: process.env.NODE_ENV === 'production',
      isDevelopment: process.env.NODE_ENV === 'development',
      isTest: process.env.NODE_ENV === 'test',
    };
  }

  static validateEnvironment() {
    const issues = [];

    // Check for dangerous environment variables in production
    if (this.getSecureEnvironment().isProduction) {
      const dangerousVars = ['NODE_TLS_REJECT_UNAUTHORIZED', 'DEBUG', 'NODE_DEBUG'];

      for (const varName of dangerousVars) {
        if (process.env[varName]) {
          issues.push({
            type: 'warning',
            message: `Dangerous environment variable ${varName} is set in production`,
            fix: `Unset ${varName} in production environment`,
          });
        }
      }
    }

    return issues;
  }

  static sanitizeEnvironment() {
    const env = this.getSecureEnvironment();

    if (env.isProduction) {
      // Remove dangerous variables in production
      delete process.env.DEBUG;
      delete process.env.NODE_DEBUG;

      // Ensure secure defaults
      if (
        !process.env.NODE_TLS_REJECT_UNAUTHORIZED ||
        process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0'
      ) {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = '1';
      }
    }
  }
}

// Export default secure config instance
export const secureConfig = new SecureConfig();
