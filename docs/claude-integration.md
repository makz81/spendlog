# Claude Integration

How to use Spendlog with Claude Desktop and Claude Code, including tips for automatic API cost tracking.

## Setup

### Claude Desktop

Add to your config file (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "spendlog": {
      "command": "npx",
      "args": ["-y", "--package=spendlog", "spendlog-mcp"]
    }
  }
}
```

### Claude Code

```bash
claude mcp add spendlog --scope user -- npx -y --package=spendlog spendlog-mcp
```

Verify with `claude mcp list`.

---

## Available Tools

42 tools across 9 categories:

| Category | Tools |
|----------|-------|
| **Transactions** | `add_expense` `add_income` `list_transactions` `update_transaction` `delete_transaction` |
| **Analysis** | `get_summary` `get_category_breakdown` `compare_periods` `get_tax_summary` |
| **Invoices** | `create_invoice` `list_invoices` `get_invoice` `mark_invoice_sent` `mark_invoice_paid` `duplicate_invoice` |
| **Budgets** | `set_budget` `get_budget_status` `list_budgets` `update_budget` `delete_budget` |
| **Recurring** | `create_recurring` `list_recurring` `delete_recurring` `process_recurring` |
| **Projects** | `create_project` `list_projects` `rename_project` `delete_project` |
| **Categories** | `list_categories` `add_category` `delete_category` |
| **Export** | `export_transactions` `export_invoices` `export_for_tax_advisor` |
| **Sync** | `connect` `disconnect` `connection_status` `sync_now` `sync_status` |
| **Settings** | `get_profile` `set_profile` `get_notifications` |

---

## Automatic API Cost Tracking

If you use paid APIs (image generation, LLMs, domains, SaaS tools), you can set up a rule so Claude logs costs automatically.

### Workflow Rule

Add this to your project (`.claude/rules/expense-tracking.md`):

```markdown
# Expense Tracking

After every paid API call:

1. Calculate cost (USD -> EUR if needed)
2. Log via Spendlog:
   mcp__spendlog__add_expense({
     amount: <EUR>,
     description: "<Service>: <What> for <Project>",
     category: "IT & Software"
   })
3. Tell the user what was logged

## Known costs

- Ideogram: $0.08/image
- DALL-E: $0.04/image
- Replicate: $0.06/image
- OpenAI API: variable
- Domains: ~$3-15/year

## Free (don't track)

- Nanobanana: 1,500/day free
- Cloudflare: Workers 100k/day, Pages unlimited
- Supabase: 500MB, 50k MAU free
```

### CLAUDE.md snippet

Add to any project's CLAUDE.md where you want cost tracking:

```markdown
## Expense Tracking

Spendlog MCP is connected. After paid API calls, log the cost:

mcp__spendlog__add_expense({
  amount: 0.07,
  description: "Service: Description for PROJECT",
  category: "IT & Software"
})
```

---

## Examples

### Domain purchase

```
User: "Register example.com on Cloudflare"

Claude registers domain ($9.77), then:

mcp__spendlog__add_expense({
  amount: 9.00,
  description: "Domain: example.com (Cloudflare, 1 year)",
  category: "IT & Software"
})

> Domain example.com registered. Cost: 9.00 EUR, logged to Spendlog.
```

### Image generation

```
User: "Create 3 logo variants with Ideogram"

Claude generates 3 images ($0.24), then:

mcp__spendlog__add_expense({
  amount: 0.22,
  description: "Ideogram: 3 logo variants for MyProject",
  category: "IT & Software"
})

> 3 logo variants created. Cost: 0.22 EUR (3x Ideogram), logged to Spendlog.
```

### Monthly overview

```
User: "What did I spend this month?"

Claude calls:
mcp__spendlog__get_summary({ period: "month", year: 2026, month: 3 })

> March 2026: Income 0.00 EUR, Expenses 45.50 EUR
> Top categories: IT & Software 42.00 EUR, Marketing 3.50 EUR
```

---

## Multi-Project Setup

Spendlog is registered at user scope, so all your projects share the same database. To assign costs to a specific project, either:

- Pass `project: "my-project"` to individual tool calls
- Set `SPENDLOG_PROJECT` env var per project in `.mcp.json`

---

## Troubleshooting

**Tools not showing up:**

```bash
claude mcp remove spendlog
claude mcp add spendlog --scope user -- npx -y --package=spendlog spendlog-mcp
```

Then restart Claude.

**Database errors:**

```bash
npx spendlog db:reset
```

Warning: this deletes all data.
