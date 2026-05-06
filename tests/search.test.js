import { describe, it, expect } from '@jest/globals';
import { scoreSkill, rankSkills, generateMatchReason } from '../src/utils/search.js';

describe('scoreSkill', () => {
  const mockSkill = {
    frontmatter: {
      name: 'Kubernetes Deployment',
      description: 'Deploy applications to Kubernetes clusters',
      domain: 'infrastructure',
      tags: ['k8s', 'deploy', 'containers']
    },
    triggers: [
      'deploy to kubernetes',
      'k8s deployment',
      'deploy container to k8s'
    ]
  };

  it('should return 1.0 for exact trigger match', () => {
    const score = scoreSkill(mockSkill, 'deploy to kubernetes');
    expect(score).toBeCloseTo(1.0, 5);
  });

  it('should return 0.8 for partial trigger match', () => {
    const score = scoreSkill(mockSkill, 'kubernetes');
    expect(score).toBe(0.8);
  });

  it('should return 0.6 for trigger word match', () => {
    const score = scoreSkill(mockSkill, 'deploy');
    expect(score).toBeGreaterThanOrEqual(0.6);
  });

  it('should return 0.6 for tag exact match', () => {
    const score = scoreSkill(mockSkill, 'k8s');
    expect(score).toBeGreaterThanOrEqual(0.6);
  });

  it('should return 0.5 for description match', () => {
    const score = scoreSkill(mockSkill, 'clusters');
    expect(score).toBeGreaterThanOrEqual(0.5);
  });

  it('should return 0.4 for name match', () => {
    const score = scoreSkill(mockSkill, 'deployment');
    expect(score).toBeGreaterThanOrEqual(0.4);
  });

  it('should return 0.3 for domain match', () => {
    const score = scoreSkill(mockSkill, 'infrastructure');
    expect(score).toBeGreaterThanOrEqual(0.3);
  });

  it('should handle multi-word queries by averaging', () => {
    const score = scoreSkill(mockSkill, 'deploy kubernetes');
    expect(score).toBeGreaterThan(0.5);
  });

  it('should return 0.5 for empty query', () => {
    const score = scoreSkill(mockSkill, '');
    expect(score).toBe(0.5);
  });

  it('should be case insensitive', () => {
    const score1 = scoreSkill(mockSkill, 'KUBERNETES');
    const score2 = scoreSkill(mockSkill, 'kubernetes');
    expect(score1).toBe(score2);
  });
});

describe('rankSkills', () => {
  const skills = [
    {
      id: 'k8s-deploy',
      frontmatter: {
        name: 'Kubernetes Deploy',
        description: 'Deploy to k8s',
        domain: 'infrastructure'
      },
      triggers: ['deploy to kubernetes']
    },
    {
      id: 'docker-build',
      frontmatter: {
        name: 'Docker Build',
        description: 'Build container images',
        domain: 'infrastructure'
      },
      triggers: ['build docker image']
    },
    {
      id: 'helm-install',
      frontmatter: {
        name: 'Helm Install',
        description: 'Install helm charts to kubernetes',
        domain: 'infrastructure'
      },
      triggers: ['install helm chart']
    }
  ];

  it('should rank by relevance score descending', () => {
    const ranked = rankSkills(skills, 'kubernetes');
    expect(ranked[0].id).toBe('k8s-deploy');
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
  });

  it('should filter by minimum score', () => {
    const ranked = rankSkills(skills, 'kubernetes', 0.6);
    expect(ranked.length).toBeLessThanOrEqual(skills.length);
    ranked.forEach(skill => {
      expect(skill.score).toBeGreaterThanOrEqual(0.6);
    });
  });

  it('should add match reasons', () => {
    const ranked = rankSkills(skills, 'kubernetes');
    ranked.forEach(skill => {
      expect(skill.reason).toBeDefined();
      expect(typeof skill.reason).toBe('string');
    });
  });

  it('should handle no matches', () => {
    const ranked = rankSkills(skills, 'nonexistent');
    expect(ranked.length).toBe(0);
  });
});

describe('generateMatchReason', () => {
  const mockSkill = {
    frontmatter: { name: 'Test', description: 'Test skill' },
    triggers: []
  };

  it('should return correct reason for score 1.0', () => {
    const reason = generateMatchReason(mockSkill, 'test', 1.0);
    expect(reason).toBe('Exact trigger match');
  });

  it('should return correct reason for score 0.8', () => {
    const reason = generateMatchReason(mockSkill, 'test', 0.8);
    expect(reason).toBe('Partial trigger match');
  });

  it('should return correct reason for score 0.6', () => {
    const reason = generateMatchReason(mockSkill, 'test', 0.6);
    expect(reason).toBe('Trigger word or tag match');
  });

  it('should return correct reason for score 0.5', () => {
    const reason = generateMatchReason(mockSkill, 'test', 0.5);
    expect(reason).toBe('Description match');
  });

  it('should return correct reason for score 0.4', () => {
    const reason = generateMatchReason(mockSkill, 'test', 0.4);
    expect(reason).toBe('Name match');
  });

  it('should return correct reason for low score', () => {
    const reason = generateMatchReason(mockSkill, 'test', 0.2);
    expect(reason).toBe('Low relevance');
  });
});
