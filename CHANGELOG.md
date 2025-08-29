# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-08-29

### Added

- Initial release of @oas/deset
- `init` command for automated developer environment setup
- `check` command for comprehensive project health checks
- `config` command for interactive configuration management
- Support for ESLint, Prettier, Husky, lint-staged, and Dependabot setup
- Intelligent stale package analysis with categorization (safe/warning/critical)
- Built-in package alternatives database with 50+ popular package replacements
- Interactive package update management
- Security vulnerability detection via npm audit
- Git integration for changed-files-only analysis
- JSON and text output formats
- Comprehensive test suite with 100% coverage
- Production-ready error handling and validation

### Features

- **Environment Setup**: Automatically configure development tools
- **Health Checks**: Run security audits, check for outdated packages, analyze stale dependencies
- **Smart Package Management**: Intelligent categorization and replacement suggestions
- **Configuration Management**: Flexible config system with CLI flag overrides
- **CI/CD Ready**: Non-interactive mode for automated pipelines
- **Developer Experience**: Progress indicators, colored output, detailed help

### Technical Details

- Node.js 16+ support
- ES Modules architecture
- Commander.js CLI framework
- Comprehensive Jest test suite
- ESLint + Prettier code quality
- Husky pre-commit hooks
