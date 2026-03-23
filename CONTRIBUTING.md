# Contributing to Spendlog

Thanks for your interest in contributing! Spendlog is an MCP server for expense tracking -- this guide will help you get started.

## Development Setup

### Prerequisites

- Node.js 20+
- npm 9+
- Claude Desktop or Claude Code (for testing MCP tools)

### Clone & Install

```bash
git clone https://github.com/makz81/spendlog-mcp.git
cd spendlog-mcp
npm install
```

### Database Setup

```bash
npm run db:migrate   # Run migrations
npm run db:seed      # Seed default categories
```

### Run in Development

```bash
npm run dev          # Start MCP server with watch mode
```

### Configure Claude Desktop for Testing

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

```json
{
  "mcpServers": {
    "spendlog-dev": {
      "command": "node",
      "args": ["/path/to/spendlog/dist/index.js"],
      "env": {
        "DATABASE_PATH": "/path/to/spendlog/data/spendlog.db"
      }
    }
  }
}
```

Restart Claude Desktop after changes.

---

## Architecture

```
User in Claude
     |
     v
Claude LLM
     |
     v (MCP protocol via stdio)
src/server.ts          -- MCP server setup
     |
     v
src/tools/index.ts     -- Tool registry (routes tool calls)
     |
     v
src/tools/*.ts         -- Individual tool files (validation + handler)
     |
     v
src/services/*.ts      -- Business logic
     |
     v
src/entities/*.ts      -- TypeORM entities (SQLite)
     |
     v
~/.spendlog/spendlog.db  -- Local SQLite database
```

### Key Directories

```
spendlog/
  src/
    index.ts              # Entry point
    server.ts             # MCP server setup & tool registration
    constants.ts          # Configuration constants
    cli.ts                # npx installer CLI
    tools/                # MCP tool definitions (one file per domain)
      index.ts            # Tool registry
      transactions.ts     # add_expense, add_income, list, delete, update
      summary.ts          # get_summary, get_category_breakdown, compare_periods
      invoice.ts          # create_invoice, list_invoices, get_invoice, mark_*
      recurring.ts        # create_recurring, list_recurring, process_recurring
      categories.ts       # list_categories, add_category, delete_category
      budgets.ts          # set_budget, get_budget_status, list_budgets
      projects.ts         # list_projects, create_project, rename_project
      export.ts           # export_transactions, export_invoices, export_for_tax_advisor
      profile.ts          # get_profile, set_profile
      connection.ts       # connect, disconnect, sync_now, sync_status
      notifications.ts    # get_notifications
    entities/             # TypeORM entities
    services/             # Business logic (pdf, sync, connection)
    db/                   # Database config, migrations, seeds
    i18n/                 # Internationalization (de, en)
    utils/                # Validation schemas, date/format helpers
  templates/              # Handlebars templates (invoice PDF)
  tests/                  # Vitest test files
```

---

## How to Add a New MCP Tool

This is the #1 way to contribute. Follow these steps:

### 1. Add the tool handler

Create or extend a file in `src/tools/`. Each tool needs:
- A **definition** (name, description, input schema)
- A **handler** function

```typescript
// src/tools/my-feature.ts
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { t } from '../i18n/index.js';
import { getCurrentUserId } from './index.js';

// Zod schema for input validation
const myToolSchema = z.object({
  query: z.string().min(1),
  limit: z.number().optional().default(10),
});

type MyToolInput = z.infer<typeof myToolSchema>;

// Tool definition (shown to Claude)
export function getMyToolDefinitions(): Tool[] {
  return [
    {
      name: 'my_tool',
      description: t('myTool.description'),
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
          limit: { type: 'number', description: 'Max results' },
        },
        required: ['query'],
      },
      annotations: {
        readOnlyHint: true,  // or destructiveHint: true
      },
    },
  ];
}

// Handler
export async function myTool(args: Record<string, unknown>) {
  const input = myToolSchema.parse(args) as MyToolInput;
  const userId = getCurrentUserId();

  // Your logic here...

  return {
    success: true,
    data: { /* ... */ },
  };
}
```

### 2. Register in the tool index

Edit `src/tools/index.ts`:

