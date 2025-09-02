/**
 * Secure HTTP client with timeout, retry, and rate limiting
 * Prevents SSRF attacks and implements security best practices
 */

import { validateUrl, RateLimiter } from './input-sanitizer.js';

/**
 * Default timeout for HTTP requests (10 seconds)
 */
const DEFAULT_TIMEOUT = 10000;

/**
 * Default maximum retries
 */
const DEFAULT_MAX_RETRIES = 3;

/**
 * Default rate limiter (10 requests per minute)
 */
const DEFAULT_RATE_LIMITER = new RateLimiter(10, 60000);

/**
 * Maximum response size (5MB)
 */
const MAX_RESPONSE_SIZE = 5 * 1024 * 1024;

/**
 * Secure HTTP client class
 */
export class SecureHttpClient {
  constructor(options = {}) {
    this.timeout = options.timeout || DEFAULT_TIMEOUT;
    this.maxRetries = options.maxRetries || DEFAULT_MAX_RETRIES;
    this.rateLimiter = options.rateLimiter || DEFAULT_RATE_LIMITER;
    this.userAgent = options.userAgent || '@oas/deset/1.0.0';
    this.maxResponseSize = options.maxResponseSize || MAX_RESPONSE_SIZE;
  }

  /**
   * Make a secure HTTP request
   * @param {string} url - URL to request
   * @param {Object} options - Request options
   * @returns {Promise<Response>} Fetch response
   * @throws {Error} If request fails or is blocked
   */
  async request(url, options = {}) {
    // Validate URL
    const validatedUrl = validateUrl(url);

    // Check rate limit
    const rateLimitKey = validatedUrl.hostname;
    if (!this.rateLimiter.isAllowed(rateLimitKey)) {
      const resetTime = this.rateLimiter.getTimeUntilReset(rateLimitKey);
      throw new Error(`Rate limit exceeded. Try again in ${Math.ceil(resetTime / 1000)} seconds`);
    }

    let lastError;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      let controller;
      let timeoutId;

      try {
        // Set up abort controller and timeout for this attempt
        controller = new AbortController();
        timeoutId = setTimeout(() => controller.abort(), this.timeout);

        // Set up secure request options
        const requestOptions = {
          method: options.method || 'GET',
          headers: {
            'User-Agent': this.userAgent,
            Accept: 'application/json',
            'Accept-Encoding': 'gzip, deflate',
            'Cache-Control': 'no-cache',
            Connection: 'close',
            ...options.headers,
          },
          signal: controller.signal,
          body: options.body,
          ...options,
        };

        // Remove any potentially dangerous headers
        delete requestOptions.headers['Authorization'];
        delete requestOptions.headers['Cookie'];
        delete requestOptions.headers['X-Forwarded-For'];
        delete requestOptions.headers['X-Real-IP'];

        const response = await fetch(validatedUrl.toString(), requestOptions);

        // Clear timeout on successful response
        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        // Check response size
        const contentLength = response.headers.get('content-length');
        if (contentLength && parseInt(contentLength) > this.maxResponseSize) {
          throw new Error(
            `Response too large: ${contentLength} bytes (max ${this.maxResponseSize})`
          );
        }

        // For successful responses, validate the response body size while reading
        if (response.ok) {
          return await this.validateResponseBody(response);
        }

        // Handle HTTP errors
        if (response.status >= 400) {
          const errorText = await this.safeReadResponse(response);
          throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
        }

        return response;
      } catch (error) {
        lastError = error;

        // Don't retry on certain errors
        if (
          error.name === 'AbortError' ||
          error.message.includes('Rate limit') ||
          error.message.includes('not in whitelist') ||
          error.message.includes('too large')
        ) {
          throw error;
        }

        // Wait before retry with exponential backoff
        if (attempt < this.maxRetries) {
          const delay = 1000 * Math.pow(2, attempt - 1);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  /**
   * Safely read response body with size validation
   * @param {Response} response - Fetch response
   * @returns {Promise<Response>} Response with validated body
   */
  async validateResponseBody(response) {
    const reader = response.body?.getReader();
    if (!reader) {
      return response;
    }

    let totalSize = 0;
    const chunks = [];

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        totalSize += value.length;
        if (totalSize > this.maxResponseSize) {
          throw new Error(
            `Response body too large: ${totalSize} bytes (max ${this.maxResponseSize})`
          );
        }

        chunks.push(value);
      }

      // Reconstruct response with validated body
      const body = new Uint8Array(totalSize);
      let offset = 0;
      for (const chunk of chunks) {
        body.set(chunk, offset);
        offset += chunk.length;
      }

      return new Response(body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Safely read response text with size limits
   * @param {Response} response - Fetch response
   * @returns {Promise<string>} Response text (truncated if too large)
   */
  async safeReadResponse(response) {
    try {
      const text = await response.text();
      return text.length > 1000 ? text.substring(0, 1000) + '...' : text;
    } catch {
      return 'Unable to read response';
    }
  }

  /**
   * Get JSON data from URL
   * @param {string} url - URL to fetch
   * @returns {Promise<Object>} Parsed JSON response
   */
  async getJson(url) {
    const response = await this.request(url, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch JSON from ${url}: ${response.status}`);
    }

    try {
      const data = await response.json();

      // Basic JSON structure validation
      if (data === null || typeof data !== 'object') {
        throw new Error('Invalid JSON response structure');
      }

      return data;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error('Invalid JSON response format');
      }
      throw error;
    }
  }
}

/**
 * Default secure HTTP client instance
 */
export const secureHttpClient = new SecureHttpClient();

/**
 * Fetch package information from npm registry securely
 * @param {string} packageName - Name of the package
 * @returns {Promise<Object>} Package information
 */
export async function getPackageInfo(packageName) {
  const { sanitizePackageName } = await import('./input-sanitizer.js');
  const sanitizedName = sanitizePackageName(packageName);
  const url = `https://registry.npmjs.org/${encodeURIComponent(sanitizedName)}`;

  return secureHttpClient.getJson(url);
}

/**
 * Get the last published date of a package securely
 * @param {string} packageName - Name of the package
 * @returns {Promise<Date>} Last published date
 */
export async function getPackageLastPublished(packageName) {
  try {
    const packageInfo = await getPackageInfo(packageName);

    if (!packageInfo.time || !packageInfo.versions) {
      throw new Error('Invalid package data structure');
    }

    const versions = Object.keys(packageInfo.versions);
    if (versions.length === 0) {
      throw new Error('No versions found for package');
    }

    const latestVersion = versions[versions.length - 1];
    const publishTime = packageInfo.time[latestVersion];

    if (!publishTime) {
      throw new Error('No publish time found for latest version');
    }

    return new Date(publishTime);
  } catch (error) {
    throw new Error(`Could not fetch package info for ${packageName}: ${error.message}`);
  }
}

/**
 * Get detailed package information with validation
 * @param {string} packageName - Name of the package
 * @returns {Promise<Object>} Detailed package information
 */
export async function getDetailedPackageInfo(packageName) {
  try {
    const packageInfo = await getPackageInfo(packageName);
    const latestVersion = packageInfo['dist-tags']?.latest;
    const versionInfo = packageInfo.versions?.[latestVersion] || {};

    return {
      description: packageInfo.description || versionInfo.description || 'No description available',
      keywords: packageInfo.keywords || versionInfo.keywords || [],
      deprecated: versionInfo.deprecated || false,
      repository: packageInfo.repository?.url || versionInfo.repository?.url,
      homepage: packageInfo.homepage || versionInfo.homepage,
      license: packageInfo.license || versionInfo.license,
      version: latestVersion,
      publishedAt: packageInfo.time?.[latestVersion],
    };
  } catch (error) {
    return {
      description: 'Error fetching package info',
      keywords: [],
      deprecated: false,
      error: error.message,
    };
  }
}
