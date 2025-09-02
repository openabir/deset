/**
 * Security tests for command modules
 * Tests security aspects of init and check commands
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Command Security Tests', () => {
  let testDir;
  let originalCwd;

  beforeEach(async () => {
    originalCwd = process.cwd();
    testDir = path.join(__dirname, 'temp-security-test');

    try {
      await fs.mkdir(testDir, { recursive: true });
      process.chdir(testDir);
    } catch {
      // Directory might already exist
    }
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Cleanup best effort
    }
  });

  describe('Security Module Tests', () => {
    test('should sanitize package names correctly', async () => {
      const { sanitizePackageName } = await import('../src/security/input-sanitizer.js');

      // Valid package names should pass
      expect(() => sanitizePackageName('lodash')).not.toThrow();
      expect(() => sanitizePackageName('@types/node')).not.toThrow();
      expect(() => sanitizePackageName('babel-core')).not.toThrow();

      // Invalid package names should be rejected
      expect(() => sanitizePackageName('../../../evil')).toThrow();
      expect(() => sanitizePackageName('$(rm -rf /)')).toThrow();
      expect(() => sanitizePackageName('package; evil')).toThrow();
    });

    test('should validate HTTP security', async () => {
      const { SecureHttpClient } = await import('../src/security/secure-http.js');
      const client = new SecureHttpClient();

      // Should reject non-HTTPS URLs
      await expect(client.getJson('http://registry.npmjs.org/lodash')).rejects.toThrow();

      // Should reject non-whitelisted domains
      await expect(client.getJson('https://evil.com/malware')).rejects.toThrow();
    });

    test('should detect suspicious package patterns', async () => {
      const { PackageIntegrityChecker } = await import('../src/security/package-integrity.js');
      const checker = new PackageIntegrityChecker();

      // Should detect suspicious patterns
      expect(checker.isSuspiciousPackageName('crypto-miner')).toBe(true);
      expect(checker.isSuspiciousPackageName('admin-tool')).toBe(true);
      expect(checker.isSuspiciousPackageName('a1234567890')).toBe(true);

      // Should allow legitimate packages
      expect(checker.isSuspiciousPackageName('lodash')).toBe(false);
      expect(checker.isSuspiciousPackageName('express')).toBe(false);
    });

    test('should handle configuration encryption', async () => {
      const { SecureConfig } = await import('../src/security/config-encryption.js');
      const config = new SecureConfig();

      await config.initializeKey();

      const sensitiveData = 'my-secret-api-key';
      const encrypted = config.encrypt(sensitiveData);
      const decrypted = config.decrypt(encrypted);

      expect(encrypted.encrypted).toBeDefined();
      expect(encrypted.iv).toBeDefined();
      expect(decrypted).toBe(sensitiveData);
    });

    test('should validate input schemas', async () => {
      const { validateValue, PACKAGE_NAME_SCHEMA } = await import('../src/validation/schemas.js');

      // Valid inputs should pass
      expect(() => validateValue('lodash', PACKAGE_NAME_SCHEMA)).not.toThrow();
      expect(() => validateValue('@types/node', PACKAGE_NAME_SCHEMA)).not.toThrow();

      // Invalid inputs should be rejected
      expect(() => validateValue('a'.repeat(300), PACKAGE_NAME_SCHEMA)).toThrow();
      expect(() => validateValue('', PACKAGE_NAME_SCHEMA)).toThrow();
    });
  });

  describe('Command Integration Tests', () => {
    test('should handle init command safely', async () => {
      // Create a basic package.json
      const packageJson = {
        name: 'test-package',
        version: '1.0.0',
        description: 'Test package',
      };

      await fs.writeFile('package.json', JSON.stringify(packageJson, null, 2));

      const { initCommand } = await import('../src/commands/init.js');

      // Should complete without throwing
      await expect(initCommand({})).resolves.not.toThrow();
    });

    test('should handle check command safely', async () => {
      // Create a basic package.json
      const packageJson = {
        name: 'test-package',
        version: '1.0.0',
        dependencies: {
          lodash: '^4.17.21'
        }
      };

      await fs.writeFile('package.json', JSON.stringify(packageJson, null, 2));

      const { checkCommand } = await import('../src/commands/check.js');

      // Should complete without throwing
      await expect(checkCommand({})).resolves.not.toThrow();
    });
  });
});
