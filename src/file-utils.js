import fs from 'fs/promises';
import path from 'path';

/**
 * Check if a file exists
 * @param {string} filePath - Path to the file
 * @returns {Promise<boolean>} True if file exists
 */
export async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Write a JSON file with pretty formatting
 * @param {string} filePath - Path to write the file
 * @param {Object} data - Data to write
 */
export async function writeJsonFile(filePath, data) {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2) + '\n');
}

/**
 * Write a text file
 * @param {string} filePath - Path to write the file
 * @param {string} content - Content to write
 */
export async function writeTextFile(filePath, content) {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(filePath, content);
}

/**
 * Read and parse package.json
 * @returns {Promise<Object>} Package.json content
 */
export async function readPackageJson() {
  try {
    const content = await fs.readFile('package.json', 'utf-8');
    return JSON.parse(content);
  } catch {
    throw new Error(
      `Could not read package.json. Make sure you are in a Node.js project directory.`
    );
  }
}

/**
 * Write package.json with updated content
 * @param {Object} packageData - Updated package.json data
 */
export async function writePackageJson(packageData) {
  await fs.writeFile('package.json', JSON.stringify(packageData, null, 2) + '\n');
}
