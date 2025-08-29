# @oas/devset Project Instructions

This is a Node.js CLI project that automates developer environment setup and project checks.

## Architecture Overview

**Core Components:**

- `bin/devset` - CLI entry point with Commander.js, includes global error handling and environment validation
- `src/commands/` - Command implementations (init, check, config) following action pattern
- `src/utils.js` - Shared utilities with 900+ lines including package analysis engine
- `src/config.js` - Configuration system with merge precedence: CLI flags > devenv.config.json > defaults
- `src/error-handler.js` - Centralized error handling with contextual suggestions
- `src/performance.js` - Performance monitoring utilities with timing metrics
- `src/validators.js` - Package.json and naming validation

## Critical Development Patterns

### ES Module + Jest Testing

Use `jest.unstable_mockModule()` for mocking ES modules in tests:

```javascript
jest.unstable_mockModule('../src/utils.js', () => ({
  fileExists: jest.fn(),
  analyzeStalePackages: jest.fn(),
}));
const { initCommand } = await import('../src/commands/init.js');
```

### Configuration Merging

Follow the 3-tier config system: `mergeConfigWithFlags(config, options)` handles CLI flags > config file > defaults.

### Command Structure

All commands follow this pattern:

1. Load and merge config
2. Validate options
3. Execute with progress indicators (ora spinners)
4. Handle both text and JSON output formats
5. Comprehensive error handling with `handleCommandError()`

### Package Analysis Engine

The `analyzeStalePackages()` function categorizes packages into safe/needsAttention/critical based on age and built-in alternatives database. When adding package alternatives, update the embedded database in utils.js.

## Critical Development Workflows

### Testing

```bash
npm test                    # Run Jest with ES module experimental flags
npm run test:coverage       # Coverage reports
npm run test:watch         # Watch mode
```

### Local Development

```bash
node bin/devset init --dry-run     # Test init without changes
node bin/devset check --no-interactive  # Test check in CI mode
```

### Integration Testing

Use `tests/integration.test.js` pattern with `createTempDir()` helper for filesystem tests. All CLI tests run with `NODE_OPTIONS: '--experimental-vm-modules'`.

## Project-Specific Conventions

### Error Handling

- Use `logError(error, context)` with structured context objects including suggestion, command, docs
- Implement `withErrorHandling(fn, context)` wrapper for async operations
- All commands must handle both interactive and CI modes (`--no-interactive`)

### Output Formatting

- Support both text and JSON output via `formatOutput(data, format)`
- Use chalk for colored output with semantic colors (green=success, yellow=warning, red=error)
- Progress indicators use ora with descriptive text updates

### Package Management

- Interactive package updates with user choice (all vs selective)
- Automatic config file updates (ESLint, Jest, Prettier) based on package versions
- Stale package categorization with built-in alternatives database

### CLI Design Principles

- All commands have aliases (init→i, check→c)
- Extensive help text with examples using `.addHelpText('after', ...)`
- Environment validation before command execution
- Graceful handling of git/non-git repositories

## Integration Points

- **npm/yarn**: Package analysis via `npm list`, `npm audit`, `npm outdated`
- **Git**: File change detection with `git diff --name-only`
- **Filesystem**: File template creation with atomic operations
- **Package registries**: Real-time package info fetching for alternatives

## Common Tasks

### Adding New Commands

1. Create command file in `src/commands/`
2. Add to `bin/devset` with proper error handling
3. Follow the config loading → validation → execution → output pattern
4. Add both unit tests (mocked) and integration tests

### Extending Package Analysis

Add entries to the alternatives database in `utils.js` and update the categorization logic in `analyzeStalePackages()`.

### Adding Configuration Options

Update `DEFAULT_CONFIG` in `config.js` and add corresponding CLI flags with `--no-*` pattern in command definitions.

### Phase 1: Core UX Improvements (HIGH PRIORITY)

- [ ] **Feature 1.1**: Enhanced Error Handling & Feedback
  - Add contextual error messages with suggestions
  - Implement logError utility with docs links
  - Add error recovery suggestions
  - Test: Trigger various errors and verify helpful output

