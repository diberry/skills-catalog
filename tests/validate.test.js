import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { validateSkills } from '../src/tools/validate.js';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const testRoot = path.join(__dirname, 'fixtures', 'validate-test');
const skillsDir = path.join(testRoot, '.copilot', 'skills');

function createSkill(name, content) {
  const dir = path.join(skillsDir, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'SKILL.md'), content, 'utf-8');
}

describe('validateSkills', () => {
  beforeAll(() => {
    // Create test skills
    createSkill('valid-skill', `---
name: Valid Skill
description: A valid skill for testing
domain: testing
confidence: high
---

# Valid Skill

## Triggers

- "valid trigger"
`);

    createSkill('missing-name', `---
description: Missing name field
---

# Missing Name

## Triggers

- "trigger"
`);

    createSkill('missing-description', `---
name: Missing Description
---

# Missing Description

## Triggers

- "trigger"
`);

    createSkill('no-triggers', `---
name: No Triggers
description: Has no triggers section
---

# No Triggers
`);
  });

  afterAll(() => {
    cleanupTestDir();
  });

  it('should validate all skills in directory', () => {
    const result = validateSkills(null, testRoot);
    
    expect(result.totalSkills).toBe(4);
    expect(result.validSkills).toBeLessThan(result.totalSkills);
    expect(result.results).toHaveLength(4);
  });

  it('should validate single valid skill', () => {
    const skillPath = path.join(skillsDir, 'valid-skill', 'SKILL.md');
    const result = validateSkills(skillPath, testRoot);
    
    expect(result.totalSkills).toBe(1);
    expect(result.validSkills).toBe(1);
    expect(result.results[0].valid).toBe(true);
    expect(result.results[0].errors).toHaveLength(0);
  });

  it('should detect missing name field', () => {
    const skillPath = path.join(skillsDir, 'missing-name', 'SKILL.md');
    const result = validateSkills(skillPath, testRoot);
    
    expect(result.results[0].valid).toBe(false);
    const nameError = result.results[0].errors.find(e => e.field === 'name');
    expect(nameError).toBeDefined();
    expect(nameError.message).toContain('name');
  });

  it('should detect missing description field', () => {
    const skillPath = path.join(skillsDir, 'missing-description', 'SKILL.md');
    const result = validateSkills(skillPath, testRoot);
    
    expect(result.results[0].valid).toBe(false);
    const descError = result.results[0].errors.find(e => e.field === 'description');
    expect(descError).toBeDefined();
    expect(descError.message).toContain('description');
  });

  it('should warn about missing triggers', () => {
    const skillPath = path.join(skillsDir, 'no-triggers', 'SKILL.md');
    const result = validateSkills(skillPath, testRoot);
    
    const triggerWarning = result.results[0].warnings.find(w => w.field === 'triggers');
    expect(triggerWarning).toBeDefined();
  });

  it('should return error for invalid YAML', () => {
    const invalidDir = path.join(skillsDir, 'invalid-yaml');
    mkdirSync(invalidDir, { recursive: true });
    writeFileSync(path.join(invalidDir, 'SKILL.md'), '---\ninvalid: yaml: structure:\n---', 'utf-8');
    
    const skillPath = path.join(invalidDir, 'SKILL.md');
    const result = validateSkills(skillPath, testRoot);
    
    expect(result.results[0].valid).toBe(false);
  });
});

function cleanupTestDir() {
  try {
    rmSync(testRoot, { recursive: true, force: true });
  } catch (e) {
    // Ignore cleanup errors
  }
}
