import { exec } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';
import { loadConfig, mergeConfigWithFlags } from '../config.js';
import {
  readPackageJson,
  getChangedFiles,
  isGitRepo,
  log,
  formatOutput,
  askYesNo,
  askMultipleChoice,
  updatePackageVersions,
  installUpdatedPackages,
  updateConfigFiles,
  analyzeStalePackages,
  handleStalePackageManagement,
  logError,
  ProgressIndicator,
} from '../utils.js';

const execAsync = promisify(exec);

/**
 * Run various project health checks
 * @param {Object} options - Command options
 */
export async function checkCommand(options) {
  try {
    // Load and merge configuration
    const baseConfig = await loadConfig();
    const config = mergeConfigWithFlags(baseConfig, options);

    const results = {
      audit: null,
      outdated: null,
      stale: null,
      summary: {
        critical: 0,
        warnings: 0,
        total: 0,
      },
    };

    let exitCode = 0;

    // Run audit check
    if (config.features.audit) {
      const auditProgress = new ProgressIndicator('Running security audit');
      try {
        auditProgress.start();
        results.audit = await runAuditCheck();
        auditProgress.complete('Security audit complete');
        results.summary.total++;

        if (results.audit.critical > 0) {
          results.summary.critical++;
          exitCode = 1;
        }
        if (results.audit.warnings > 0) {
          results.summary.warnings++;
        }
      } catch (error) {
        auditProgress.fail('Security audit failed');
        logError(error, {
          suggestion: 'Check your npm installation and internet connectivity',
          command: 'npm audit',
          docs: 'https://docs.npmjs.com/cli/v8/commands/npm-audit',
        });
        results.audit = { error: error.message };
        exitCode = 1;
      }
    }

    // Run outdated check
    const outdatedProgress = new ProgressIndicator('Checking for outdated packages');
    try {
      outdatedProgress.start();
      results.outdated = await runOutdatedCheck();
      outdatedProgress.complete('Outdated check complete');
      results.summary.total++;

      if (results.outdated.packages.length > 0) {
        results.summary.warnings++;
      }
    } catch (error) {
      outdatedProgress.fail('Outdated check failed');
      logError(error, {
        suggestion: 'Try running npm outdated manually to debug the issue',
        command: 'npm outdated',
        docs: 'https://docs.npmjs.com/cli/v8/commands/npm-outdated',
      });
      results.outdated = { error: error.message };
    }

    // Run stale package check
    if (config.features.staleCheck) {
      const staleProgress = new ProgressIndicator('Checking for stale packages');
      try {
        staleProgress.start();
        results.stale = await runStaleCheck();
        staleProgress.complete('Stale package check complete');
        results.summary.total++;

        // Analyze stale packages for detailed recommendations
        if (results.stale.critical.length > 0 || results.stale.warnings.length > 0) {
          const analysisProgress = new ProgressIndicator('Analyzing stale packages');
          analysisProgress.start();
          results.staleAnalysis = await analyzeStalePackages([
            ...results.stale.critical,
            ...results.stale.warnings,
          ]);
          analysisProgress.complete('Stale package analysis complete');
        }

        if (results.stale.critical.length > 0) {
          results.summary.critical++;
          exitCode = 1;
        }
        if (results.stale.warnings.length > 0) {
          results.summary.warnings++;
        }
      } catch (error) {
        staleProgress.fail('Stale package check failed');
        logError(error, {
          suggestion: 'Check your package.json file and npm registry connectivity',
          command: 'npm list --depth=0',
          docs: 'https://docs.npmjs.com/cli/v8/commands/npm-list',
        });
        results.stale = { error: error.message };
      }
    }

    // Handle changed-only option
    if (options.changedOnly) {
      if (await isGitRepo()) {
        const changedFiles = await getChangedFiles();
        if (changedFiles.length === 0) {
          log('info', 'No changed files detected');
          results.changedFiles = [];
        } else {
          log('info', `Found ${changedFiles.length} changed files`);
          results.changedFiles = changedFiles;
        }
      } else {
        log('warning', 'Not in a git repository, ignoring --changed-only flag');
      }
    }

    // Output results
    if (options.format === 'json') {
      console.log(formatOutput(results, 'json'));
    } else {
      await displayTextResults(results, options);
    }

    process.exit(exitCode);
  } catch (error) {
    // Enhanced error handling with contextual suggestions
    if (error.code === 'ENOENT' && error.path?.includes('package.json')) {
      logError(error, {
        suggestion: 'Make sure you are in a Node.js project directory',
        command: 'npm init',
        docs: 'https://docs.npmjs.com/creating-a-package-json-file',
        recoverable: true,
      });
    } else if (error.message.includes('npm audit')) {
      logError(error, {
        suggestion: 'Try running npm audit manually to see detailed output',
        command: 'npm audit --audit-level=moderate',
        docs: 'https://docs.npmjs.com/cli/v8/commands/npm-audit',
      });
    } else if (error.message.includes('outdated')) {
      logError(error, {
        suggestion: 'Try running npm outdated manually to check for issues',
        command: 'npm outdated',
        docs: 'https://docs.npmjs.com/cli/v8/commands/npm-outdated',
      });
    } else {
      logError(error, {
        suggestion: 'Check that npm is installed and you have internet connectivity',
        command: 'npm --version',
        docs: 'https://docs.npmjs.com/downloading-and-installing-node-js-and-npm',
      });
    }
    process.exit(1);
  }
}

