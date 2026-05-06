import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { findSkills } from '../src/tools/find.js';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const testRoot = path.join(__dirname, 'fixtures', 'find-test');
const skillsDir = path.join(testRoot, '.copilot', 'skills');

function createSkill(name, content) {
  const dir = path.join(skillsDir, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'SKILL.md'), content, 'utf-8');
}

describe('findSkills', () => {
  beforeAll(() => {
    // Create test skills
    createSkill('k8s-deploy', `---
name: Kubernetes Deployment
description: Deploy applications to Kubernetes clusters
domain: infrastructure
tags: [kubernetes, k8s, deploy]
---

# Kubernetes Deployment

## Triggers

- "deploy to kubernetes"
- "k8s deployment"
- "deploy container to k8s"
`);

    createSkill('docker-build', `---
name: Docker Build
description: Build Docker container images
domain: infrastructure
tags: [docker, containers]
---

# Docker Build

## Triggers

- "build docker image"
- "docker build"
`);

    createSkill('docs-update', `---
name: Update Documentation
description: Update markdown documentation files
domain: content
tags: [docs, markdown]
---

# Update Documentation

## Triggers

- "update docs"
- "fix documentation"
`);
  });

  afterAll(() => {
    cleanupTestDir();
  });

  it('should find skills with exact trigger match', () => {
    const results = findSkills('deploy to kubernetes', null, 5, testRoot);
    
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toBe('k8s-deploy');
    expect(results[0].confidence).toBeCloseTo(1.0, 5);
    expect(results[0].reason).toBe('Exact trigger match');
  });

  it('should find skills with partial match', () => {
    const results = findSkills('kubernetes', null, 5, testRoot);
    
    expect(results.length).toBeGreaterThan(0);
    const k8sSkill = results.find(r => r.id === 'k8s-deploy');
    expect(k8sSkill).toBeDefined();
    expect(k8sSkill.confidence).toBeGreaterThan(0.5);
  });

  it('should handle multi-word queries', () => {
    const results = findSkills('deploy docker', null, 5, testRoot);
    
    expect(results.length).toBeGreaterThan(0);
    // Should find docker skill (has both deploy and docker)
    expect(results.some(r => r.id === 'docker-build')).toBe(true);
  });

  it('should filter by domain', () => {
    const results = findSkills('update', 'content', 5, testRoot);
    
    results.forEach(result => {
      expect(result.domain).toBe('content');
    });
    
    expect(results.some(r => r.id === 'docs-update')).toBe(true);
  });

  it('should return empty array for no matches', () => {
    const results = findSkills('nonexistent-query-xyz', null, 5, testRoot);
    
    expect(results).toEqual([]);
  });

  it('should respect limit parameter', () => {
    const results = findSkills('deploy', null, 1, testRoot);
    
    expect(results.length).toBeLessThanOrEqual(1);
  });

  it('should return skills with correct structure', () => {
    const results = findSkills('docker', null, 5, testRoot);
    
    expect(results.length).toBeGreaterThan(0);
    
    results.forEach(result => {
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('path');
      expect(result).toHaveProperty('domain');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('triggers');
      expect(result).toHaveProperty('reason');
      expect(Array.isArray(result.triggers)).toBe(true);
      expect(result.triggers.length).toBeLessThanOrEqual(3);
    });
  });

  it('should rank results by relevance', () => {
    const results = findSkills('kubernetes', null, 5, testRoot);
    
    if (results.length > 1) {
      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].confidence).toBeGreaterThanOrEqual(results[i + 1].confidence);
      }
    }
  });
});

function cleanupTestDir() {
  try {
    rmSync(testRoot, { recursive: true, force: true });
  } catch (e) {
    // Ignore cleanup errors
  }
}
