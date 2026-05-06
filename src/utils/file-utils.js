/**
 * Atomic file operations for safe writing
 */

import { writeFileSync, renameSync, existsSync, copyFileSync } from 'fs';
import { randomUUID } from 'crypto';

/**
 * Write file atomically using temp file + rename
 * @param {string} filePath - Target file path
 * @param {string} content - Content to write
 */
export function atomicWriteSync(filePath, content) {
  const tmpPath = filePath + '.tmp.' + randomUUID().slice(0, 8);
  try {
    writeFileSync(tmpPath, content, 'utf-8');
    renameSync(tmpPath, filePath);
  } catch (error) {
    // Clean up temp file if it exists
    try {
      if (existsSync(tmpPath)) {
        require('fs').unlinkSync(tmpPath);
      }
    } catch {}
    throw error;
  }
}

/**
 * Create backup file (only if it doesn't already exist)
 * @param {string} filePath - Original file path
 * @returns {boolean} True if backup was created, false if it already existed
 */
export function createBackup(filePath) {
  const backupPath = filePath + '.bak';
  if (!existsSync(backupPath)) {
    copyFileSync(filePath, backupPath);
    return true;
  }
  // If .bak already exists, the original is already preserved from first run
  return false;
}
