import { readFileSync, existsSync } from 'fs';
import { glob } from 'glob';
import path from 'path';
import { parseSkillFile } from '../utils/parse.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Load JSON schema
 */
function loadSchema() {
  const schemaPath = path.join(__dirname, '..', 'schema', 'skill.schema.json');
  
  try {
    const content = readFileSync(schemaPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error loading schema: ${error.message}`);
    return null;
  }
}

/**
 * Validate frontmatter against JSON schema
 */
function validateAgainstSchema(frontmatter, schema) {
  const errors = [];
  const warnings = [];
  
  if (!schema) {
    return { valid: true, errors: [], warnings: ['Schema not loaded'] };
  }
  
  // Check required fields
  for (const field of schema.required || []) {
    if (!frontmatter[field]) {
      errors.push({
        field,
        message: `Required field "${field}" is missing`
      });
    }
  }
  
  // Validate field types and constraints
  for (const [field, value] of Object.entries(frontmatter)) {
    const fieldSchema = schema.properties?.[field];
    if (!fieldSchema) continue;
    
    // Type validation
    if (fieldSchema.type) {
      const actualType = Array.isArray(value) ? 'array' : typeof value;
      if (actualType !== fieldSchema.type) {
        errors.push({
          field,
          message: `Field "${field}" should be ${fieldSchema.type}, got ${actualType}`
        });
      }
    }
    
    // String length validation
    if (fieldSchema.maxLength && typeof value === 'string') {
      if (value.length > fieldSchema.maxLength) {
        warnings.push({
          field,
          message: `Field "${field}" exceeds max length of ${fieldSchema.maxLength}`
        });
      }
    }
    
    // Enum validation
    if (fieldSchema.enum && !fieldSchema.enum.includes(value)) {
      errors.push({
        field,
        message: `Field "${field}" must be one of: ${fieldSchema.enum.join(', ')}`
      });
    }
    
    // Array item validation
    if (fieldSchema.type === 'array' && Array.isArray(value)) {
      if (fieldSchema.items?.type) {
        for (let i = 0; i < value.length; i++) {
          const itemType = typeof value[i];
          if (itemType !== fieldSchema.items.type) {
            errors.push({
              field: `${field}[${i}]`,
              message: `Array item should be ${fieldSchema.items.type}, got ${itemType}`
            });
          }
        }
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Load configuration
 */
function loadConfig(cwd) {
  const configPath = path.join(cwd, '.github', 'skills-catalog.json');
  const defaults = {
    skills_directories: ['.copilot/skills']
  };
  
  if (existsSync(configPath)) {
    try {
      const content = readFileSync(configPath, 'utf-8');
      return { ...defaults, ...JSON.parse(content) };
    } catch (error) {
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
    } catch (error) {
      console.error(`Warning: Could not search directory ${dir}: ${error.message}`);
    }
  }
  
  return skillFiles;
}

/**
 * Validate a single skill file
 */
function validateSkillFile(filePath, schema) {
  const skill = parseSkillFile(filePath);
  
  if (skill.error) {
    return {
      path: filePath,
      valid: false,
      errors: [{ field: 'file', message: skill.error }],
      warnings: []
    };
  }
  
  const validation = validateAgainstSchema(skill.frontmatter, schema);
  
  // Check for triggers
  if (skill.triggers.length === 0) {
    validation.warnings.push({
      field: 'triggers',
      message: 'No trigger phrases found in ## Triggers section'
    });
  }
  
  return {
    path: filePath,
    id: skill.id,
    ...validation
  };
}

/**
 * Validate skill files
 * @param {string|null} skillPath - Path to specific skill or null for all
 * @param {string} cwd - Current working directory
 * @returns {Object} Validation results
 */
export function validateSkills(skillPath = null, cwd = process.cwd()) {
  const schema = loadSchema();
  
  if (skillPath) {
    // Validate single skill
    const result = validateSkillFile(skillPath, schema);
    return {
      totalSkills: 1,
      validSkills: result.valid ? 1 : 0,
      results: [result]
    };
  } else {
    // Validate all skills
    const config = loadConfig(cwd);
    const skillFiles = discoverSkills(config, cwd);
    
    const results = skillFiles.map(file => validateSkillFile(file, schema));
    const validCount = results.filter(r => r.valid).length;
    
    return {
      totalSkills: results.length,
      validSkills: validCount,
      results
    };
  }
}
