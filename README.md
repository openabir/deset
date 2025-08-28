# @oas/devset

A production-ready CLI tool that automates developer environment setup and project health checks.

## Features

- **Environment Initialization**: Automatically set up development tools and configurations
- **Project Health Checks**: Run comprehensive checks for security vulnerabilities, outdated packages, and stale dependencies
- **Interactive Package Updates**: Automatically update outdated packages with user guidance and config file updates
- **Configurable**: Customize which features to enable/disable via configuration file or command-line flags
- **Multiple Output Formats**: Support for both human-readable text and machine-readable JSON output
- **Git Integration**: Check only changed files when working with git repositories

## Installation

```bash
npm install -g @oas/devset
```

Or run directly with npx:

```bash
npx @oas/devset init
```

## Commands

### `init` - Initialize Developer Environment

Sets up your project with development tools and configurations.

```bash
devset init [options]
```

**Options:**

- `--dry-run` - Show planned actions without executing them
- `--format <type>` - Output format: `text` (default) or `json`
- `--no-eslint` - Disable ESLint setup
- `--no-prettier` - Disable Prettier setup
- `--no-husky` - Disable Husky git hooks setup
- `--no-lint-staged` - Disable lint-staged setup
- `--no-dependabot` - Disable Dependabot configuration
- `--no-audit` - Disable audit feature in config
- `--no-stale-check` - Disable stale package checking

**What it sets up:**

- `.eslintrc.json` - ESLint configuration extending recommended rules + Prettier
- `.prettierrc` - Prettier configuration with sensible defaults
- `.husky/pre-commit` - Git pre-commit hook running lint-staged
- `package.json` - Adds lint-staged configuration
- `.github/dependabot.yml` - Dependabot configuration for automated dependency updates

### `check` - Run Project Health Checks

Performs various checks on your project to identify potential issues.

```bash
devset check [options]
```

**Options:**

- `--changed-only` - Only check changed files (via git diff)
- `--format <type>` - Output format: `text` (default) or `json`
- `--no-interactive` - Disable interactive prompts (useful for CI/CD)
- `--no-audit` - Skip npm audit check
- `--no-stale-check` - Skip stale package check

**What it checks:**

- **Security Audit**: Runs `npm audit` to find security vulnerabilities
- **Outdated Packages**: Lists packages that have newer versions available
- **Stale Packages**: Analyzes packages not updated in >1 year with detailed categorization:
  - **Safe stale packages**: Generally okay to keep (polyfills, stable frameworks, etc.)
  - **Needs attention**: Packages that should be reviewed (1-2 years old)
  - **Critical stale packages**: Packages that should be replaced (>2 years old or deprecated)

**Smart Stale Package Management:**

When stale packages are detected, the CLI provides:

1. **Intelligent categorization** - Distinguishes between safe, concerning, and critical stale packages
2. **Alternative recommendations** - Suggests modern replacements with descriptions
3. **Interactive replacement** - Guides you through replacing packages with better alternatives
4. **Automatic installation** - Handles uninstalling old packages and installing replacements
5. **Code migration hints** - Provides guidance on updating your code

**Interactive Package Updates:**

When outdated packages are found and the CLI is running in interactive mode (default), it will:

1. Ask if you want to update the outdated packages
2. Offer choice between updating all packages or selecting specific ones
3. Update `package.json` with the latest versions
4. Optionally install the updated packages automatically
5. Update configuration files (ESLint, Jest, Prettier) to industry standards

## Configuration

@oas/devset uses a `devenv.config.json` file for configuration. If this file doesn't exist, it will use sensible defaults.

### Default Configuration

```json
{
  "features": {
    "eslint": true,
    "prettier": true,
    "husky": true,
    "lintStaged": true,
    "dependabot": false,
    "audit": true,
    "staleCheck": true
  }
}
```

### Configuration Priority

Configuration values are merged in this order (highest to lowest priority):

1. Command-line flags (`--no-eslint`, etc.)
2. `devenv.config.json` file
3. Default values

## Usage Examples

### Basic Setup

```bash
# Initialize with default configuration
npx @oas/devset init

# Initialize with only Prettier (disable other tools)
npx @oas/devset init --no-eslint --no-husky --no-dependabot

# See what would be set up without making changes
npx @oas/devset init --dry-run
```

### Project Health Checks

```bash
# Run all health checks with interactive package updates
npx @oas/devset check

# Run checks with JSON output (great for CI/CD)
npx @oas/devset check --format json

# Run checks without interactive prompts (for automated environments)
npx @oas/devset check --no-interactive

# Check only changed files (useful in git workflows)
npx @oas/devset check --changed-only

# Skip stale package warnings
npx @oas/devset check --no-stale-check
```

### Interactive Package Updates

When running `devset check`, if outdated packages are found, the CLI will interactively guide you through updating them:

