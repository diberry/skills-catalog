import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  extractInlineTriggers,
  extractBodyTriggers,
  extractUseForItems,
  extractDoNotUseForItems,
  inferTags,
  inferCategory,
  buildMigratedFrontmatter,
  convertInlineToTriggersSection,
  generateDiff,
} from '../src/utils/migrate-helpers.js';
import { analyzeSkill, applyMigration, migrateSkills } from '../src/tools/migrate.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FIXTURES_DIR = path.join(__dirname, 'fixtures', 'migrate');

// --- Fixture content ---
const SKILL_FORMAT_A = `---
name: "content-freshness-review"
description: "Reviews articles for content freshness"
domain: "content-freshness"
confidence: "medium"
---

## Triggers
- "review this article for freshness"
- "freshness check"

## USE FOR
- reviewing documentation for outdated content
- checking article freshness dates
`;

const SKILL_FORMAT_B = `---
name: "ado-board-hygiene"
description: "Checks ADO board hygiene"
domain: "tooling"
---

**Trigger phrases:** "ADO hygiene", "board cleanup", "check my ADO items"

## USE FOR
- cleaning up stale work items
- ADO board maintenance
`;

const SKILL_FORMAT_C = `---
name: "example-skill"
description: "An example skill"
triggers:
  - "do the thing"
status: "active"
tags:
  - "example"
---

Some body content.
`;

const SKILL_MIXED = `---
name: "deploy-checker"
description: "Checks deployment status"
domain: "infrastructure"
confidence: "high"
---

## Triggers
- "check deploy status"

**Trigger phrases:** "is the deploy done", "deploy status"

## USE FOR
- monitoring deployment pipelines
- CI/CD health checks

## DO NOT USE FOR
- creating new deployments
`;

// --- Test helpers ---
function setupFixtures() {
  mkdirSync(path.join(FIXTURES_DIR, 'format-a'), { recursive: true });
  mkdirSync(path.join(FIXTURES_DIR, 'format-b'), { recursive: true });
  mkdirSync(path.join(FIXTURES_DIR, 'format-c'), { recursive: true });
  mkdirSync(path.join(FIXTURES_DIR, 'mixed'), { recursive: true });

  writeFileSync(path.join(FIXTURES_DIR, 'format-a', 'SKILL.md'), SKILL_FORMAT_A);
  writeFileSync(path.join(FIXTURES_DIR, 'format-b', 'SKILL.md'), SKILL_FORMAT_B);
  writeFileSync(path.join(FIXTURES_DIR, 'format-c', 'SKILL.md'), SKILL_FORMAT_C);
  writeFileSync(path.join(FIXTURES_DIR, 'mixed', 'SKILL.md'), SKILL_MIXED);
}

function cleanupFixtures() {
  if (existsSync(FIXTURES_DIR)) {
    rmSync(FIXTURES_DIR, { recursive: true, force: true });
  }
}

// --- Tests ---

