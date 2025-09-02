/**
 * Package Integrity & Supply Chain Security Module
 * Verifies package authenticity and detects tampering
 */

import crypto from 'crypto';
import { SecureHttpClient } from './secure-http.js';
import { securityLogger } from './secure-error-handler.js';

/**
 * Package integrity verification system
 */
export class PackageIntegrityChecker {
  constructor() {
    this.httpClient = new SecureHttpClient();
    this.knownVulnerabilities = new Map();
    this.trustedPublishers = new Set([
      'npm',
      'facebook',
      'google',
      'microsoft',
      'sindresorhus',
      'johnpapa',
      'angular',
      'typescript',
    ]);
  }

  /**
   * Verify package integrity and safety
   */
  async verifyPackage(packageName, version = 'latest') {
    const results = {
      packageName,
      version,
      safe: true,
      issues: [],
      metadata: null,
      integrity: null,
    };

    try {
      // Get package metadata
      results.metadata = await this.getPackageMetadata(packageName);

      // Run security checks
      await this.checkPackageVulnerabilities(packageName, results);
      await this.checkPackageMetadata(results.metadata, results);
      await this.checkPublisherTrust(results.metadata, results);
      await this.checkPackageAge(results.metadata, results);
      await this.checkDownloadStats(results.metadata, results);

      // Calculate final safety score
      results.safe =
        results.issues.filter((issue) => issue.severity === 'high' || issue.severity === 'critical')
          .length === 0;

      // Log security events
      if (!results.safe) {
        securityLogger.logEvent('package_integrity_failure', {
          package: packageName,
          issues: results.issues.length,
          severities: results.issues.map((i) => i.severity),
        });
      }
    } catch (error) {
      results.safe = false;
      results.issues.push({
        type: 'verification_error',
        severity: 'high',
        message: `Failed to verify package: ${error.message}`,
      });
    }

    return results;
  }

  /**
   * Get package metadata from npm registry
   */
  async getPackageMetadata(packageName) {
    const sanitizedName = this.sanitizePackageName(packageName);
    const url = `https://registry.npmjs.org/${sanitizedName}`;

    const response = await this.httpClient.get(url);

    if (!response || !response.name) {
      throw new Error('Invalid package metadata received');
    }

    return response;
  }

  /**
   * Check for known vulnerabilities
   */
  async checkPackageVulnerabilities(packageName, results) {
    try {
      // Note: This is a simplified check. In reality, you'd use npm audit API
      // or integrate with vulnerability databases like Snyk, GitHub Security, etc.

      if (this.knownVulnerabilities.has(packageName)) {
        const vulns = this.knownVulnerabilities.get(packageName);
        results.issues.push(...vulns);
      }
    } catch (error) {
      results.issues.push({
        type: 'vulnerability_check_failed',
        severity: 'medium',
        message: `Could not check vulnerabilities: ${error.message}`,
      });
    }
  }

  /**
   * Check package metadata for suspicious patterns
   */
  async checkPackageMetadata(metadata, results) {
    // Check for suspicious package names
    if (this.isSuspiciousPackageName(metadata.name)) {
      results.issues.push({
        type: 'suspicious_name',
        severity: 'medium',
        message: 'Package name contains suspicious patterns',
      });
    }

    // Check for missing or suspicious description
    if (!metadata.description || metadata.description.length < 10) {
      results.issues.push({
        type: 'missing_description',
        severity: 'low',
        message: 'Package lacks proper description',
      });
    }

    // Check for suspicious keywords
    const suspiciousKeywords = ['hack', 'crack', 'bypass', 'exploit', 'malware'];
    if (metadata.keywords) {
      const foundSuspicious = metadata.keywords.filter((keyword) =>
        suspiciousKeywords.some((sus) => keyword.toLowerCase().includes(sus))
      );

      if (foundSuspicious.length > 0) {
        results.issues.push({
          type: 'suspicious_keywords',
          severity: 'high',
          message: `Package contains suspicious keywords: ${foundSuspicious.join(', ')}`,
        });
      }
    }

    // Check for repository information
    if (!metadata.repository || !metadata.repository.url) {
      results.issues.push({
        type: 'no_repository',
        severity: 'medium',
        message: 'Package has no repository information',
      });
    }

    // Check license
    if (!metadata.license) {
      results.issues.push({
        type: 'no_license',
        severity: 'low',
        message: 'Package has no license information',
      });
    }
  }