- [ ] **Feature 1.2**: Command Aliases & Better Help
  - Add `i` alias for `init` command
  - Add `c` alias for `check` command
  - Add detailed examples to all commands
  - Test: Verify aliases work and help is comprehensive

- [ ] **Feature 1.3**: Progress Indicators
  - Add progress bars for long operations
  - Show spinner during package fetching
  - Add operation timing information
  - Test: Run check command and verify progress feedback

- [ ] **Feature 1.4**: Configuration Wizard
  - Add new `config` command for interactive setup
  - Implement step-by-step configuration guidance
  - Add config validation and preview
  - Test: Run config wizard and verify generated settings

### Phase 2: Advanced Features (MEDIUM PRIORITY)

- [ ] **Feature 2.1**: Template System
  - Add `template` command with list/apply/create subcommands
  - Implement common project templates (React, Node.js, etc.)
  - Add custom template creation
  - Test: Apply templates and verify generated structure

- [ ] **Feature 2.2**: CI/CD Integration Helpers
  - Add `ci` command with platform-specific configs
  - Generate GitHub Actions, GitLab CI, Azure Pipelines configs
  - Add conditional exit codes (--fail-on options)
  - Test: Generate CI configs and verify they work

- [ ] **Feature 2.3**: Enhanced Package Analysis
  - Add dependency tree analysis
  - Implement duplicate dependency detection
  - Add vulnerability detail fetching
  - Test: Analyze complex projects and verify insights

- [ ] **Feature 2.4**: Auto-fix Capabilities
  - Add --fix flag to automatically resolve issues
  - Implement safe auto-updates for packages
  - Add backup/restore functionality
  - Test: Auto-fix issues and verify safety

### Phase 3: Advanced Ecosystem (LOW PRIORITY)

- [ ] **Feature 3.1**: Plugin System
  - Design plugin architecture
  - Implement plugin loader and hook system
  - Create example plugins
  - Test: Load and execute custom plugins

- [ ] **Feature 3.2**: Statistics & Tracking
  - Add project health tracking over time
  - Implement `stats` command for insights
  - Add trend analysis
  - Test: Track stats across multiple runs

- [ ] **Feature 3.3**: Shell Completion
  - Add bash/zsh completion support
  - Implement dynamic completion for package names
  - Add completion installer
  - Test: Verify completion works in different shells

## Implementation Guidelines

1. **Test-Driven Development**: Implement each feature with comprehensive tests
2. **Incremental Rollout**: Complete and test each feature before moving to next
3. **User Feedback**: Ensure each feature improves actual developer workflow
4. **Documentation**: Update README and help text for each new feature
5. **Error Handling**: Every feature must have robust error handling
6. **Performance**: Monitor and optimize performance impact of new features

## Progress Tracking

### Core Project (Completed)

- [x] Verify that the copilot-instructions.md file in the .github directory is created
- [x] Clarify Project Requirements - Requirements are clearly specified
- [x] Scaffold the Project - Created complete project structure with all source files
- [x] Customize the Project - All features implemented as specified
- [x] Install Required Extensions - No extensions needed
- [x] Compile the Project - Dependencies installed and CLI working
- [x] Create and Run Task - Created demo task for testing CLI
- [x] Launch the Project - CLI is functional and tested
- [x] Ensure Documentation is Complete - README.md and instructions completed

### Phase 1: Core UX Improvements

- [x] Feature 1.1: Enhanced Error Handling & Feedback (COMPLETED)
- [x] Feature 1.2: Command Aliases & Better Help (COMPLETED)
- [x] Feature 1.3: Progress Indicators (COMPLETED)
- [x] Feature 1.4: Configuration Wizard (COMPLETED)

### Phase 2: Advanced Features

- [ ] Feature 2.1: Template System (IN PROGRESS)
- [ ] Feature 2.2: CI/CD Integration Helpers
- [ ] Feature 2.3: Enhanced Package Analysis
- [ ] Feature 2.4: Auto-fix Capabilities

### Phase 3: Advanced Ecosystem

- [ ] Feature 3.1: Plugin System
- [ ] Feature 3.2: Statistics & Tracking
- [ ] Feature 3.3: Shell Completion