describe('migrate-helpers', () => {
  describe('extractInlineTriggers', () => {
    test('extracts comma-separated trigger phrases', () => {
      const content = '**Trigger phrases:** "ADO hygiene", "board cleanup", "check items"';
      const result = extractInlineTriggers(content);
      expect(result).toEqual(['ADO hygiene', 'board cleanup', 'check items']);
    });

    test('handles single trigger phrase', () => {
      const content = '**Trigger phrases:** "single trigger"';
      const result = extractInlineTriggers(content);
      expect(result).toEqual(['single trigger']);
    });

    test('handles no trigger phrases', () => {
      const result = extractInlineTriggers('No triggers here');
      expect(result).toEqual([]);
    });

    test('handles singular Trigger phrase label', () => {
      const content = '**Trigger phrase:** "just one"';
      const result = extractInlineTriggers(content);
      expect(result).toEqual(['just one']);
    });
  });

  describe('extractBodyTriggers', () => {
    test('extracts triggers from ## Triggers section', () => {
      const content = '## Triggers\n- "trigger one"\n- "trigger two"\n\n## Other';
      const result = extractBodyTriggers(content);
      expect(result).toEqual(['trigger one', 'trigger two']);
    });

    test('returns empty for no section', () => {
      const result = extractBodyTriggers('No triggers section here');
      expect(result).toEqual([]);
    });
  });

  describe('extractUseForItems', () => {
    test('extracts USE FOR items', () => {
      const content = '## USE FOR\n- item one\n- item two\n\n## Other';
      const result = extractUseForItems(content);
      expect(result).toEqual(['item one', 'item two']);
    });

    test('returns empty when section missing', () => {
      expect(extractUseForItems('no section')).toEqual([]);
    });
  });

  describe('extractDoNotUseForItems', () => {
    test('extracts DO NOT USE FOR items', () => {
      const content = '## DO NOT USE FOR\n- bad thing\n\n## Next';
      const result = extractDoNotUseForItems(content);
      expect(result).toEqual(['bad thing']);
    });
  });

  describe('inferTags', () => {
    test('infers tags from USE FOR keywords', () => {
      const items = ['reviewing documentation for outdated content', 'checking freshness'];
      const tags = inferTags(items);
      expect(tags.length).toBeGreaterThan(0);
      expect(tags).toContain('reviewing');
      expect(tags).toContain('documentation');
    });

    test('returns empty for empty input', () => {
      expect(inferTags([])).toEqual([]);
    });

    test('deduplicates tags', () => {
      const items = ['deploy pipeline', 'deploy status'];
      const tags = inferTags(items);
      const deployCount = tags.filter(t => t === 'deploy').length;
      expect(deployCount).toBe(1);
    });

    test('caps at 10 tags', () => {
      const items = ['a b c d e f g h i j k l m n o p q r s t u v w x y z'.split(' ').join(' ')];
      const tags = inferTags(items);
      expect(tags.length).toBeLessThanOrEqual(10);
    });
  });

  describe('inferCategory', () => {
    test('infers devops category', () => {
      expect(inferCategory('infrastructure', 'deploy-checker')).toBe('devops');
    });

    test('infers documentation category', () => {
      expect(inferCategory('content', 'doc-review')).toBe('documentation');
    });

    test('falls back to domain', () => {
      expect(inferCategory('custom-domain', 'random-name')).toBe('custom-domain');
    });

    test('returns null for no input', () => {
      expect(inferCategory(null, null)).toBeNull();
    });
  });

  describe('buildMigratedFrontmatter', () => {
    test('adds status default', () => {
      const result = buildMigratedFrontmatter(
        { name: 'test', description: 'desc' },
        { addDefaults: true, inferTags: false, promoteTriggers: false },
        [], [], []
      );
      expect(result.status).toBe('active');
    });

    test('does not overwrite existing status', () => {
      const result = buildMigratedFrontmatter(
        { name: 'test', description: 'desc', status: 'deprecated' },
        { addDefaults: true, inferTags: false, promoteTriggers: false },
        [], [], []
      );
      expect(result.status).toBe('deprecated');
    });

    test('promotes triggers to frontmatter', () => {
      const result = buildMigratedFrontmatter(
        { name: 'test', description: 'desc' },
        { addDefaults: false, inferTags: false, promoteTriggers: true },
        ['body trigger'],
        ['inline trigger'],
        []
      );
      expect(result.triggers).toContain('body trigger');
      expect(result.triggers).toContain('inline trigger');
    });

    test('never removes existing data', () => {
      const existing = { name: 'test', description: 'desc', domain: 'infra', confidence: 'high' };
      const result = buildMigratedFrontmatter(
        existing,
        { addDefaults: true, inferTags: true, promoteTriggers: false },
        [], [], []
      );
      expect(result.name).toBe('test');
      expect(result.domain).toBe('infra');
      expect(result.confidence).toBe('high');
    });
  });

  describe('convertInlineToTriggersSection', () => {
    test('creates new triggers section from inline', () => {
      const content = '**Trigger phrases:** "hello", "world"\n\nSome content.';
      const result = convertInlineToTriggersSection(content, ['hello', 'world']);
      expect(result).toContain('## Triggers');
      expect(result).toContain('- "hello"');
      expect(result).toContain('- "world"');
      expect(result).not.toContain('**Trigger phrases:**');
    });

    test('appends to existing triggers section', () => {
      const content = '## Triggers\n- "existing"\n\n**Trigger phrases:** "new one"\n';
      const result = convertInlineToTriggersSection(content, ['new one']);
      expect(result).toContain('- "existing"');
      expect(result).toContain('- "new one"');
    });

    test('returns unchanged content if no inline triggers', () => {
      const content = 'No triggers here';
      expect(convertInlineToTriggersSection(content, [])).toBe(content);
    });
  });

  describe('generateDiff', () => {
    test('detects added fields', () => {
      const diff = generateDiff({ name: 'x' }, { name: 'x', status: 'active' });
      expect(diff).toEqual([{ field: 'status', type: 'added', value: 'active' }]);
    });

    test('detects modified fields', () => {
      const diff = generateDiff({ tags: ['a'] }, { tags: ['a', 'b'] });
      expect(diff[0].type).toBe('modified');
    });

    test('returns empty for identical objects', () => {
      expect(generateDiff({ a: 1 }, { a: 1 })).toEqual([]);
    });
  });
});