  /**
   * Check publisher trustworthiness
   */
  async checkPublisherTrust(metadata, results) {
    const author = metadata.author?.name || metadata.maintainers?.[0]?.name;

    if (!author) {
      results.issues.push({
        type: 'no_author',
        severity: 'medium',
        message: 'Package has no identifiable author',
      });
      return;
    }

    // Check if author is in trusted list
    if (!this.trustedPublishers.has(author.toLowerCase())) {
      // For new/unknown publishers, check their other packages
      const publisherScore = await this.calculatePublisherTrustScore(author);

      if (publisherScore < 0.3) {
        results.issues.push({
          type: 'untrusted_publisher',
          severity: 'medium',
          message: `Publisher "${author}" has low trust score`,
        });
      }
    }
  }

  /**
   * Check package age and activity
   */
  async checkPackageAge(metadata, results) {
    const createdDate = new Date(metadata.time?.created);
    const now = new Date();

    // Very new packages (less than 7 days) are potentially suspicious
    const daysSinceCreated = (now - createdDate) / (1000 * 60 * 60 * 24);
    if (daysSinceCreated < 7) {
      results.issues.push({
        type: 'very_new_package',
        severity: 'medium',
        message: `Package is very new (${Math.round(daysSinceCreated)} days old)`,
      });
    }

    // Check for version bombing (too many versions in short time)
    const versions = Object.keys(metadata.versions || {});
    if (versions.length > 50) {
      const recentVersions = versions.filter((version) => {
        const versionDate = new Date(metadata.time[version]);
        const daysSinceVersion = (now - versionDate) / (1000 * 60 * 60 * 24);
        return daysSinceVersion < 30;
      });

      if (recentVersions.length > 10) {
        results.issues.push({
          type: 'version_bombing',
          severity: 'high',
          message: `Too many versions published recently (${recentVersions.length} in 30 days)`,
        });
      }
    }
  }

  /**
   * Check download statistics for anomalies
   */
  async checkDownloadStats(metadata, results) {
    try {
      // Get download stats from npm API
      const statsUrl = `https://api.npmjs.org/downloads/point/last-month/${metadata.name}`;
      const stats = await this.httpClient.get(statsUrl);

      if (stats && stats.downloads !== undefined) {
        // Very high downloads for new packages might indicate bot activity
        const createdDate = new Date(metadata.time?.created);
        const daysSinceCreated = (Date.now() - createdDate) / (1000 * 60 * 60 * 24);

        if (daysSinceCreated < 30 && stats.downloads > 100000) {
          results.issues.push({
            type: 'suspicious_download_pattern',
            severity: 'medium',
            message: 'High download count for new package may indicate artificial inflation',
          });
        }
      }
    } catch {
      // Download stats check is non-critical
      console.debug('Could not fetch download stats');
    }
  }

  /**
   * Calculate publisher trust score based on their package history
   */
  async calculatePublisherTrustScore(publisherName) {
    try {
      // This is a simplified implementation
      // In practice, you'd analyze the publisher's package history, community ratings, etc.

      const searchUrl = `https://registry.npmjs.org/-/v1/search?text=author:${publisherName}&size=20`;
      const searchResults = await this.httpClient.get(searchUrl);

      if (!searchResults || !searchResults.objects) {
        return 0.1; // Very low trust for no history
      }

      const packages = searchResults.objects;
      let score = 0;

      // Factors that increase trust:
      // - Number of packages (more = better, up to a point)
      // - Package ages (older = better)
      // - Download counts
      // - Repository links

      packages.forEach((pkg) => {
        const metadata = pkg.package;

        // Age factor
        const createdDate = new Date(metadata.date);
        const daysSinceCreated = (Date.now() - createdDate) / (1000 * 60 * 60 * 24);
        score += Math.min(daysSinceCreated / 365, 2) * 0.1; // Max 2 years worth

        // Repository factor
        if (metadata.links?.repository) {
          score += 0.1;
        }

        // Description factor
        if (metadata.description && metadata.description.length > 20) {
          score += 0.05;
        }
      });

      // Normalize score
      return Math.min(score / packages.length, 1.0);
    } catch (error) {
      return 0.2; // Default low trust score
    }
  }

