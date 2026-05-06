import matter from 'gray-matter';
import { readFileSync } from 'fs';
import path from 'path';

/**
 * Parse a SKILL.md file and extract frontmatter + triggers
 * @param {string} filePath - Path to SKILL.md file
 * @returns {Object} Parsed skill data
 */
export function parseSkillFile(filePath) {
  try {
    // Read file with UTF-8 encoding (handles BOM)
    const content = readFileSync(filePath, 'utf-8');
    
    // Parse frontmatter using gray-matter
    const parsed = matter(content);
    
    // Extract triggers from markdown body (section + inline)
    const sectionTriggers = extractTriggers(parsed.content);
    const inlineTriggers = extractInlineTriggerPhrases(parsed.content);
    const triggers = [...new Set([...sectionTriggers, ...inlineTriggers])];
    
    // Extract USE FOR / DO NOT USE FOR sections
    const useFor = extractSectionList(parsed.content, /^##\s+USE\s+FOR/i);
    const doNotUseFor = extractSectionList(parsed.content, /^##\s+DO\s+NOT\s+USE\s+FOR/i);
    
    // Get skill ID from directory name
    const skillId = path.basename(path.dirname(filePath));
    
    return {
      id: skillId,
      path: path.resolve(filePath),
      frontmatter: parsed.data || {},
      triggers: triggers,
      useFor: useFor,
      doNotUseFor: doNotUseFor,
      content: parsed.content
    };
  } catch (error) {
    // Return minimal object on error
    const skillId = path.basename(path.dirname(filePath));
    return {
      id: skillId,
      path: path.resolve(filePath),
      frontmatter: {},
      triggers: [],
      useFor: [],
      doNotUseFor: [],
      content: '',
      error: error.message
    };
  }
}

/**
 * Extract trigger phrases from markdown content
 * @param {string} content - Markdown content
 * @returns {Array<string>} Array of trigger phrases
 */
function extractTriggers(content) {
  const triggers = [];
  const lines = content.split('\n');
  let inTriggersSection = false;
  
  for (const line of lines) {
    // Check if we're entering the Triggers section
    if (line.match(/^##\s+Triggers/i)) {
      inTriggersSection = true;
      continue;
    }
    
    // Check if we're leaving the Triggers section (next ## heading)
    if (inTriggersSection && line.match(/^##\s+/)) {
      inTriggersSection = false;
      break;
    }
    
    // Extract trigger from list item
    if (inTriggersSection && line.trim().startsWith('-')) {
      const trigger = line
        .replace(/^-\s*/, '')
        .replace(/^["']/, '')
        .replace(/["']$/, '')
        .trim();
      
      if (trigger) {
        triggers.push(trigger);
      }
    }
  }
  
  return triggers;
}

/**
 * Extract inline trigger phrases from **Trigger phrases:** pattern
 * @param {string} content - Markdown content
 * @returns {Array<string>} Array of trigger phrases
 */
function extractInlineTriggerPhrases(content) {
  const triggers = [];
  const pattern = /\*\*Trigger phrases?:\*\*\s*(.+)/gi;
  let match;

  while ((match = pattern.exec(content)) !== null) {
    const raw = match[1].trim();
    const parts = raw.split(/[,;]/).map(s => s.trim()).filter(Boolean);
    for (const part of parts) {
      const cleaned = part
        .replace(/^["'\u201c\u201d]/, '')
        .replace(/["'\u201c\u201d]$/, '')
        .trim();
      if (cleaned) triggers.push(cleaned);
    }
  }

  return triggers;
}

/**
 * Extract list items from a markdown section by header pattern
 * @param {string} content - Markdown content
 * @param {RegExp} headerPattern - Pattern matching the section header
 * @returns {Array<string>} Items from the section
 */
function extractSectionList(content, headerPattern) {
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
 * Validate frontmatter structure
 * @param {Object} frontmatter - Parsed frontmatter
 * @returns {Object} Validation result
 */
export function validateFrontmatter(frontmatter) {
  const errors = [];
  
  if (!frontmatter.name) {
    errors.push({ field: 'name', message: 'Required field "name" is missing' });
  }
  
  if (!frontmatter.description) {
    errors.push({ field: 'description', message: 'Required field "description" is missing' });
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}
