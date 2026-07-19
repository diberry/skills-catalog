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
| `skills_catalog_migrate` | Analyze and migrate skill files to latest schema | `mode` (required), `path`, `options` |

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

### Validate Social Or Publishing Skills

For skills that can publish, post, delete, trade, message, or modify external
accounts, run `skills_catalog_validate` before distribution and review the
`SKILL.md` for:

- explicit human approval before any live write
- a dry-run or preview path for generated content
- local-only handling for credentials, sessions, cookies, and exports
- a clear stop condition for rate limits or platform safety errors

TweetClaw-style X/Twitter skills should document that search or monitoring
evidence is reviewed before drafting and that posting requires approval of the
exact final text.

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

## Migration

The `skills_catalog_migrate` tool helps upgrade existing SKILL.md files to the latest schema. It supports:

- **Extracting inline triggers** — Converts `**Trigger phrases:**` patterns to proper `## Triggers` sections
- **Inferring tags** — Derives tags from `## USE FOR` section keywords
- **Adding defaults** — Adds missing `status`, `category` fields
- **Promoting triggers** — Optionally moves body triggers into frontmatter

### Migration Workflow

1. **Validate current state**:
   ```javascript
   skills_catalog_validate()
   ```

2. **Generate report** (dry-run):
   ```javascript
   skills_catalog_migrate({
     mode: "report"
   })
   ```

3. **Review changes**, then **apply migration**:
   ```javascript
   skills_catalog_migrate({
     mode: "apply",
     options: {
       promoteTriggers: false,  // Keep triggers in body
       inferTags: true,         // Derive tags from USE FOR
       addDefaults: true        // Add status, category
     }
   })
   ```

4. **Re-validate** to confirm:
   ```javascript
   skills_catalog_validate()
   ```

### Migration Options

- **`promoteTriggers`** (boolean, default: false) — Move body `## Triggers` into frontmatter `triggers` array
- **`inferTags`** (boolean, default: true) — Derive tags from `## USE FOR` section keywords
- **`addDefaults`** (boolean, default: true) — Add `status: active` and inferred `category` to skills missing them

### Usage Examples

**Report mode** (dry-run, no changes):
```javascript
skills_catalog_migrate({
  mode: "report"
})
```

Returns:
```json
{
  "mode": "report",
  "totalSkills": 15,
  "needsMigration": 8,
  "upToDate": 7,
  "results": [
    {
      "id": "ado-board-hygiene",
      "path": "/path/to/SKILL.md",
      "needsMigration": true,
      "changes": [
        { "field": "status", "type": "added", "value": "active" },
        { "field": "tags", "type": "added", "value": ["board", "hygiene", "cleanup"] }
      ],
      "contentChanged": true,
      "inlineTriggers": ["ADO hygiene", "board cleanup"]
    }
  ],
  "summary": "8/15 skills need migration"
}
```

**Apply mode** (single file):
```javascript
skills_catalog_migrate({
  path: ".copilot/skills/my-skill/SKILL.md",
  mode: "apply"
})
```

**Apply mode** (batch, all skills):
```javascript
skills_catalog_migrate({
  mode: "apply",
  options: {
    promoteTriggers: true,  // Move triggers to frontmatter
    inferTags: true,
    addDefaults: true
  }
})
```

Returns:
```json
{
  "mode": "apply",
  "totalSkills": 15,
  "migrated": 8,
  "skipped": 7,
  "summary": "Migrated 8/15 skills (backups created)"
}
```

### Safety Features

- **Backups** — Creates `.bak` files before modifying (never overwrites existing backups)
- **Atomic writes** — Uses temp file + rename to prevent partial writes
- **Post-apply validation** — Parses migrated file and restores backup if invalid
- **Error isolation** — One file failure doesn't stop batch processing
- **Non-destructive** — Never removes existing frontmatter data

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
