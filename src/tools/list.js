import { glob } from 'glob';
import path from 'path';
import { parseSkillFile } from '../utils/parse.js';
import { readFileSync, existsSync } from 'fs';

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
 * List all domains with skill counts
 * @param {string} cwd - Current working directory
 * @returns {Object} Domain statistics
 */
export function listDomains(cwd = process.cwd()) {
  const config = loadConfig(cwd);
  const skillFiles = discoverSkills(config, cwd);
  
  // Parse all skills
  const skills = skillFiles.map(parseSkillFile).filter(s => !s.error);
  
  // Group by domain
  const domainMap = new Map();
  const categorySet = new Set();
  
  for (const skill of skills) {
    const domain = skill.frontmatter.domain || 'unknown';
    const category = skill.frontmatter.category;
    
    if (!domainMap.has(domain)) {
      domainMap.set(domain, {
        name: domain,
        count: 0,
        skills: []
      });
    }
    
    const domainData = domainMap.get(domain);
    domainData.count++;
    domainData.skills.push(skill.id);
    
    if (category) {
      categorySet.add(category);
    }
  }
  
  // Convert to array and sort by count
  const domains = Array.from(domainMap.values()).sort((a, b) => b.count - a.count);
  const categories = Array.from(categorySet).sort();
  
  return {
    domains,
    totalSkills: skills.length,
    categories
  };
}