```bash
# Example interactive session
npx @oas/devset check

# Output:
# 📦 Outdated Packages:
# ⚠ 3 packages are outdated
#   - commander: 11.1.0 → 14.0.0
#   - eslint: 8.57.1 → 9.34.0
#   - jest: 29.7.0 → 30.1.1
#
# Would you like to update these outdated packages? (y/n): y
# Do you want to update ALL outdated packages at once? (y/n): n
# Select which packages to update:
# 1. commander (11.1.0 → 14.0.0)
# 2. eslint (8.57.1 → 9.34.0)
# 3. jest (29.7.0 → 30.1.1)
# Enter numbers separated by commas (e.g., 1,3,5) or "all" for all packages:
# Your choice: 1,2
#
# ✓ Updated commander: 11.1.0 → 14.0.0
# ✓ Updated eslint: 8.57.1 → 9.34.0
# Do you want to install the updated packages now? (y/n): y
# Do you want to update configuration files to industry standards? (y/n): y
# ✓ Updated configuration files: ESLint configuration
# ✓ Package updates completed successfully!
```

### Stale Package Management

When running `devset check`, stale packages are automatically analyzed and categorized:

```bash
# Example stale package analysis
npx @oas/devset check

# Output:
# ⏰ Stale Packages:
# ✅ Safe stale packages (generally okay to keep):
#   - chalk (2 years old) - Terminal string styling done right...
#   - lodash (3 years old) - A modern JavaScript utility library...
#
# ⚠️ Packages that need attention:
#   - moment (1 year old)
#     💡 Alternatives available
#
# 🚨 Critical stale packages (recommend replacing):
#   - request (4 years old)
#     HTTP request library for Node.js...
#     💡 5 alternatives available
#
# Would you like to manage your stale packages? (y/n): y
#
# 🚨 Critical stale package: request
# Last updated: 4 years ago
# Description: HTTP request library for Node.js
#
# Recommended alternatives for request:
# 1. axios - Promise-based HTTP client
# 2. node-fetch - Fetch API for Node.js
# 3. got - Human-friendly HTTP request library
# 4. ky - Tiny HTTP client based on Fetch API
# 5. superagent - Small progressive client-side HTTP request library
# 6. Enter custom alternative
# 7. Keep current package
# Select an option (1-7): 1
#
# ✓ Removed request
# ✓ Installed axios
# ⚠ Please update your code to use axios instead of request
```

### CI/CD Integration

For use in continuous integration:

```yaml
# GitHub Actions example
- name: Run project health checks
  run: npx @oas/devset check --format json --no-interactive
```

## Automatic Configuration Updates

When updating packages through the interactive mode, @oas/devset can automatically update your configuration files to industry standards:

### ESLint Configuration

- Updates `.eslintrc.json` based on the ESLint version
- ESLint 9.x: Uses modern flat config format
- ESLint 8.x: Uses traditional config with Prettier integration
- Adds recommended rules for modern JavaScript development

### Jest Configuration

- Updates Jest configuration in `package.json`
- Adds coverage collection and reporting
- Sets up proper test file patterns
- Configures coverage directory and reporters

### Prettier Configuration

- Updates `.prettierrc` with modern formatting rules
- Sets consistent code style across the project
- Includes trailing commas, bracket spacing, and arrow function parens

## Built-in Package Alternative Database

DevEnv-CLI includes a comprehensive database of package alternatives for common stale packages:

### Testing Frameworks

- **mocha** → jest, vitest, tap, ava, jasmine
- **karma** → jest, vitest, web-test-runner, cypress, playwright

### Build Tools

- **gulp** → vite, webpack, rollup, parcel, esbuild
- **grunt** → npm-scripts, vite, webpack, rollup, just

### Utility Libraries

- **lodash** → ramda, rambda, underscore, native-methods, just
- **moment** → dayjs, date-fns, luxon, js-joda, native-date

### HTTP Clients

- **request** → axios, node-fetch, got, ky, superagent

### Linting Tools

- **jshint** → eslint, standard, xo, biome
- **tslint** → eslint + @typescript-eslint, biome

Each alternative includes a description to help you choose the best replacement for your project.

## Exit Codes

- `0` - Success, no critical issues found
- `1` - Critical issues found (security vulnerabilities, packages not updated in >2 years)

## Development

### Setup

```bash
git clone <repository-url>
cd devenv-cli
npm install
```

### Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

### Linting

```bash
# Check code style
npm run lint

# Fix linting issues
npm run lint:fix
```

## File Structure

```
@oas/devset/
├── bin/
│   └── devset               # CLI entrypoint
├── src/
│   ├── commands/
│   │   ├── init.js          # Init command implementation
│   │   ├── check.js         # Check command implementation
│   │   └── config.js        # Config wizard implementation
│   ├── config.js            # Configuration management
│   └── utils.js             # Shared utilities
├── tests/
│   ├── init.test.js         # Init command tests
│   └── check.test.js        # Check command tests
├── package.json
├── devenv.config.json       # Default configuration
└── README.md
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## License

MIT

## Requirements

- Node.js 16.0.0 or higher
- npm or yarn package manager
- Git (optional, for git-related features)
