# Contributing to @oas/deset

Thank you for your interest in contributing to @oas/deset! This document provides guidelines and information for contributors.

## Development Setup

1. **Fork and clone the repository:**

   ```bash
   git clone https://github.com/your-username/oas-devset.git
   cd oas-devset
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Run tests:**

   ```bash
   npm test
   npm run test:coverage
   ```

4. **Test the CLI locally:**
   ```bash
   node bin/deset --help
   node bin/deset init --dry-run
   ```

## Project Structure

```
src/
├── commands/           # Command implementations
│   ├── init.js        # Environment setup command
│   ├── check.js       # Health check command
│   └── config.js      # Configuration wizard
├── config.js          # Configuration management
├── utils.js           # Shared utilities & package database
├── error-handler.js   # Error handling & validation
├── performance.js     # Performance monitoring
└── validators.js      # Input validation
```

## Development Guidelines

### Code Style

- Use ES modules (import/export)
- Follow existing code style (ESLint + Prettier)
- Write descriptive function names and comments
- Keep functions focused and testable

### Testing

- Write tests for all new functionality
- Maintain 100% test coverage
- Include both unit tests and integration tests
- Mock external dependencies appropriately

### Adding New Features

1. **Commands**: Add to `src/commands/` and register in `bin/deset`
2. **Package alternatives**: Update the database in `src/utils.js`
3. **Configuration options**: Add to `DEFAULT_CONFIG` in `src/config.js`

## Common Development Tasks

### Adding a New Package Alternative

```javascript
// In src/utils.js, add to PACKAGE_ALTERNATIVES
'old-package': [
  { name: 'new-package', description: 'Modern replacement for old-package' },
  { name: 'alternative', description: 'Another option' }
],
```

### Adding a New Command

1. Create `src/commands/new-command.js`
2. Export an async function that follows the pattern
3. Add command definition in `bin/deset`
4. Write comprehensive tests

### Updating Configuration

1. Add new option to `DEFAULT_CONFIG` in `src/config.js`
2. Add CLI flag handling in command definitions
3. Update documentation in README.md

## Pull Request Process

1. **Create a feature branch:**

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes:**
   - Write code following the guidelines
   - Add/update tests
   - Update documentation

3. **Test thoroughly:**

   ```bash
   npm test
   npm run lint
   npm run format:check
   ```

4. **Commit with clear messages:**

   ```bash
   git commit -m "feat: add template system for project initialization"
   ```

5. **Submit a pull request:**
   - Provide clear description of changes
   - Reference related issues
   - Include testing instructions

## Commit Message Format

Use conventional commits:

- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation changes
- `style:` Code style changes
- `refactor:` Code refactoring
- `test:` Test additions/updates
- `chore:` Maintenance tasks

## Bug Reports

When reporting bugs, include:

1. **Environment information:**
   - Node.js version
   - npm version
   - Operating system
   - @oas/deset version

2. **Steps to reproduce:**
   - Clear, numbered steps
   - Expected vs actual behavior
   - Error messages or logs

3. **Minimal reproduction:**
   - Package.json content
   - Command used
   - Configuration files

## Feature Requests

For feature requests:

1. **Check existing issues** to avoid duplicates
2. **Describe the use case** and problem being solved
3. **Provide examples** of how the feature would be used
4. **Consider implementation complexity** and backwards compatibility

## Development Workflow

1. **Before starting work:**
   - Check if there's an existing issue
   - Discuss major changes in an issue first
   - Ensure you understand the scope

2. **During development:**
   - Write tests first (TDD approach recommended)
   - Keep commits focused and atomic
   - Update documentation as needed

3. **Before submitting:**
   - Run the full test suite
   - Test with real projects
   - Update CHANGELOG.md for significant changes

## Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Help newcomers and answer questions
- Collaborate openly and transparently

## Getting Help

- **Questions:** Open a GitHub discussion
- **Bugs:** Create a GitHub issue
- **Security:** Email security@oas.dev
- **General:** Join our community discussions

## Recognition

Contributors are recognized in:

- README.md contributors section
- CHANGELOG.md for significant contributions
- GitHub contributor graphs

Thank you for contributing to make @oas/deset better for everyone!
