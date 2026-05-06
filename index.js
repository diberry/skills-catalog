#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { findSkills } from './src/tools/find.js';
import { generateSkill } from './src/tools/generate.js';
import { listDomains } from './src/tools/list.js';
import { validateSkills } from './src/tools/validate.js';
import { migrateSkills } from './src/tools/migrate.js';

const server = new Server(
  {
    name: '@diberry/skills-catalog',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'skills_catalog_find',
        description: 'Search for skills matching a query. Returns ranked results with relevance scores.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query to match against skill triggers, descriptions, and metadata',
            },
            domain: {
              type: 'string',
              description: 'Optional domain filter (e.g., "infrastructure", "content")',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results to return (default: 5)',
              default: 5,
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'skills_catalog_generate',
        description: 'Generate a new SKILL.md file from parameters. Creates a skill with template structure.',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Human-readable name of the skill',
            },
            description: {
              type: 'string',
              description: 'Brief description of what the skill does',
            },
            domain: {
              type: 'string',
              description: 'Domain or category (e.g., "infrastructure", "content")',
            },
            triggers: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of trigger phrases that should invoke this skill',
            },
          },
          required: ['name', 'description', 'domain', 'triggers'],
        },
      },
      {
        name: 'skills_catalog_list_domains',
        description: 'List all skill domains with counts and categories. Provides overview of skill catalog organization.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'skills_catalog_validate',
        description: 'Validate skill files against JSON schema. Checks frontmatter structure and required fields.',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Optional path to a specific SKILL.md file. If omitted, validates all skills.',
            },
          },
        },
      },
      {
        name: 'skills_catalog_migrate',
        description: 'Analyze and migrate existing SKILL.md files to the latest schema. Extracts inline triggers, infers tags, adds missing fields. Supports report (dry-run) and apply modes.',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Optional path to a specific SKILL.md file. If omitted, processes all skills.',
            },
            mode: {
              type: 'string',
              enum: ['report', 'apply'],
              description: 'Mode: "report" for dry-run analysis, "apply" to write changes (creates backups).',
            },
            options: {
              type: 'object',
              description: 'Migration options',
              properties: {
                promoteTriggers: {
                  type: 'boolean',
                  description: 'Move body ## Triggers into frontmatter triggers array (default: false)',
                },
                inferTags: {
                  type: 'boolean',
                  description: 'Derive tags from ## USE FOR section keywords (default: true)',
                },
                addDefaults: {
                  type: 'boolean',
                  description: 'Add status, category defaults to skills missing them (default: true)',
                },
              },
            },
          },
          required: ['mode'],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'skills_catalog_find': {
        const { query, domain, limit } = args;
        const results = findSkills(query, domain || null, limit || 5);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(results, null, 2),
            },
          ],
        };
      }

      case 'skills_catalog_generate': {
        const { name, description, domain, triggers } = args;
        const result = generateSkill(name, description, domain, triggers || []);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'skills_catalog_list_domains': {
        const result = listDomains();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'skills_catalog_validate': {
        const { path } = args;
        const result = validateSkills(path || null);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'skills_catalog_migrate': {
        const { path: skillPath, mode, options } = args;
        const result = migrateSkills(skillPath || null, mode, options || {});
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ error: error.message }, null, 2),
        },
      ],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Skills Catalog MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
