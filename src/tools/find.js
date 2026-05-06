import { glob } from 'glob';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { parseSkillFile } from '../utils/parse.js';
import { rankSkills } from '../utils/search.js';

/**
 * Load configuration from .github/skills-catalog.json
 * @param {string} cwd - Current working directory
 * @returns {Object} Configuration object
 */
function loadConfig(cwd) {
  const configPath = path.join(cwd, '.github', 'skills-catalog.json');
  
  const defaults = {
    skills_directories: ['.copilot/skills'],
    schema_version: '1.0',
    validation: {
      required_fields: ['name', 'description'],
      max_skill_size_kb: 100
    },
    search: {
      result_limit: 10,
      min_relevance_score: 0.3
    }
  };
  
  if (existsSync(configPath)) {
    try {
      const content = readFileSync(configPath, 'utf-8');
      return { ...defaults, ...JSON.parse(content) };
    } catch (error) {
      console.error(`Warning: Could not load config: ${error.message}`);
    }
  }
  
  return defaults;
}

/**
 * Discover all SKILL.md files in configured directories
 * @param {Object} config - Configuration object
 * @param {string} cwd - Current working directory
 * @returns {Array<string>} Array of file paths
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
 * Find skills matching a query
 * @param {string} query - Search query
 * @param {string} domain - Optional domain filter
 * @param {number} limit - Maximum number of results
 * @param {string} cwd - Current working directory
 * @returns {Array<Object>} Array of matching skills
 */
export function findSkills(query, domain = null, limit = 5, cwd = process.cwd()) {
  const config = loadConfig(cwd);
  const skillFiles = discoverSkills(config, cwd);
  
  // Parse all skills
  const skills = skillFiles.map(parseSkillFile).filter(s => !s.error);
  
  // Apply domain filter if specified
  let filtered = skills;
  if (domain) {
    const domainLower = domain.toLowerCase();
    filtered = skills.filter(s => 
      (s.frontmatter.domain || '').toLowerCase() === domainLower
    );
  }
  
  // Rank by relevance
  const minScore = config.search?.min_relevance_score || 0.3;
  const ranked = rankSkills(filtered, query, minScore);
  
  // Apply limit
  const resultLimit = Math.min(limit, config.search?.result_limit || 10);
  const results = ranked.slice(0, resultLimit);
  
  // Format results
  return results.map(skill => ({
    id: skill.id,
    name: skill.frontmatter.name || skill.id,
    path: skill.path,
    domain: skill.frontmatter.domain || 'unknown',
    confidence: skill.score,
    triggers: skill.triggers.slice(0, 3),
    reason: skill.reason
  }));
}