describe('migrate tool', () => {
  beforeEach(() => {
    setupFixtures();
  });

  afterEach(() => {
    cleanupFixtures();
  });

  describe('analyzeSkill', () => {
    test('detects Format A needs migration (missing status)', () => {
      const result = analyzeSkill(path.join(FIXTURES_DIR, 'format-a', 'SKILL.md'));
      expect(result.needsMigration).toBe(true);
      expect(result.changes.some(c => c.field === 'status')).toBe(true);
    });

    test('detects Format B inline triggers', () => {
      const result = analyzeSkill(path.join(FIXTURES_DIR, 'format-b', 'SKILL.md'));
      expect(result.inlineTriggers).toEqual(['ADO hygiene', 'board cleanup', 'check my ADO items']);
      expect(result.contentChanged).toBe(true);
    });

    test('Format C needs no migration (already complete)', () => {
      const result = analyzeSkill(
        path.join(FIXTURES_DIR, 'format-c', 'SKILL.md'),
        { addDefaults: true, inferTags: true, promoteTriggers: false }
      );
      // Has status and tags already - only category might be added
      expect(result.changes.filter(c => c.field === 'status')).toHaveLength(0);
    });

    test('mixed format extracts both trigger types', () => {
      const result = analyzeSkill(path.join(FIXTURES_DIR, 'mixed', 'SKILL.md'));
      expect(result.bodyTriggers).toEqual(['check deploy status']);
      expect(result.inlineTriggers).toEqual(['is the deploy done', 'deploy status']);
      expect(result.useForItems.length).toBe(2);
    });
  });

  describe('applyMigration', () => {
    test('applies migration and creates backup', () => {
      const filePath = path.join(FIXTURES_DIR, 'format-b', 'SKILL.md');
      const result = applyMigration(filePath);

      expect(result.applied).toBe(true);
      expect(existsSync(filePath + '.bak')).toBe(true);

      // Verify the file was updated
      const updated = readFileSync(filePath, 'utf-8');
      expect(updated).toContain('status: active');
      expect(updated).toContain('## Triggers');
      expect(updated).not.toContain('**Trigger phrases:**');
    });

    test('skips already-complete skills', () => {
      const filePath = path.join(FIXTURES_DIR, 'format-c', 'SKILL.md');
      const result = applyMigration(filePath, {
        addDefaults: true,
        inferTags: true,
        promoteTriggers: false,
      });
      // Format C has status and tags — may only add category
      expect(result.id).toBe('format-c');
    });

    test('never removes existing data', () => {
      const filePath = path.join(FIXTURES_DIR, 'format-a', 'SKILL.md');
      applyMigration(filePath);

      const updated = readFileSync(filePath, 'utf-8');
      expect(updated).toContain('content-freshness-review');
      expect(updated).toContain('content-freshness');
      expect(updated).toContain('medium');
    });
  });

  describe('migrateSkills (integration)', () => {
    test('report mode returns analysis without modifying files', () => {
      const result = migrateSkills(
        path.join(FIXTURES_DIR, 'format-a', 'SKILL.md'),
        'report'
      );
      expect(result.mode).toBe('report');
      expect(result.totalSkills).toBe(1);
      expect(existsSync(path.join(FIXTURES_DIR, 'format-a', 'SKILL.md.bak'))).toBe(false);
    });

    test('apply mode writes changes', () => {
      const filePath = path.join(FIXTURES_DIR, 'format-b', 'SKILL.md');
      const result = migrateSkills(filePath, 'apply');
      expect(result.mode).toBe('apply');
      expect(result.migrated).toBe(1);
      expect(existsSync(filePath + '.bak')).toBe(true);
    });

    test('returns error for missing file', () => {
      const result = migrateSkills('/nonexistent/SKILL.md', 'report');
      expect(result.error).toBeDefined();
    });

    test('returns error for invalid mode', () => {
      const result = migrateSkills(null, 'invalid');
      expect(result.error).toContain('Invalid mode');
    });

    test('promoteTriggers option merges all triggers into frontmatter', () => {
      const filePath = path.join(FIXTURES_DIR, 'mixed', 'SKILL.md');
      const result = migrateSkills(filePath, 'apply', { promoteTriggers: true });
      expect(result.migrated).toBe(1);

      const updated = readFileSync(filePath, 'utf-8');
      expect(updated).toContain('check deploy status');
      expect(updated).toContain('is the deploy done');
    });
  });
});
