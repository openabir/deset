import { PackageIntegrityChecker } from './src/security/package-integrity.js';

const checker = new PackageIntegrityChecker();

const suspiciousNames = [
  'lodddash', // Typosquatting (multiple l's)
  'crypto-miner', // Suspicious keywords
  'admin-tool', // Privileged terms  
  'exploit123', // Malicious terms
  'a1234567890', // Long numbers
];

console.log('Testing suspicious package patterns:');
for (const name of suspiciousNames) {
  const result = checker.isSuspiciousPackageName(name);
  console.log(`${name}: ${result}`);
}
