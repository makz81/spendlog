<p align="center">
  <img src="https://spendlog.dev/logo.svg" alt="Spendlog" width="80" />
</p>

<h1 align="center">Spendlog</h1>

<p align="center">
  <strong>Track finances where you already work.</strong><br>
  An MCP server that brings expense tracking, invoices, and insights directly into Claude.
</p>

<p align="center">
  <a href="https://spendlog.dev">Website</a> •
  <a href="https://spendlog.dev/docs">Docs</a> •
  <a href="#installation">Install</a> •
  <a href="#usage">Usage</a> •
  <a href="https://github.com/makz81/spendlog/issues">Issues</a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/spendlog"><img src="https://img.shields.io/npm/v/spendlog?color=6366f1&label=npm" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/spendlog"><img src="https://img.shields.io/npm/dm/spendlog?color=6366f1&label=downloads" alt="npm downloads" /></a>
  <a href="https://github.com/makz81/spendlog/actions/workflows/ci.yml"><img src="https://github.com/makz81/spendlog/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <img src="https://img.shields.io/badge/MCP-compatible-34d399" alt="MCP compatible" />
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT License" /></a>
</p>

---

## Why Spendlog?

You're deep in a coding session with Claude. You just paid for hosting. Now you have to:
1. Open a new browser tab
2. Log into your finance app
3. Find the right category
4. Enter the expense
5. Context: **destroyed**

**With Spendlog:** Just tell Claude. Done.

---

## Demo

<p align="center">
  <img src="demo.gif" alt="Spendlog Demo — Install, Track, Insights" width="680" />
</p>

---

## Installation

### Quick Install (Recommended)

```bash
npx spendlog
```

The interactive installer will:
1. Detect your Claude app (Desktop or Code)
2. Add Spendlog to your MCP config
3. Create the local database

**Then restart Claude** to load the new MCP server.

### Verify It Works

After restarting, try saying this to Claude:

```
"Track 1€ test expense"
```

If you see a confirmation like "Expense saved: 1.00 €", you're all set!