/**
 * Run npm audit check
 * @returns {Promise<Object>} Audit results
 */
async function runAuditCheck() {
  try {
    const { stdout } = await execAsync('npm audit --json');
    const auditData = JSON.parse(stdout);

    const vulnerabilities = auditData.vulnerabilities || {};
    const summary = {
      critical: 0,
      high: 0,
      moderate: 0,
      low: 0,
      info: 0,
      total: 0,
    };

    // Count vulnerabilities by severity
    Object.values(vulnerabilities).forEach((vuln) => {
      if (vuln.severity) {
        summary[vuln.severity] = (summary[vuln.severity] || 0) + 1;
        summary.total++;
      }
    });

    return {
      ...summary,
      vulnerabilities: Object.keys(vulnerabilities).map((name) => ({
        name,
        severity: vulnerabilities[name].severity,
        via: vulnerabilities[name].via,
      })),
    };
  } catch (error) {
    // npm audit returns exit code 1 when vulnerabilities are found
    if (error.stdout) {
      const auditData = JSON.parse(error.stdout);
      const vulnerabilities = auditData.vulnerabilities || {};
      const summary = {
        critical: 0,
        high: 0,
        moderate: 0,
        low: 0,
        info: 0,
        total: 0,
        warnings: 0,
      };

      Object.values(vulnerabilities).forEach((vuln) => {
        if (vuln.severity) {
          summary[vuln.severity] = (summary[vuln.severity] || 0) + 1;
          summary.total++;
          if (['critical', 'high'].includes(vuln.severity)) {
            summary.warnings++;
          }
        }
      });

      return {
        ...summary,
        vulnerabilities: Object.keys(vulnerabilities).map((name) => ({
          name,
          severity: vulnerabilities[name].severity,
          via: vulnerabilities[name].via,
        })),
      };
    }
    throw error;
  }
}

/**
 * Run npm outdated check
 * @returns {Promise<Object>} Outdated packages results
 */
async function runOutdatedCheck() {
  try {
    const { stdout } = await execAsync('npm outdated --json');
    const outdatedData = JSON.parse(stdout || '{}');

    const packages = Object.keys(outdatedData).map((name) => ({
      name,
      current: outdatedData[name].current,
      wanted: outdatedData[name].wanted,
      latest: outdatedData[name].latest,
      location: outdatedData[name].location,
    }));

    return {
      count: packages.length,
      packages,
    };
  } catch (error) {
    // npm outdated returns exit code 1 when outdated packages are found
    if (error.stdout) {
      const outdatedData = JSON.parse(error.stdout || '{}');
      const packages = Object.keys(outdatedData).map((name) => ({
        name,
        current: outdatedData[name].current,
        wanted: outdatedData[name].wanted,
        latest: outdatedData[name].latest,
        location: outdatedData[name].location,
      }));

      return {
        count: packages.length,
        packages,
      };
    }

    return {
      count: 0,
      packages: [],
    };
  }
}

/**
 * Check for stale packages (not updated in >1 year)
 * @returns {Promise<Object>} Stale packages results
 */
async function runStaleCheck() {
  const packageJson = await readPackageJson();
  const dependencies = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };

  const now = new Date();
  const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  const twoYearsAgo = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());

  const warnings = [];
  const critical = [];
  const errors = [];

  for (const [packageName, version] of Object.entries(dependencies)) {
    try {
      const lastPublished = await getPackageLastPublished(packageName);

      if (lastPublished < twoYearsAgo) {
        critical.push({
          name: packageName,
          version,
          lastPublished: lastPublished.toISOString(),
          daysSince: Math.floor((now - lastPublished) / (1000 * 60 * 60 * 24)),
        });
      } else if (lastPublished < oneYearAgo) {
        warnings.push({
          name: packageName,
          version,
          lastPublished: lastPublished.toISOString(),
          daysSince: Math.floor((now - lastPublished) / (1000 * 60 * 60 * 24)),
        });
      }
    } catch (error) {
      errors.push({
        name: packageName,
        error: error.message,
      });
    }
  }

  return {
    critical,
    warnings,
    errors,
    totalChecked: Object.keys(dependencies).length,
  };
}

