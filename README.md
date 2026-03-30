# Spendlog

**Expense tracking for freelancers, inside Claude. No apps. No spreadsheets.**

Track expenses, send invoices, manage budgets — all in natural language. Your data stays local in SQLite.

<p align="center">
  <a href="https://www.npmjs.com/package/spendlog"><img src="https://img.shields.io/npm/v/spendlog?color=6366f1&label=npm" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/spendlog"><img src="https://img.shields.io/npm/dm/spendlog?color=6366f1&label=downloads" alt="npm downloads" /></a>
  <a href="https://github.com/makz81/spendlog/actions/workflows/ci.yml"><img src="https://github.com/makz81/spendlog/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <img src="https://img.shields.io/badge/tools-42-34d399" alt="42 MCP tools" />
  <img src="https://img.shields.io/badge/tests-382%20passing-brightgreen" alt="382 tests" />
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT License" /></a>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/makz81/spendlog/main/docs/demo_1.png" alt="Spendlog monthly summary in Claude" width="600" />
</p>

## Quick Start

```bash
npx spendlog
```

Or one-click install:

[![Install in VS Code](https://img.shields.io/badge/Install_in-VS_Code-0098FF?style=flat-square&logo=visualstudiocode&logoColor=white)](https://vscode.dev/redirect/mcp/install?name=spendlog&config=%7B%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22--package%3Dspendlog%22%2C%22spendlog-mcp%22%5D%7D)
[![Install in Cursor](https://img.shields.io/badge/Install_in-Cursor-000000?style=flat-square&logoColor=white)](https://cursor.com/en/install-mcp?name=spendlog&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIi0tcGFja2FnZT1zcGVuZGxvZyIsInNwZW5kbG9nLW1jcCJdfQ==)

The installer auto-configures Claude Desktop and Claude Code. Restart Claude, then try:

> "Track 50€ for hosting"

That's it. Requires Node.js 20+.

## Why Spendlog?

- **Zero context-switching** — track expenses while you work, right where you already are
- **Local-first** — all data in `~/.spendlog/spendlog.db`, no account needed
- **Natural language** — no forms, no menus, just tell Claude what you spent
- **42 tools** — not a toy: invoicing, budgets, recurring expenses, tax export, multi-project tracking

## Examples

**Tracking:**
```
You: "29€ for ChatGPT subscription"
Claude: Expense saved: 29.00 € — Category: IT & Software

You: "Export 2025 for my accountant"
Claude: 247 transactions written to ~/spendlog-export-2025.csv
```

**Invoices:**
```
You: "Create invoice for TechCorp, web development, 8h at 95€/h"
Claude: Invoice #2026-004 created — 760.00 € — PDF saved

You: "Mark it as paid"
Claude: Invoice #2026-004 marked as paid, income recorded.
```

**Analysis:**
```
You: "How much did I spend on software this quarter?"
Claude: IT & Software: 287.00 € (12 transactions) — 23% of total expenses

You: "Compare January vs February"
Claude: Expenses up 15%. Biggest increase: Marketing (+120€)
```

## Tools

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
| **Sync & Settings** | `connect` `disconnect` `sync_now` `get_profile` `set_profile` and more |

## Configuration

<details>
<summary>Manual setup (if the installer didn't work)</summary>

**Claude Desktop** — edit your config file:

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

**Claude Code:**

```bash
claude mcp add spendlog -- npx -y --package=spendlog spendlog-mcp
```

</details>

### Environment variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SPENDLOG_LANGUAGE` | `en` or `de` | `en` |
| `SPENDLOG_DATA_DIR` | Data directory path | `~/.spendlog` |
| `DATABASE_PATH` | Full path to SQLite database | `$SPENDLOG_DATA_DIR/spendlog.db` |
| `SPENDLOG_PROJECT` | Default project for all transactions | none |

### PDF Invoices (optional)

For PDF invoice generation, install Puppeteer separately:

```bash
npm install -g puppeteer
```

Invoices work without Puppeteer — they just won't have a PDF file.

## Privacy

All data stays on your machine. Cloud sync via [spendlog.dev](https://spendlog.dev) is opt-in.

**Note:** Spendlog is a tracker, not accounting software. Use it for personal insights, not official bookkeeping.

## Development

```bash
git clone https://github.com/makz81/spendlog.git
cd spendlog
npm install
npm run dev
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for architecture details and how to add new tools.

## License

[MIT](LICENSE)