```typescript
import { getMyToolDefinitions, myTool } from './my-feature.js';

// In getToolDefinitions():
...getMyToolDefinitions(),

// In handleToolCall():
case 'my_tool':
  return myTool(args);
```

### 3. Add i18n strings

Add German and English descriptions in `src/i18n/de.ts` and `src/i18n/en.ts`:

```typescript
// src/i18n/de.ts
myTool: {
  description: 'Beschreibung deines Tools',
},
```

### 4. Write tests

```typescript
// tests/tools/my-feature.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupTestDB, teardownTestDB } from '../helpers';

describe('My Tool', () => {
  beforeAll(async () => { await setupTestDB(); });
  afterAll(async () => { await teardownTestDB(); });

  it('should return results', async () => {
    const result = await myTool({ query: 'test' });
    expect(result.success).toBe(true);
  });
});
```

### 5. Verify

```bash
npm run typecheck    # 0 errors
npm run test         # All tests pass
npm run build        # Clean build
```

---

## Commands

```bash
# Development
npm run dev          # Start with tsx watch mode
npm run build        # TypeScript build
npm run start        # Run built server

# Database
npm run db:migrate   # Run migrations
npm run db:seed      # Seed default data
npm run db:reset     # Reset (delete + migrate + seed)

# Quality
npm run typecheck    # TypeScript check
npm run test         # Run tests
npm run test:watch   # Test watch mode
npm run lint         # ESLint check
npm run lint:fix     # ESLint auto-fix
npm run format       # Prettier format
npm run format:check # Prettier check

# PDF
npm run pdf:test     # Generate test invoice PDF
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js 20+ (ESM) |
| Language | TypeScript (strict) |
| MCP | @modelcontextprotocol/sdk |
| Database | TypeORM + better-sqlite3 |
| PDF | Puppeteer + Handlebars |
| Validation | Zod |
| Testing | Vitest |

---

## Code Guidelines

### TypeScript

- Strict mode enabled, no `any` without justification
- All tool inputs validated with Zod schemas
- Proper error handling with user-friendly messages

### MCP Tools

- Use `snake_case` for tool names
- Include proper annotations (`readOnlyHint`, `destructiveHint`)
- English descriptions (localized via i18n)
- Return structured `{ success, data/message }` responses

### Naming Conventions

- **Tools:** `snake_case` (e.g., `add_expense`, `list_transactions`)
- **Files:** `kebab-case.ts`
- **Functions:** `camelCase`
- **Classes/Entities:** `PascalCase`
- **Constants:** `UPPER_SNAKE_CASE`

### Commits

- Small, focused commits
- Descriptive messages: "Add recurring transaction support"
- One logical change per commit

---

## Testing

```bash
npm run test              # All tests
npm run test:watch        # Watch mode
```

Tests live in `tests/` and mirror `src/tools/`:

```
tests/
  tools/
    transactions.test.ts
    summary.test.ts
    invoice.test.ts
    ...
  validation.test.ts
  i18n.test.ts
  utils.test.ts
```

### Manual Testing

1. Build: `npm run build`
2. Configure Claude Desktop (see setup above)
3. Restart Claude Desktop
4. Test commands like "Track 50 EUR for hosting"

---

## Pull Request Process

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Run checks: `npm run typecheck && npm run lint && npm run test`
5. Commit with clear message
6. Push and create PR

### Before Submitting

- [ ] `npm run typecheck` passes (0 errors)
- [ ] `npm run lint` passes (0 errors)
- [ ] `npm run test` passes (all green)
- [ ] `npm run build` succeeds
- [ ] Tested with Claude Desktop or Claude Code

---

## Good First Issues

Look for issues labeled [`good first issue`](https://github.com/makz81/spendlog-mcp/labels/good%20first%20issue). These are ideal starting points:

- Adding new i18n translations (Italian, Portuguese, Japanese)
- New MCP tools (e.g., `search_transactions`, `get_balance`)
- Improving tool descriptions
- Adding test coverage

---

## Questions?

- Open an [issue](https://github.com/makz81/spendlog-mcp/issues)
- Check [spendlog.dev](https://spendlog.dev) for docs
