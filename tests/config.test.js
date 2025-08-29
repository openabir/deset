/**
 * @fileoverview Tests for configuration functions
 */

const { mergeConfigWithFlags, DEFAULT_CONFIG } = await import('../src/config.js');

describe('Config', () => {
  describe('mergeConfigWithFlags', () => {
    const baseConfig = {
      features: {
        eslint: true,
        prettier: true,
        husky: true,
        audit: true,
        staleCheck: true,
      },
    };

    it('should merge config with CLI flags correctly', () => {
      const flags = {
        eslint: false,
        prettier: false,
        audit: false,
      };

      const result = mergeConfigWithFlags(baseConfig, flags);

      expect(result.features.eslint).toBe(false);
      expect(result.features.prettier).toBe(false);
      expect(result.features.husky).toBe(true);
      expect(result.features.audit).toBe(false);
      expect(result.features.staleCheck).toBe(true);
    });

    it('should handle undefined flags', () => {
      const result = mergeConfigWithFlags(baseConfig, {});

      expect(result.features).toEqual(baseConfig.features);
    });

    it('should handle empty config', () => {
      const emptyConfig = { features: {} };
      const flags = { eslint: false };

      const result = mergeConfigWithFlags(emptyConfig, flags);

      expect(result.features.eslint).toBe(false);
    });

    it('should preserve config when no flags provided', () => {
      const result = mergeConfigWithFlags(baseConfig, {});

      expect(result.features).toEqual(baseConfig.features);
    });

    it('should handle boolean conversion for no-* flags', () => {
      const flags = {
        eslint: false, // --no-eslint
        prettier: true, // --prettier (explicit - but this doesn't affect the logic)
        husky: undefined, // not specified
      };

      const result = mergeConfigWithFlags(baseConfig, flags);

      expect(result.features.eslint).toBe(false);
      expect(result.features.husky).toBe(true); // unchanged from base
    });
  });

  describe('DEFAULT_CONFIG', () => {
    it('should have all required configuration keys', () => {
      expect(DEFAULT_CONFIG).toHaveProperty('features');
      expect(DEFAULT_CONFIG.features).toHaveProperty('eslint');
      expect(DEFAULT_CONFIG.features).toHaveProperty('prettier');
      expect(DEFAULT_CONFIG.features).toHaveProperty('husky');
      expect(DEFAULT_CONFIG.features).toHaveProperty('lintStaged');
      expect(DEFAULT_CONFIG.features).toHaveProperty('dependabot');
      expect(DEFAULT_CONFIG.features).toHaveProperty('audit');
      expect(DEFAULT_CONFIG.features).toHaveProperty('staleCheck');
    });

    it('should have sensible defaults', () => {
      expect(DEFAULT_CONFIG.features.eslint).toBe(true);
      expect(DEFAULT_CONFIG.features.prettier).toBe(true);
      expect(DEFAULT_CONFIG.features.husky).toBe(true);
      expect(DEFAULT_CONFIG.features.audit).toBe(true);
      expect(DEFAULT_CONFIG.features.staleCheck).toBe(true);
    });
  });
});
