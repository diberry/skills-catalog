# Skills Catalog — Copilot CLI Extension

MCP server for Copilot skill discovery, validation, and management. Enables AI agents to find, generate, and validate skill definitions across your codebase.

## Features

- **🔍 Smart Search** — Find skills by triggers, descriptions, tags, and metadata with relevance scoring
- **✨ Generation** — Create new skill files from templates with proper structure
- **✅ Validation** — Validate skill frontmatter against JSON schema
- **📊 Organization** — List and browse skills by domain and category

## Installation

```bash
npm install @diberry/skills-catalog
```

## MCP Configuration

Add to your MCP config file (e.g., `~/.copilot/mcp-config.json`):

```json
{
  "mcpServers": {
    "skills-catalog": {
      "command": "node",
      "args": ["/path/to/skills-catalog/index.js"]
    }
  }
}
```

## Tools Provided

| Tool | Description | Parameters |
|------|-------------|------------|
| `skills_catalog_find` | Search for skills matching a query | `query` (required), `domain`, `limit` |
| `skills_catalog_generate` | Generate a new SKILL.md file | `name`, `description`, `domain`, `triggers` |
| `skills_catalog_list_domains` | List all domains with counts | None |
| `skills_catalog_validate` | Validate skill files | `path` (optional) |

## Configuration

Create `.github/skills-catalog.json` in your repository:

```json
{
  "skills_directories": [".copilot/skills"],
  "schema_version": "1.0",
  "validation": {
    "required_fields": ["name", "description"],
    "max_skill_size_kb": 100
  },
  "search": {
    "result_limit": 10,
    "min_relevance_score": 0.3
  }
}
```

## Usage Examples

### Find Skills

```javascript
// Search for infrastructure-related skills
skills_catalog_find({
  query: "deploy kubernetes",
  domain: "infrastructure",
  limit: 5
})
```

Returns:
```json
[
  {
    "id": "k8s-deploy",
    "name": "Kubernetes Deployment",
    "path": "/path/to/skill/SKILL.md",
    "domain": "infrastructure",
    "confidence": 0.95,
    "triggers": ["deploy to kubernetes", "k8s deployment"],
    "reason": "Exact trigger match"
  }
]
```

### Generate a Skill

```javascript
skills_catalog_generate({
  name: "Azure Resource Provisioning",
  description: "Provision Azure resources using Terraform",
  domain: "infrastructure",
  triggers: [
    "provision azure resources",
    "create azure infrastructure"
  ]
})
```

### Validate Skills

```javascript
// Validate all skills
skills_catalog_validate()

// Validate specific skill
skills_catalog_validate({ 
  path: ".copilot/skills/k8s-deploy/SKILL.md" 
})
```

### List Domains

```javascript
skills_catalog_list_domains()
```

Returns:
```json
{
  "domains": [
    {
      "name": "infrastructure",
      "count": 12,
      "skills": ["k8s-deploy", "terraform-plan", "...]
    }
  ],
  "totalSkills": 45,
  "categories": ["deployment", "monitoring", "security"]
}
```

## Skill File Structure

Skills follow this structure:

```markdown
---
name: Skill Name
description: Brief description
domain: infrastructure
confidence: medium
source: user
status: active
---

# Skill Name

## Triggers

- "trigger phrase one"
- "trigger phrase two"

## Context

When and how to use this skill.

## Instructions

1. Step-by-step instructions
2. Be specific and actionable

## Examples

\`\`\`
Example usage
\`\`\`
```

## Scoring Algorithm

Skills are ranked by relevance:

- **1.0** — Exact trigger match
- **0.8** — Partial trigger match (query contained in trigger)
- **0.6** — Trigger word or tag match
- **0.5** — Description contains query
- **0.4** — Name contains query
- **0.3** — Domain match

Multi-word queries score each word independently and average the results.

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Start MCP server
npm start
```

## Testing

Tests use Jest with ES modules:

```bash
npm test
```

Test coverage includes:
- Find: exact match, partial match, multi-word queries, domain filtering
- Validate: valid skills, missing fields, invalid YAML
- Parse: frontmatter parsing, trigger extraction, UTF-8 BOM handling
- Search: scoring algorithm edge cases

## License

MIT © Dina Berry
