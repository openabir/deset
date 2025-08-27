# @oas/devset Project Instructions

This is a Node.js CLI project that automates developer environment setup and project checks.

## Project Overview

- Name: @oas/devset
- Purpose: Automate developer setup with consistent configs and checks
- Language: Node.js (ES Modules)
- CLI Framework: Commander.js
- Output styling: chalk
- Testing: Jest
- Package manager: npm

## Current Features

- `init` command: Sets up development environment with configurable features
- `check` command: Runs various project health checks with stale package analysis
- Configuration through devenv.config.json
- Support for feature toggles and command-line flags
- Interactive stale package management with alternatives database

## Developer Experience Enhancement Plan

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

## Current Focus

Starting with Feature 1.1: Enhanced Error Handling & Feedback