  /**
   * Check if package name is suspicious
   */
  isSuspiciousPackageName(name) {
    const suspiciousPatterns = [
      /l{2,}/, // Multiple consecutive l's (typosquatting)
      /o{2,}/, // Multiple consecutive o's
      /[0-9]{4,}/, // Long number sequences
      /^[a-z]-[a-z]$/, // Single letter packages
      /admin|root|sudo|exec|eval|system/i, // Privileged terms
      /hack|crack|exploit|payload/i, // Malicious terms
      /crypto.*(?:miner|mining)/i, // Crypto mining
    ];

    return suspiciousPatterns.some((pattern) => pattern.test(name));
  }

  /**
   * Sanitize package name for safe API calls
   */
  sanitizePackageName(name) {
    if (typeof name !== 'string') {
      throw new Error('Package name must be a string');
    }

    // Allow only valid npm package name characters
    if (!/^[@a-z0-9-_./]+$/i.test(name)) {
      throw new Error('Invalid package name format');
    }

    // Prevent excessively long names
    if (name.length > 214) {
      throw new Error('Package name too long');
    }

    return encodeURIComponent(name);
  }

  /**
   * Add known vulnerability to local database
   */
  addKnownVulnerability(packageName, vulnerability) {
    if (!this.knownVulnerabilities.has(packageName)) {
      this.knownVulnerabilities.set(packageName, []);
    }

    this.knownVulnerabilities.get(packageName).push({
      type: 'known_vulnerability',
      severity: vulnerability.severity || 'medium',
      message: vulnerability.message,
      cve: vulnerability.cve,
      publishedDate: vulnerability.publishedDate,
    });
  }

  /**
   * Generate integrity hash for package content
   */
  generatePackageHash(packageContent) {
    return crypto.createHash('sha256').update(packageContent).digest('hex');
  }

  /**
   * Verify package tarball integrity
   */
  async verifyTarballIntegrity(packageName, version, expectedHash) {
    try {
      const tarballUrl = `https://registry.npmjs.org/${packageName}/-/${packageName}-${version}.tgz`;
      const tarballData = await this.httpClient.get(tarballUrl, { responseType: 'arraybuffer' });

      const actualHash = this.generatePackageHash(tarballData);

      if (actualHash !== expectedHash) {
        throw new Error(
          `Package integrity check failed. Expected: ${expectedHash}, Got: ${actualHash}`
        );
      }

      return true;
    } catch (error) {
      securityLogger.logEvent('package_integrity_failure', {
        package: packageName,
        version,
        error: error.message,
      });
      throw error;
    }
  }
}

/**
 * Supply chain security scanner
 */
export class SupplyChainScanner {
  constructor() {
    this.integrityChecker = new PackageIntegrityChecker();
  }

  /**
   * Scan project dependencies for security issues
   */
  async scanProject(packageJsonPath) {
    const results = {
      safe: true,
      scannedPackages: 0,
      issues: [],
      recommendations: [],
    };

    try {
      const packageJson = JSON.parse(
        await import('fs/promises').then((fs) => fs.readFile(packageJsonPath, 'utf8'))
      );

      const allDependencies = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };

      for (const [packageName, version] of Object.entries(allDependencies)) {
        const packageResults = await this.integrityChecker.verifyPackage(packageName, version);
        results.scannedPackages++;

        if (!packageResults.safe) {
          results.safe = false;
          results.issues.push({
            package: packageName,
            version,
            issues: packageResults.issues,
          });
        }
      }

      // Generate recommendations
      this.generateRecommendations(results);
    } catch (error) {
      results.safe = false;
      results.issues.push({
        type: 'scan_error',
        message: `Failed to scan project: ${error.message}`,
      });
    }

    return results;
  }

  /**
   * Generate security recommendations
   */
  generateRecommendations(results) {
    if (results.issues.length === 0) {
      results.recommendations.push('✅ All scanned packages appear safe');
      return;
    }

    const criticalIssues = results.issues.filter((issue) =>
      issue.issues.some((i) => i.severity === 'critical')
    );

    const highIssues = results.issues.filter((issue) =>
      issue.issues.some((i) => i.severity === 'high')
    );

    if (criticalIssues.length > 0) {
      results.recommendations.push(
        '🚨 CRITICAL: Review and replace packages with critical security issues'
      );
    }

    if (highIssues.length > 0) {
      results.recommendations.push('⚠️ HIGH: Update or replace packages with high-severity issues');
    }

    results.recommendations.push('🔍 Regular security scans recommended');
    results.recommendations.push('📝 Consider using package-lock.json for dependency integrity');
  }
}

// Export instances
export const packageIntegrityChecker = new PackageIntegrityChecker();
export const supplyChainScanner = new SupplyChainScanner();
