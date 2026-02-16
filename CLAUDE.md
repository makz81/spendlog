# Spendlog

MCP server for expense tracking. Track finances directly in Claude.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js 20+ (ESM, TypeScript strict) |
| MCP | @modelcontextprotocol/sdk |
| Database | TypeORM + better-sqlite3 (SQLite) |
| Validation | Zod |
| Testing | Vitest (399 tests) |
| PDF | Puppeteer (optional, lazy-loaded) |
| i18n | EN (default), DE, ES, FR |

## Commands

```bash
npm run dev          # MCP server with watch mode (tsx)
npm run build        # TypeScript build
npm run start        # Run built server
npm run test         # Run tests
npm run typecheck    # Type check (no emit)
npm run db:migrate   # Run database migrations
npm run db:seed      # Seed default categories
npm run db:reset     # Reset DB (delete + migrate + seed)
```

## Architecture

```
User -> Claude LLM -> MCP Tool Call -> Zod Validation -> Service -> TypeORM -> SQLite
```

### Data Flow
- MCP tools receive params via stdio (Claude Desktop) or HTTP/SSE (cloud)
- Zod validates all inputs
- Services contain business logic
- TypeORM entities map to SQLite tables in `~/.spendlog/spendlog.db`

### Key Directories
```
src/
  index.ts              # MCP server entry point
  server.ts             # Server setup & tool registration
  cli.ts                # CLI installer (npx spendlog)
  constants.ts          # Freemium limits, URLs
  tools/                # MCP tool definitions (one file per tool group)
  entities/             # TypeORM entities (Transaction, Invoice, etc.)
  services/             # Business logic (freemium, pdf, sync, connection)
  db/                   # Database setup, migrations, seeds
  i18n/                 # Translation dictionaries
templates/
  invoice.hbs           # Handlebars template for PDF invoices
tests/
  tools/                # Integration tests per tool group
  helpers/              # Test utilities
  fixtures/             # Test data factories
```

## Code Conventions

- **TypeScript strict** -- no `any` without comment
- **MCP Tools:** snake_case names, Zod schemas, German descriptions
- **Services:** camelCase functions, throw errors (handled in tool layer)
- **Entities:** PascalCase, TypeORM decorators, UUID primary keys
- **Files:** kebab-case (`transaction-service.ts`)
- **Imports:** external -> internal -> relative, no circular deps
- **ESM:** `import`/`export`, not `require`

## Adding a New MCP Tool

1. Add tool function in `src/tools/` (follow existing patterns)
2. Register in `src/server.ts` with Zod schema + German description
3. Add proper annotations (`readOnlyHint` / `destructiveHint`)
4. Write tests in `tests/tools/`
5. Add i18n strings to all languages in `src/i18n/`

See [CONTRIBUTING.md](CONTRIBUTING.md) for details.
