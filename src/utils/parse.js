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
    
    // Extract triggers from markdown body
    const triggers = extractTriggers(parsed.content);
    
    // Get skill ID from directory name
    const skillId = path.basename(path.dirname(filePath));
    
    return {
      id: skillId,
      path: path.resolve(filePath),
      frontmatter: parsed.data || {},
      triggers: triggers,
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
