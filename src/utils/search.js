/**
 * Score a skill against a search query
 * @param {Object} skill - Parsed skill object
 * @param {string} query - Search query
 * @returns {number} Relevance score (0.0 to 1.0)
 */
export function scoreSkill(skill, query) {
  if (!query || query.trim() === '') {
    return 0.5; // Neutral score for empty query
  }
  
  const queryLower = query.toLowerCase().trim();
  const queryWords = queryLower.split(/\s+/);
  
  // First check if the entire query matches exactly as a trigger
  const exactScore = scoreSkillSingleWord(skill, queryLower);
  if (exactScore === 1.0) {
    return 1.0;
  }
  
  let maxScore = exactScore;
  
  // Multi-word query: score each word independently and take the average
  if (queryWords.length > 1) {
    const wordScores = queryWords.map(word => 
      scoreSkillSingleWord(skill, word)
    );
    const avgScore = wordScores.reduce((sum, score) => sum + score, 0) / wordScores.length;
    maxScore = Math.max(maxScore, avgScore);
  }
  
  return Math.min(maxScore, 1.0);
}

/**
 * Score a skill against a single word query
 * @param {Object} skill - Parsed skill object
 * @param {string} query - Single word query (lowercase)
 * @returns {number} Relevance score
 */
function scoreSkillSingleWord(skill, query) {
  let maxScore = 0.0;
  
  const { frontmatter, triggers } = skill;
  const name = (frontmatter.name || '').toLowerCase();
  const description = (frontmatter.description || '').toLowerCase();
  const tags = (frontmatter.tags || []).map(t => t.toLowerCase());
  const domain = (frontmatter.domain || '').toLowerCase();
  
  // Exact trigger match: 1.0 (check this first, before partial matches)
  for (const trigger of triggers) {
    const triggerLower = trigger.toLowerCase().trim();
    const queryTrimmed = query.trim();
    
    if (triggerLower === queryTrimmed) {
      return 1.0; // Return immediately for exact match
    }
  }
  
  // Now check partial matches
  for (const trigger of triggers) {
    const triggerLower = trigger.toLowerCase();
    
    // Partial trigger match (query contained in trigger): 0.8
    if (triggerLower.includes(query)) {
      maxScore = Math.max(maxScore, 0.8);
    }
    // Query word in trigger: 0.6
    else if (triggerLower.split(/\s+/).includes(query)) {
      maxScore = Math.max(maxScore, 0.6);
    }
  }
  
  // Tag exact match: 0.6
  if (tags.includes(query)) {
    maxScore = Math.max(maxScore, 0.6);
  }
  
  // Description contains query: 0.5
  if (description.includes(query)) {
    maxScore = Math.max(maxScore, 0.5);
  }
  
  // Name contains query: 0.4
  if (name.includes(query)) {
    maxScore = Math.max(maxScore, 0.4);
  }
  
  // Domain exact match: 0.3
  if (domain === query) {
    maxScore = Math.max(maxScore, 0.3);
  }
  
  return maxScore;
}

/**
 * Generate human-readable reason for match
 * @param {Object} skill - Parsed skill object
 * @param {string} query - Search query
 * @param {number} score - Calculated score
 * @returns {string} Explanation of match
 */
export function generateMatchReason(skill, query, score) {
  if (score >= 1.0) {
    return 'Exact trigger match';
  } else if (score >= 0.8) {
    return 'Partial trigger match';
  } else if (score >= 0.6) {
    return 'Trigger word or tag match';
  } else if (score >= 0.5) {
    return 'Description match';
  } else if (score >= 0.4) {
    return 'Name match';
  } else if (score >= 0.3) {
    return 'Domain match';
  } else {
    return 'Low relevance';
  }
}

/**
 * Rank and filter skills by relevance
 * @param {Array<Object>} skills - Array of parsed skills
 * @param {string} query - Search query
 * @param {number} minScore - Minimum relevance threshold
 * @returns {Array<Object>} Sorted array of skills with scores
 */
export function rankSkills(skills, query, minScore = 0.3) {
  const scored = skills.map(skill => ({
    ...skill,
    score: scoreSkill(skill, query),
    reason: ''
  }));
  
  const filtered = scored.filter(s => s.score >= minScore);
  
  filtered.sort((a, b) => b.score - a.score);
  
  // Add match reasons
  filtered.forEach(skill => {
    skill.reason = generateMatchReason(skill, query, skill.score);
  });
  
  return filtered;
}
