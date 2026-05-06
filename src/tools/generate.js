import { mkdirSync, writeFileSync, existsSync } from 'fs';
import path from 'path';

/**
 * Generate a new SKILL.md file from parameters
 * @param {string} name - Skill name
 * @param {string} description - Skill description
 * @param {string} domain - Domain/category
 * @param {Array<string>} triggers - Trigger phrases
 * @param {string} cwd - Current working directory
 * @returns {Object} Result with path and content
 */
export function generateSkill(name, description, domain, triggers = [], cwd = process.cwd()) {
  // Sanitize name for directory
  const dirName = name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
  const skillDir = path.join(cwd, '.copilot', 'skills', dirName);
  const skillPath = path.join(skillDir, 'SKILL.md');
  
  // Check if skill already exists
  if (existsSync(skillPath)) {
    return {
      success: false,
      error: `Skill already exists at ${skillPath}`,
      path: skillPath
    };
  }
  
  // Generate frontmatter
  const frontmatter = {
    name,
    description,
    domain: domain || 'general',
    confidence: 'low',
    source: 'generated',
    status: 'experimental'
  };
  
  // Generate triggers section
  const triggersSection = triggers.length > 0
    ? triggers.map(t => `- "${t}"`).join('\n')
    : '- "trigger phrase here"';
  
  // Generate content
  const content = `---
name: ${frontmatter.name}
description: ${frontmatter.description}
domain: ${frontmatter.domain}
confidence: ${frontmatter.confidence}
source: ${frontmatter.source}
status: ${frontmatter.status}
---

# ${name}

${description}

## Triggers

${triggersSection}

## Context

Provide context about when and how to use this skill.

## Instructions

1. Step-by-step instructions for the AI agent
2. Be specific and actionable
3. Include examples where helpful

## Examples

\`\`\`
Example usage or output
\`\`\`

## Notes

- Additional notes or considerations
- Edge cases to handle
- Related skills or dependencies
`;
  
  try {
    // Create directory
    mkdirSync(skillDir, { recursive: true });
    
    // Write file
    writeFileSync(skillPath, content, 'utf-8');
    
    return {
      success: true,
      path: skillPath,
      content
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      path: skillPath
    };
  }
}