/**
 * Get the last published date of a package from npm registry
 * @param {string} packageName - Name of the package
 * @returns {Promise<Date>} Last published date
 */
async function getPackageLastPublished(packageName) {
  try {
    const response = await fetch(`https://registry.npmjs.org/${packageName}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const versions = Object.keys(data.versions);
    const latestVersion = versions[versions.length - 1];
    const publishTime = data.time[latestVersion];

    return new Date(publishTime);
  } catch (error) {
    throw new Error(`Could not fetch package info: ${error.message}`);
  }
}

/**
 * Display results in text format
 * @param {Object} results - Check results
 * @param {Object} options - Command options
 */
async function displayTextResults(results, options = {}) {
  console.log(chalk.cyan('\n📊 Project Health Check Results\n'));

  // Audit results
  if (results.audit) {
    if (results.audit.error) {
      log('error', `Audit check failed: ${results.audit.error}`);
    } else {
      console.log(chalk.blue('🔒 Security Audit:'));
      if (results.audit.total === 0) {
        log('success', 'No vulnerabilities found');
      } else {
        if (results.audit.critical > 0) {
          log('error', `${results.audit.critical} critical vulnerabilities`);
        }
        if (results.audit.high > 0) {
          log('warning', `${results.audit.high} high severity vulnerabilities`);
        }
        if (results.audit.moderate > 0) {
          log('warning', `${results.audit.moderate} moderate severity vulnerabilities`);
        }
        if (results.audit.low > 0) {
          log('info', `${results.audit.low} low severity vulnerabilities`);
        }
      }
      console.log();
    }
  }

  // Outdated packages
  if (results.outdated) {
    if (results.outdated.error) {
      log('warning', `Outdated check failed: ${results.outdated.error}`);
    } else {
      console.log(chalk.blue('📦 Outdated Packages:'));
      if (results.outdated.count === 0) {
        log('success', 'All packages are up to date');
      } else {
        log('warning', `${results.outdated.count} packages are outdated`);
        results.outdated.packages.forEach((pkg) => {
          console.log(chalk.gray(`  - ${pkg.name}: ${pkg.current} → ${pkg.latest}`));
        });

        // Ask if user wants to update packages (only in interactive mode)
        if (
          !options.format &&
          process.stdout.isTTY &&
          results.outdated.packages.length > 0 &&
          options.interactive !== false
        ) {
          console.log();
          const shouldUpdate = await askYesNo('Would you like to update these outdated packages?');

          if (shouldUpdate) {
            await handlePackageUpdates(results.outdated.packages);
          }
        }
      }
      console.log();
    }
  }

  // Stale packages
  if (results.stale) {
    if (results.stale.error) {
      log('warning', `Stale check failed: ${results.stale.error}`);
    } else {
      console.log(chalk.blue('⏰ Stale Packages:'));
      if (results.stale.critical.length === 0 && results.stale.warnings.length === 0) {
        log('success', 'No stale packages found');
      } else {
        // Show detailed stale package analysis
        if (results.staleAnalysis) {
          await displayStalePackageAnalysis(results.staleAnalysis, options);
        } else {
          // Fallback to basic display
          if (results.stale.critical.length > 0) {
            log('error', `${results.stale.critical.length} packages not updated in >2 years`);
          }
          if (results.stale.warnings.length > 0) {
            log('warning', `${results.stale.warnings.length} packages not updated in >1 year`);
          }
        }
      }
      console.log();
    }
  }

  // Summary
  console.log(chalk.cyan('📋 Summary:'));
  if (results.summary.critical > 0) {
    log('error', `${results.summary.critical} critical issues found`);
  }
  if (results.summary.warnings > 0) {
    log('warning', `${results.summary.warnings} warnings found`);
  }
  if (results.summary.critical === 0 && results.summary.warnings === 0) {
    log('success', 'No issues found');
  }
}

/**
 * Handle interactive package updates
 * @param {Array} outdatedPackages - Array of outdated packages
 */
async function handlePackageUpdates(outdatedPackages) {
  try {
    console.log();
    const updateAll = await askYesNo('Do you want to update ALL outdated packages at once?');

    let packagesToUpdate = [];

    if (updateAll) {
      packagesToUpdate = outdatedPackages.map((pkg) => pkg.name);
    } else {
      // Let user select specific packages
      const packageOptions = outdatedPackages.map(
        (pkg) => `${pkg.name} (${pkg.current} → ${pkg.latest})`
      );

      const selectedOptions = await askMultipleChoice(
        'Select which packages to update:',
        packageOptions
      );

      // Extract package names from selected options
      packagesToUpdate = selectedOptions.map((option) => {
        const packageName = option.split(' ')[0];
        return packageName;
      });
    }

    if (packagesToUpdate.length === 0) {
      log('info', 'No packages selected for update');
      return;
    }

    console.log();
    log('info', `Updating ${packagesToUpdate.length} package(s)...`);

    // Update package.json with new versions
    await updatePackageVersions(packagesToUpdate, outdatedPackages);

    // Ask if user wants to install the updates
    const shouldInstall = await askYesNo('Do you want to install the updated packages now?');

    if (shouldInstall) {
      await installUpdatedPackages();

      // Ask if user wants to update config files
      const shouldUpdateConfigs = await askYesNo(
        'Do you want to update configuration files to industry standards?'
      );

      if (shouldUpdateConfigs) {
        await updateConfigFiles(packagesToUpdate);
      }

      console.log();
      log('success', 'Package updates completed successfully!');
    } else {
      log(
        'info',
        'Package.json has been updated. Run "npm install" manually to install the new versions.'
      );
    }
  } catch (error) {
    log('error', `Failed to update packages: ${error.message}`);
  }
}

/**
 * Display detailed stale package analysis
 * @param {Object} staleAnalysis - Stale package analysis results
 * @param {Object} options - Command options
 */
async function displayStalePackageAnalysis(staleAnalysis, options = {}) {
  // Display safe packages
  if (staleAnalysis.safe.length > 0) {
    console.log(chalk.green('✅ Safe stale packages (generally okay to keep):'));
    staleAnalysis.safe.forEach((pkg) => {
      const yearsOld = Math.floor(pkg.daysSince / 365);
      console.log(
        chalk.gray(
          `  - ${pkg.name} (${yearsOld} year${yearsOld > 1 ? 's' : ''} old) - ${pkg.description.substring(0, 60)}...`
        )
      );
    });
    console.log();
  }

  // Display packages that need attention
  if (staleAnalysis.needsAttention.length > 0) {
    console.log(chalk.yellow('⚠️ Packages that need attention:'));
    staleAnalysis.needsAttention.forEach((pkg) => {
      const monthsOld = Math.floor(pkg.daysSince / 30);
      console.log(chalk.gray(`  - ${pkg.name} (${monthsOld} months old)`));
      if (pkg.alternatives) {
        console.log(chalk.blue(`    💡 Alternatives available`));
      }
    });
    console.log();
  }

  // Display critical packages
  if (staleAnalysis.critical.length > 0) {
    console.log(chalk.red('🚨 Critical stale packages (recommend replacing):'));
    staleAnalysis.critical.forEach((pkg) => {
      const yearsOld = Math.floor(pkg.daysSince / 365);
      console.log(chalk.red(`  - ${pkg.name} (${yearsOld} year${yearsOld > 1 ? 's' : ''} old)`));
      console.log(chalk.gray(`    ${pkg.description.substring(0, 80)}...`));

      if (pkg.deprecated) {
        console.log(chalk.red('    ⚠️ DEPRECATED PACKAGE'));
      }

      if (pkg.alternatives) {
        console.log(
          chalk.blue(
            `    💡 ${Object.keys(staleAnalysis.alternatives[pkg.name] || {}).length || 5} alternatives available`
          )
        );
      }
    });
    console.log();
  }

  // Show summary with recommendations
  const totalCritical = staleAnalysis.critical.length;
  const totalNeedsAttention = staleAnalysis.needsAttention.length;
  const totalSafe = staleAnalysis.safe.length;

  console.log(chalk.cyan('📋 Stale Package Summary:'));
  if (totalCritical > 0) {
    log(
      'error',
      `${totalCritical} critical package${totalCritical > 1 ? 's' : ''} need${totalCritical === 1 ? 's' : ''} immediate attention`
    );
  }
  if (totalNeedsAttention > 0) {
    log(
      'warning',
      `${totalNeedsAttention} package${totalNeedsAttention > 1 ? 's' : ''} should be reviewed`
    );
  }
  if (totalSafe > 0) {
    log('info', `${totalSafe} stale package${totalSafe > 1 ? 's are' : ' is'} safe to keep`);
  }

  // Offer interactive management in TTY mode
  if (!options.format && process.stdout.isTTY && options.interactive !== false) {
    if (totalCritical > 0 || totalNeedsAttention > 0) {
      await handleStalePackageManagement(staleAnalysis);
    }
  }
}
