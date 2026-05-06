import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'fs';
import { glob } from 'glob';
import path from 'path';
import matter from 'gray-matter';
import { fileURLToPath } from 'url';
import {
  extractInlineTriggers,
  extractBodyTriggers,
  extractUseForItems,
  buildMigratedFrontmatter,
  convertInlineToTriggersSection,
  generateDiff,
} from '../utils/migrate-helpers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Default migration options
 */
const DEFAULT_OPTIONS = {
  promoteTriggers: false,
  inferTags: true,
  addDefaults: true,
};

/**
 * Load configuration for skill directories
 */
function loadConfig(cwd) {
  const configPath = path.join(cwd, '.github', 'skills-catalog.json');
  const defaults = { skills_directories: ['.copilot/skills'] };

  if (existsSync(configPath)) {
    try {
      const content = readFileSync(configPath, 'utf-8');
      return { ...defaults, ...JSON.parse(content) };
    } catch {
      return defaults;
    }
  }
  return defaults;
}

/**
 * Discover all SKILL.md files
 */
function discoverSkills(config, cwd) {
  const skillFiles = [];
  for (const dir of config.skills_directories) {
    const pattern = path.join(cwd, dir, '**', 'SKILL.md').replace(/\\/g, '/');
    try {
      const files = glob.sync(pattern, { nocase: true });
      skillFiles.push(...files);
    } catch {
      // Skip inaccessible directories
    }
  }
  return skillFiles;
}

/**
 * Analyze a single skill file and produce a migration report
 * @param {string} filePath - Path to SKILL.md
 * @param {Object} options - Migration options
 * @returns {Object} Analysis result for this skill
 */
export function analyzeSkill(filePath, options = DEFAULT_OPTIONS) {
  const content = readFileSync(filePath, 'utf-8');
  const parsed = matter(content);
  const frontmatter = parsed.data || {};
  const body = parsed.content || '';

  const skillId = path.basename(path.dirname(filePath));

  // Extract all trigger sources
  const bodyTriggers = extractBodyTriggers(body);
  const inlineTriggers = extractInlineTriggers(body);
  const useForItems = extractUseForItems(body);

  // Build what the migrated frontmatter would look like
  const migrated = buildMigratedFrontmatter(
    frontmatter,
    options,
    bodyTriggers,
    inlineTriggers,
    useForItems
  );

  // Determine content changes
  let contentChanged = false;
  let newBody = body;
  if (inlineTriggers.length > 0) {
    newBody = convertInlineToTriggersSection(body, inlineTriggers);
    contentChanged = newBody !== body;
  }

  // Calculate diff
  const changes = generateDiff(frontmatter, migrated);

  return {
    id: skillId,
    path: filePath,
    currentFrontmatter: frontmatter,
    migratedFrontmatter: migrated,
    changes,
    contentChanged,
    inlineTriggers,
    bodyTriggers,
    useForItems,
    needsMigration: changes.length > 0 || contentChanged,
  };
}

/**
 * Apply migration to a single skill file
 * @param {string} filePath - Path to SKILL.md
 * @param {Object} options - Migration options
 * @param {boolean} backup - Whether to create backup
 * @returns {Object} Result of migration
 */
export function applyMigration(filePath, options = DEFAULT_OPTIONS, backup = true) {
  const analysis = analyzeSkill(filePath, options);

  if (!analysis.needsMigration) {
    return { ...analysis, applied: false, reason: 'No changes needed' };
  }

  // Create backup
  if (backup) {
    const backupPath = filePath + '.bak';
    copyFileSync(filePath, backupPath);
  }

  // Read original and rebuild
  const content = readFileSync(filePath, 'utf-8');
  const parsed = matter(content);
  let body = parsed.content || '';

  // Apply content transformation (inline triggers -> ## Triggers section)
  if (analysis.inlineTriggers.length > 0) {
    body = convertInlineToTriggersSection(body, analysis.inlineTriggers);
  }

  // If promoting triggers to frontmatter, remove ## Triggers from body
  if (options.promoteTriggers) {
    body = removeTriggersSection(body);
  }

  // Rebuild the file with gray-matter stringify
  const output = matter.stringify(body, analysis.migratedFrontmatter);
  writeFileSync(filePath, output, 'utf-8');

  return { ...analysis, applied: true };
}

/**
 * Remove ## Triggers section from body (used when promoting to frontmatter)
 */
function removeTriggersSection(content) {
  const lines = content.split('\n');
  const result = [];
  let inSection = false;

  for (const line of lines) {
    if (/^##\s+Triggers/i.test(line)) {
      inSection = true;
      continue;
    }
    if (inSection && /^##\s+/.test(line)) {
      inSection = false;
      result.push(line);
      continue;
    }
    if (!inSection) {
      result.push(line);
    }
  }

  return result.join('\n');
}

/**
 * Main migrate tool entry point
 * @param {string|null} skillPath - Specific path or null for all
 * @param {string} mode - "report" or "apply"
 * @param {Object} options - Migration options
 * @param {string} cwd - Working directory
 * @returns {Object} Migration results
 */
export function migrateSkills(skillPath = null, mode = 'report', options = {}, cwd = process.cwd()) {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };

  // Validate mode early
  if (mode !== 'report' && mode !== 'apply') {
    return { error: `Invalid mode: ${mode}. Use "report" or "apply".` };
  }

  // Discover files
  let files;
  if (skillPath) {
    const resolved = path.resolve(cwd, skillPath);
    if (!existsSync(resolved)) {
      return { error: `File not found: ${resolved}` };
    }
    files = [resolved];
  } else {
    const config = loadConfig(cwd);
    files = discoverSkills(config, cwd);
  }

  if (files.length === 0) {
    return {
      mode,
      totalSkills: 0,
      needsMigration: 0,
      results: [],
      summary: 'No skill files found',
    };
  }

  if (mode === 'report') {
    const results = files.map(f => analyzeSkill(f, mergedOptions));
    const needing = results.filter(r => r.needsMigration);

    return {
      mode: 'report',
      totalSkills: results.length,
      needsMigration: needing.length,
      upToDate: results.length - needing.length,
      results: results.map(r => ({
        id: r.id,
        path: r.path,
        needsMigration: r.needsMigration,
        changes: r.changes,
        contentChanged: r.contentChanged,
        inlineTriggers: r.inlineTriggers,
        useForItems: r.useForItems,
      })),
      summary: `${needing.length}/${results.length} skills need migration`,
    };
  }

  if (mode === 'apply') {
    const results = files.map(f => applyMigration(f, mergedOptions, true));
    const applied = results.filter(r => r.applied);

    return {
      mode: 'apply',
      totalSkills: results.length,
      migrated: applied.length,
      skipped: results.length - applied.length,
      results: results.map(r => ({
        id: r.id,
        path: r.path,
        applied: r.applied,
        changes: r.changes,
        reason: r.reason || null,
      })),
      summary: `Migrated ${applied.length}/${results.length} skills (backups created)`,
    };
  }
}
