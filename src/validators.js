/**
 * Validate package.json for common issues
 * @param {Object} packageJson - Package.json content
 * @returns {Array} Array of validation issues
 */
export function validatePackageJson(packageJson) {
  const issues = [];

  // Handle null or invalid input
  if (!packageJson || typeof packageJson !== 'object') {
    issues.push({
      type: 'error',
      message: 'Package.json is not a valid object',
      fix: 'Ensure package.json contains valid JSON object',
    });
    return issues;
  }

  // Check required fields
  const required = ['name', 'version', 'description'];
  required.forEach((field) => {
    if (!packageJson[field]) {
      issues.push({
        type: 'error',
        field,
        message: `Missing required field: ${field}`,
        fix: `Add "${field}" to your package.json`,
      });
    }
  });

  // Check for security issues
  if (packageJson.scripts) {
    Object.entries(packageJson.scripts).forEach(([name, script]) => {
      if (script.includes('sudo') || script.includes('rm -rf')) {
        issues.push({
          type: 'warning',
          field: 'scripts',
          message: `Potentially dangerous script: ${name}`,
          fix: 'Review script for security implications',
        });
      }
    });
  }

  // Check dependencies
  const allDeps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };

  if (Object.keys(allDeps).length === 0) {
    issues.push({
      type: 'info',
      field: 'dependencies',
      message: 'No dependencies found',
      fix: 'This might be intentional for a simple package',
    });
  }

  // Check for common typos
  const commonTypos = {
    dependancies: 'dependencies',
    devDependancies: 'devDependencies',
    autor: 'author',
    licence: 'license',
  };

  Object.keys(packageJson).forEach((key) => {
    if (commonTypos[key]) {
      issues.push({
        type: 'error',
        field: key,
        message: `Typo in field name: ${key}`,
        fix: `Rename to: ${commonTypos[key]}`,
      });
    }
  });

  return issues;
}

/**
 * Check if package name follows npm conventions
 * @param {string} name - Package name
 * @returns {Array} Array of naming issues
 */
export function validatePackageName(name) {
  const issues = [];

  if (!name) {
    issues.push({
      type: 'error',
      message: 'Package name is required',
      fix: 'Add a name field to package.json',
    });
    return issues;
  }

  if (name.length > 214) {
    issues.push({
      type: 'error',
      message: 'Package name too long (max 214 characters)',
      fix: 'Choose a shorter name',
    });
  }

  if (name !== name.toLowerCase()) {
    issues.push({
      type: 'error',
      message: 'Package name must be lowercase',
      fix: 'Convert name to lowercase',
    });
  }

  if (/[^a-z0-9\-_@/]/.test(name)) {
    issues.push({
      type: 'error',
      message: 'Package name contains invalid characters',
      fix: 'Use only lowercase letters, numbers, hyphens, underscores, and slashes',
    });
  }

  if (name.startsWith('.') || name.startsWith('_')) {
    issues.push({
      type: 'error',
      message: 'Package name cannot start with . or _',
      fix: 'Choose a different name',
    });
  }

  return issues;
}