> **Requirements:** Node.js 20+ — Check with `node --version`
>
> **Detailed guide:** [spendlog.dev/docs](https://spendlog.dev/docs)

---

## Usage

Just talk to Claude naturally:

| You say | Spendlog does |
|---------|---------------|
| "Track 50€ for hosting" | Saves expense with auto-category |
| "I earned 1200€ from consulting" | Records income |
| "How was Q1?" | Shows quarterly summary |
| "What did I spend on software?" | Category breakdown |
| "Create invoice for Client X, 500€" | Generates PDF invoice |
| "Show my recurring expenses" | Lists subscriptions |
| "Export 2025 for my accountant" | CSV/JSON export |

### Language Support

Spendlog understands English and German. Use your preferred language or currency.

---

## Common Workflows

### Daily Expense Tracking

```
You: "29€ for ChatGPT subscription"
Claude: ✓ Expense saved: 29.00 € for "ChatGPT subscription"
        Category: IT & Software

You: "Also 12€ for Spotify, that's personal though"
Claude: ✓ Expense saved: 12.00 € for "Spotify"
        Category: Sonstiges
```

### End of Month Review

```
You: "Give me a summary of this month"
Claude: 📊 January 2026
        ─────────────────────
        Income:     2,450.00 €
        Expenses:     687.50 €
        ─────────────────────
        Profit:     1,762.50 €

        Top Expenses:
        • IT & Software: 234.00 €
        • Marketing: 180.00 €
        • Office: 89.50 €

You: "What did I spend the most on?"
Claude: 📊 Category Breakdown (January 2026)

        IT & Software      234.00 €  ████████████░░  34%
        Marketing          180.00 €  █████████░░░░░  26%
        Office              89.50 €  ████░░░░░░░░░░  13%
        ...
```

### Creating Invoices

```
You: "Create an invoice for TechCorp"
Claude: I'll create an invoice for TechCorp. What services should I include?

You: "Web development, 8 hours at 95€/hour"
Claude: ✓ Invoice #2026-004 created
        Client: TechCorp
        Total: 760.00 €
        PDF saved: ~/invoices/2026-004.pdf

You: "Mark it as paid"
Claude: ✓ Invoice #2026-004 marked as paid
        Income recorded: 760.00 €
```

### Recurring Expenses

```
You: "I pay 49€ monthly for Notion"
Claude: ✓ Recurring expense created
        Amount: 49.00 €
        Frequency: Monthly
        Category: IT & Software
        Next: 2026-02-01

You: "Show all my subscriptions"
Claude: 📋 Recurring Expenses

        Monthly:
        • Notion           49.00 €
        • Hetzner          18.00 €
        • GitHub           4.00 €
        ─────────────────────────
        Total/month:       71.00 €
```

### Year-End Export

```
You: "Export all transactions from 2025 for my accountant"
Claude: ✓ Export complete
        File: ~/spendlog-export-2025.csv
        Transactions: 247
        Period: 2025-01-01 to 2025-12-31
```

---

## Features

**42 MCP tools** — the most complete finance toolkit for Claude.

### Core
- **Natural Language** — No syntax to learn. Talk like you talk.
- **Local-First** — Your data stays on your machine. SQLite in `~/.spendlog/`
- **PDF Invoices** — Professional invoices with auto-numbering
- **i18n** — English (default), German

### Organization
- **Categories** — Built-in SKR03 + custom categories
- **Recurring** — Track subscriptions, auto-create transactions
- **Projects** — Tag expenses by project for per-project P&L
- **Budgets** — Set spending limits with real-time tracking

### Insights
- **Tax Export** — DATEV-compatible CSV for your accountant
- **Period Comparison** — Compare months, quarters, or years
- **Category Breakdown** — Visual spending analysis

### Sync (Optional)
- **Cloud Dashboard** — Charts and multi-device access at [spendlog.dev](https://spendlog.dev)
- **Magic Link Auth** — No passwords, just email

---

## Manual Configuration

If the installer didn't work, follow these steps:

### Claude Desktop

**Step 1:** Find your config file

| OS | Path |
|----|------|
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |
| Linux | `~/.config/Claude/claude_desktop_config.json` |

**Step 2:** Add this to your config (create the file if it doesn't exist):

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

**Step 3:** Quit and reopen Claude Desktop

**Step 4:** Look for the hammer icon — click it to see Spendlog tools

### Claude Code

**Option A: Per-project**

```bash
claude mcp add spendlog -- npx -y --package=spendlog spendlog-mcp
```

**Option B: Global (all projects)**

Add to `~/.claude/settings.json`:

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

> **Stuck?** Check the [troubleshooting guide](https://spendlog.dev/docs#troubleshooting)

---

## MCP Tools

**42 tools** across 9 categories:

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

[Full API Reference →](https://spendlog.dev/docs)

---

## Privacy & Data

- **Local by default** — All data in `~/.spendlog/spendlog.db`
- **Cloud is opt-in** — Only syncs if you run `connect`
- **You own your data** — Export anytime, delete anytime
- **No tracking** — We don't know what you spend on

---

## FAQ

**Is this a real accounting tool?**
No. Spendlog is a tracker, not accounting software. It's not tax-compliant. Use it for personal insights, not official bookkeeping.

**Can I use it with multiple devices?**
Yes, via the optional cloud sync. Run `connect` in Claude to link your account.

**Does it support [my currency]?**
Yes. Enter amounts in any currency. Spendlog stores the number and description as-is.

**Is it free?**
Yes! Spendlog is free and open source (MIT). All features — tracking, invoices, export, budgets, recurring, projects — are included.

---

## Development

```bash
git clone https://github.com/makz81/spendlog.git
cd spendlog
npm install
npm run dev
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for development docs.

---

## License

MIT — Built for developers who hate finance apps.

<p align="center">
  <a href="https://spendlog.dev">spendlog.dev</a>
</p>
