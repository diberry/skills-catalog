import { describe, it, expect } from '@jest/globals';
import { parseSkillFile, validateFrontmatter } from '../src/utils/parse.js';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const testDir = path.join(__dirname, 'fixtures', 'test-skill');
const testFile = path.join(testDir, 'SKILL.md');

function setupTestFile(content) {
  mkdirSync(testDir, { recursive: true });
  writeFileSync(testFile, content, 'utf-8');
}

function cleanupTestFile() {
  try {
    rmSync(testDir, { recursive: true, force: true });
  } catch (e) {
    // Ignore cleanup errors
  }
}

describe('parseSkillFile', () => {
  it('should parse valid skill with frontmatter and triggers', () => {
    const content = `---
name: Test Skill
description: A test skill
domain: testing
---

# Test Skill

## Triggers

- "test trigger one"
- "test trigger two"

## Instructions

Do something.
`;
    setupTestFile(content);
    
    const result = parseSkillFile(testFile);
    
    expect(result.id).toBe('test-skill');
    expect(result.frontmatter.name).toBe('Test Skill');
    expect(result.frontmatter.description).toBe('A test skill');
    expect(result.triggers).toEqual(['test trigger one', 'test trigger two']);
    expect(result.error).toBeUndefined();
    
    cleanupTestFile();
  });

  it('should handle skill without frontmatter', () => {
    const content = `# Test Skill

## Triggers

- "trigger one"
`;
    setupTestFile(content);
    
    const result = parseSkillFile(testFile);
    
    expect(result.id).toBe('test-skill');
    expect(result.frontmatter).toEqual({});
    expect(result.triggers).toEqual(['trigger one']);
    
    cleanupTestFile();
  });

  it('should handle triggers without quotes', () => {
    const content = `---
name: Test
---

## Triggers

- trigger without quotes
- "trigger with quotes"
`;
    setupTestFile(content);
    
    const result = parseSkillFile(testFile);
    
    expect(result.triggers).toEqual(['trigger without quotes', 'trigger with quotes']);
    
    cleanupTestFile();
  });

  it('should extract triggers only from Triggers section', () => {
    const content = `---
name: Test
---

## Triggers

- "real trigger"

## Examples

- "not a trigger"
`;
    setupTestFile(content);
    
    const result = parseSkillFile(testFile);
    
    expect(result.triggers).toEqual(['real trigger']);
    
    cleanupTestFile();
  });

  it('should handle UTF-8 BOM', () => {
    const content = '\uFEFF---\nname: Test\n---\n\n## Triggers\n\n- "trigger"';
    setupTestFile(content);
    
    const result = parseSkillFile(testFile);
    
    expect(result.frontmatter.name).toBe('Test');
    expect(result.triggers).toEqual(['trigger']);
    
    cleanupTestFile();
  });

  it('should handle Windows paths', () => {
    const content = '---\nname: Test\n---\n';
    setupTestFile(content);
    
    const result = parseSkillFile(testFile);
    
    expect(result.path).toContain('test-skill');
    expect(path.isAbsolute(result.path)).toBe(true);
    
    cleanupTestFile();
  });

  it('should return error object for non-existent file', () => {
    const result = parseSkillFile('/nonexistent/path/SKILL.md');
    
    expect(result.error).toBeDefined();
    expect(result.frontmatter).toEqual({});
    expect(result.triggers).toEqual([]);
  });
});

describe('validateFrontmatter', () => {
  it('should validate correct frontmatter', () => {
    const frontmatter = {
      name: 'Test Skill',
      description: 'A test skill'
    };
    
    const result = validateFrontmatter(frontmatter);
    
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('should require name field', () => {
    const frontmatter = {
      description: 'A test skill'
    };
    
    const result = validateFrontmatter(frontmatter);
    
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].field).toBe('name');
  });

  it('should require description field', () => {
    const frontmatter = {
      name: 'Test Skill'
    };
    
    const result = validateFrontmatter(frontmatter);
    
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].field).toBe('description');
  });

  it('should handle empty frontmatter', () => {
    const result = validateFrontmatter({});
    
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBe(2);
  });
});
