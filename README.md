# spendlog-mcp

An MCP server for tracking expenses, income, and invoices directly inside Claude.

<p align="center">
  <a href="https://www.npmjs.com/package/spendlog-mcp"><img src="https://img.shields.io/npm/v/spendlog-mcp?color=6366f1&label=npm" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/spendlog-mcp"><img src="https://img.shields.io/npm/dm/spendlog-mcp?color=6366f1&label=downloads" alt="npm downloads" /></a>
  <a href="https://github.com/makz81/spendlog-mcp/actions/workflows/ci.yml"><img src="https://github.com/makz81/spendlog-mcp/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <img src="https://img.shields.io/badge/tools-42-34d399" alt="42 MCP tools" />
  <img src="https://img.shields.io/badge/tests-382%20passing-brightgreen" alt="382 tests" />
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT License" /></a>
</p>

## Quick Start

```bash
npx spendlog-mcp
```

The installer detects Claude Desktop or Claude Code, adds the MCP config, and creates a local SQLite database. Restart Claude afterward.

To verify: tell Claude `"Track 1€ test expense"`. If it confirms, you're set.

> Requires Node.js 20+. See [spendlog.dev/docs](https://spendlog.dev/docs) for a detailed setup guide.

## What it does

- Track expenses and income in natural language
- Generate PDF invoices with auto-numbering
- Set budgets with spending limits per category
- Manage recurring expenses (subscriptions, rent, etc.)
- Tag transactions by project for per-project profit/loss
- Export to CSV/JSON, including DATEV-compatible format for accountants
- Compare spending across months, quarters, or years
- Built-in SKR03 categories, plus custom ones
- English and German (i18n)
- All data stored locally in `~/.spendlog/spendlog.db` -- cloud sync is opt-in

## Examples

**Tracking expenses:**
```
You: "29€ for ChatGPT subscription"
Claude: Expense saved: 29.00 € — Category: IT & Software

You: "Export 2025 for my accountant"
Claude: Export complete — 247 transactions written to ~/spendlog-export-2025.csv
```

**Invoices:**
```
You: "Create invoice for TechCorp, web development, 8h at 95€/h"
Claude: Invoice #2026-004 created — 760.00 € — PDF saved to ~/invoices/2026-004.pdf

You: "Mark it as paid"
Claude: Invoice #2026-004 marked as paid, income recorded.
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
| **Sync** | `connect` `disconnect` `connection_status` `sync_now` `sync_status` |
| **Settings** | `get_profile` `set_profile` `get_notifications` |

[Full API reference](https://spendlog.dev/docs)

## Configuration

If the installer didn't work, add Spendlog manually.

**Claude Desktop** — edit your config file ([location by OS](https://spendlog.dev/docs#troubleshooting)):

```json
{
  "mcpServers": {
    "spendlog": {
      "command": "npx",
      "args": ["-y", "spendlog-mcp"]
    }
  }
}
```

**Claude Code:**

```bash
claude mcp add spendlog -- npx -y spendlog-mcp
```

### Environment variables

Pass these via the `env` key in your MCP config:

| Variable | Description | Default |
|----------|-------------|---------|
| `SPENDLOG_LANGUAGE` | `en` or `de` | `en` |
| `SPENDLOG_DATA_DIR` | Data directory path | `~/.spendlog` |
| `SPENDLOG_PROJECT` | Default project for all transactions | none |

## Privacy

All data stays on your machine by default. Cloud sync (via [spendlog.dev](https://spendlog.dev)) is opt-in -- run `connect` to enable it.

**Note:** Spendlog is a tracker, not accounting software. It's not tax-compliant. Use it for personal insights, not official bookkeeping.

## Development

```bash
git clone https://github.com/makz81/spendlog-mcp.git
cd spendlog-mcp
npm install
npm run dev
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## License

[MIT](LICENSE)
