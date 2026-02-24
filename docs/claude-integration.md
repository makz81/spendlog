# Claude Code Integration

Spendlog is designed for seamless integration with Claude Code. This guide shows how to set up automatic expense tracking in your Claude workflow.

## Quick Start

### 1. Register MCP

```bash
claude mcp add spendlog \
  --scope user \
  -- node /absolute/path/to/spendlog/dist/index.js
```

### 2. Verify

```bash
claude mcp list
# spendlog: ✓ Connected
```

---

## Available MCP Tools

### Expenses & Income

| Tool | Description |
|------|-------------|
| `add_expense` | Record an expense |
| `add_income` | Record income |
| `list_transactions` | List transactions |
| `delete_transaction` | Delete a transaction |

### Summaries

| Tool | Description |
|------|-------------|
| `get_summary` | Monthly/quarterly overview |
| `get_category_breakdown` | Expenses by category |

### Profile & Invoices

| Tool | Description |
|------|-------------|
| `get_profile` / `set_profile` | Manage company data |
| `create_invoice` | Create invoice (PDF) |
| `list_invoices` / `get_invoice` | Manage invoices |
| `mark_invoice_sent` / `mark_invoice_paid` | Update invoice status |

### Export

| Tool | Description |
|------|-------------|
| `export_transactions` | CSV/JSON export |
| `export_invoices` | Export invoices |

---

## Automatic API Cost Tracking

### The Problem

Developers use many paid APIs:
- Image generation (DALL-E, Ideogram, Flux)
- LLM APIs (OpenAI, Anthropic)
- Domains & hosting
- SaaS tools

These costs add up but are rarely tracked.

### The Solution

Spendlog + Claude Code = Automatic Tracking

```
User: "Create a logo with Ideogram"

Claude:
1. Calls Ideogram ($0.08)
2. Automatically logs to Spendlog
3. Informs user about costs

"✅ Logo created
 💰 Cost: 0.07€
 📊 Automatically logged to Spendlog"
```

---

## Workflow Rule for Your Project

Add this rule to your project (`.claude/rules/expense-tracking.md`):

```markdown
# Expense Tracking

## Mandatory

After EVERY paid API call:

1. Calculate cost (USD → EUR)
2. Log to Spendlog:
   ```
   mcp__spendlog__add_expense({
     amount: <EUR>,
     description: "<Service>: <What> for <Project>",
     category: "IT & Software"
   })
   ```
3. Inform user

## Paid Services

- Ideogram: $0.08/image
- DALL-E: $0.04/image
- Replicate: $0.06/image
- OpenAI API: variable
- Domains: ~$3-15/year

## Free Services (don't track)

- Nanobanana: 1,500/day free
- Cloudflare: Workers 100k/day, Pages unlimited
- Supabase: 500MB, 50k MAU free
```

---

## CLAUDE.md Integration

Add to your project's CLAUDE.md:

```markdown
## Expense Tracking

Spendlog MCP is connected for automatic cost tracking.

**After paid API calls:**
```typescript
mcp__spendlog__add_expense({
  amount: 0.07,
  description: "Service: Description for PROJECT",
  category: "IT & Software"
})
```

**Get overview:**
```typescript
mcp__spendlog__get_summary({ period: "month" })
```
```

---

## Examples

### Buy a Domain

```
User: "Register example.com on Cloudflare"

Claude: [Registers domain - $9.77]

mcp__spendlog__add_expense({
  amount: 9.00,
  description: "Domain: example.com (Cloudflare, 1 year)",
  category: "IT & Software"
})

"✅ Domain example.com registered
 💰 Cost: 9.00€
 📊 Logged to Spendlog"
```

### Generate Logo

```
User: "Create 3 logo variants with Ideogram"

Claude: [3x Ideogram API = $0.24]

mcp__spendlog__add_expense({
  amount: 0.22,
  description: "Ideogram: 3 logo variants for MyProject",
  category: "IT & Software"
})

"✅ 3 logo variants created
 💰 Cost: 0.22€ (3x Ideogram)
 📊 Logged to Spendlog"
```

### Monthly Overview

```
User: "What did I spend this month?"

Claude:
mcp__spendlog__get_summary({
  period: "month",
  year: 2026,
  month: 1
})

"📊 January 2026
 Income: €0.00
 Expenses: €45.50

 Top Categories:
 • IT & Software: €42.00
 • Marketing: €3.50"
```

---

## Multi-Project Setup

If you have multiple projects, use a central Spendlog:

```
~/Projects/
├── spendlog/           # Central installation
├── project-a/
│   └── .claude/
│       └── skills/
│           └── expense-tracker/  # Copied
├── project-b/
│   └── .claude/
│       └── skills/
│           └── expense-tracker/  # Copied
```

All projects share the same Spendlog MCP (user-scope).

---

## Troubleshooting

### Tools not available

```bash
# Reload MCP
claude mcp remove spendlog
claude mcp add spendlog --scope user -- node /path/to/dist/index.js

# Restart Claude Code
```

### Database errors

```bash
cd /path/to/spendlog
npm run db:reset  # Warning: Deletes all data!
```

### Category not found

Use these exact categories:
- "IT & Software"
- "Marketing & Werbung"
- "Büro & Material"
- "Reisen & Transport"
- "Weiterbildung"
- "Telefon & Internet"
- "Versicherungen"
- "Sonstiges"
