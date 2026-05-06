/**
 * Migration helpers for skill file transformation
 */

/**
 * Extract inline trigger phrases from **Trigger phrases:** pattern
 * @param {string} content - Markdown body content
 * @returns {string[]} Extracted trigger phrases
 */
export function extractInlineTriggers(content) {
  const triggers = [];
  const pattern = /\*\*Trigger phrases?:\*\*\s*(.+)/gi;
  let match;

  while ((match = pattern.exec(content)) !== null) {
    const raw = match[1].trim();
    // Split on commas or semicolons, then clean quotes
    const parts = raw.split(/[,;]/).map(s => s.trim()).filter(Boolean);
    for (const part of parts) {
      const cleaned = part
        .replace(/^["'\u201c\u201d]/, '')
        .replace(/["'\u201c\u201d]$/, '')
        .trim();
      if (cleaned) {
        triggers.push(cleaned);
      }
    }
  }

  return triggers;
}

/**
 * Extract content from ## USE FOR section
 * @param {string} content - Markdown body content
 * @returns {string[]} Items from USE FOR section
 */
export function extractUseForItems(content) {
  return extractSectionItems(content, /^##\s+USE\s+FOR/i);
}

/**
 * Extract content from ## DO NOT USE FOR section
 * @param {string} content - Markdown body content
 * @returns {string[]} Items from DO NOT USE FOR section
 */
export function extractDoNotUseForItems(content) {
  return extractSectionItems(content, /^##\s+DO\s+NOT\s+USE\s+FOR/i);
}

/**
 * Extract list items from a markdown section
 * @param {string} content - Markdown body
 * @param {RegExp} headerPattern - Pattern for section header
 * @returns {string[]}
 */
function extractSectionItems(content, headerPattern) {
  const items = [];
  const lines = content.split('\n');
  let inSection = false;

  for (const line of lines) {
    if (headerPattern.test(line)) {
      inSection = true;
      continue;
    }
    if (inSection && /^##\s+/.test(line)) {
      break;
    }
    if (inSection && line.trim().startsWith('-')) {
      const item = line.replace(/^-\s*/, '').trim();
      if (item) items.push(item);
    }
  }

  return items;
}

/**
 * Extract triggers from ## Triggers section (same logic as parse.js)
 * @param {string} content - Markdown body
 * @returns {string[]}
 */
export function extractBodyTriggers(content) {
  const triggers = [];
  const lines = content.split('\n');
  let inSection = false;

  for (const line of lines) {
    if (/^##\s+Triggers/i.test(line)) {
      inSection = true;
      continue;
    }
    if (inSection && /^##\s+/.test(line)) {
      break;
    }
    if (inSection && line.trim().startsWith('-')) {
      const trigger = line
        .replace(/^-\s*/, '')
        .replace(/^["']/, '')
        .replace(/["']$/, '')
        .trim();
      if (trigger) triggers.push(trigger);
    }
  }

  return triggers;
}

/**
 * Infer tags from USE FOR section keywords
 * @param {string[]} useForItems - Items from USE FOR section
 * @returns {string[]} Inferred tags
 */
export function inferTags(useForItems) {
  if (!useForItems || useForItems.length === 0) return [];

  const tags = [];
  const seen = new Set();

  for (const item of useForItems) {
    // Extract meaningful keywords (lowercase, deduplicated)
    const words = item
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2 && !STOP_WORDS.has(w));

    for (const word of words) {
      if (!seen.has(word)) {
        seen.add(word);
        tags.push(word);
      }
    }
  }

  return tags.slice(0, 10); // Cap at 10 tags
}

/**
 * Infer category from domain + name patterns
 * @param {string} domain - Skill domain
 * @param {string} name - Skill name
 * @returns {string|null} Inferred category
 */
export function inferCategory(domain, name) {
  if (!domain && !name) return null;

  const combined = `${domain || ''} ${name || ''}`.toLowerCase();

  for (const [pattern, category] of CATEGORY_PATTERNS) {
    if (pattern.test(combined)) return category;
  }

  // Fallback: use domain as category
  return domain || null;
}

/**
 * Build the migrated frontmatter object (never removes existing data)
 * @param {Object} existing - Existing frontmatter
 * @param {Object} options - Migration options
 * @param {string[]} bodyTriggers - Triggers from body section
 * @param {string[]} inlineTriggers - Triggers from inline pattern
 * @param {string[]} useForItems - Items from USE FOR section
 * @returns {Object} Migrated frontmatter
 */
export function buildMigratedFrontmatter(existing, options, bodyTriggers, inlineTriggers, useForItems) {
  const migrated = { ...existing };

  // Add status default if missing
  if (options.addDefaults && !migrated.status) {
    migrated.status = 'active';
  }

  // Infer tags from USE FOR
  if (options.inferTags && useForItems.length > 0 && (!migrated.tags || migrated.tags.length === 0)) {
    migrated.tags = inferTags(useForItems);
  }

  // Infer category
  if (options.addDefaults && !migrated.category) {
    const category = inferCategory(migrated.domain, migrated.name);
    if (category) migrated.category = category;
  }

  // Promote triggers into frontmatter
  if (options.promoteTriggers) {
    const allTriggers = new Set([
      ...(migrated.triggers || []),
      ...bodyTriggers,
      ...inlineTriggers,
    ]);
    if (allTriggers.size > 0) {
      migrated.triggers = [...allTriggers];
    }
  }

  return migrated;
}

/**
 * Convert inline trigger text to a proper ## Triggers section
 * @param {string} content - Markdown body
 * @param {string[]} inlineTriggers - Extracted inline triggers
 * @returns {string} Updated content with ## Triggers section
 */
export function convertInlineToTriggersSection(content, inlineTriggers) {
  if (inlineTriggers.length === 0) return content;

  // Remove the inline trigger line(s)
  const cleaned = content.replace(/\*\*Trigger phrases?:\*\*\s*.+\n?/gi, '');

  // Check if ## Triggers section already exists
  if (/^##\s+Triggers/im.test(cleaned)) {
    // Append to existing section
    const lines = cleaned.split('\n');
    const result = [];
    let inSection = false;
    let appended = false;

    for (const line of lines) {
      if (/^##\s+Triggers/i.test(line)) {
        inSection = true;
        result.push(line);
        continue;
      }
      if (inSection && /^##\s+/.test(line)) {
        // End of triggers section — insert before next heading
        if (!appended) {
          for (const t of inlineTriggers) {
            result.push(`- "${t}"`);
          }
          appended = true;
        }
        inSection = false;
      }
      result.push(line);
    }
    // If triggers section was last, append at end
    if (inSection && !appended) {
      for (const t of inlineTriggers) {
        result.push(`- "${t}"`);
      }
    }
    return result.join('\n');
  }

  // No existing section — create one at the top of body
  const triggersSection = `\n## Triggers\n${inlineTriggers.map(t => `- "${t}"`).join('\n')}\n`;
  return triggersSection + cleaned;
}

/**
 * Generate a diff summary between original and migrated frontmatter
 * @param {Object} original - Original frontmatter
 * @param {Object} migrated - Migrated frontmatter
 * @returns {Object[]} Array of change descriptions
 */
export function generateDiff(original, migrated) {
  const changes = [];

  for (const [key, value] of Object.entries(migrated)) {
    if (!(key in original)) {
      changes.push({ field: key, type: 'added', value });
    } else if (JSON.stringify(original[key]) !== JSON.stringify(value)) {
      changes.push({ field: key, type: 'modified', from: original[key], to: value });
    }
  }

  return changes;
}

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'are', 'was',
  'will', 'can', 'has', 'have', 'not', 'but', 'all', 'any', 'when',
  'use', 'used', 'using', 'into', 'about',
]);

const CATEGORY_PATTERNS = [
  [/deploy|ci|cd|pipeline|build/, 'devops'],
  [/doc|content|article|writing/, 'documentation'],
  [/test|spec|coverage/, 'testing'],
  [/infra|infrastructure|server|cloud/, 'infrastructure'],
  [/security|auth|permission/, 'security'],
  [/api|endpoint|rest|graphql/, 'api'],
  [/data|database|query|sql/, 'data'],
  [/review|audit|check/, 'review'],
  [/ux|ui|design|css|style/, 'design'],
  [/monitor|alert|log|observ/, 'observability'],
];
