# Changelog

## 1.0.1 (2026-02-13)

### Changed

- **Freemium model: Feature-Gate statt Usage-Gate** — Transactions are now unlimited for all users. PRO features: PDF invoices, CSV/JSON export, cloud sync, unlimited recurring & budgets.
- Removed monthly transaction limit (was 50/month)
- Added PRO gate for `create_invoice`, `duplicate_invoice`, `export_transactions`, `export_invoices`, `connect`, `sync_now`
- Added free tier limit for recurring transactions (max 3)
- CLI: Version now read from package.json instead of hardcoded
- CLI: Fixed spinner ANSI escape for cleaner output

## 1.0.0 (2026-02-11)

Initial release.

### Features

- **42 MCP tools** for expense tracking, invoicing, budgets, projects, and more
- **CLI onboarding** via `npx spendlog` — auto-detects Claude Code and Desktop
- **Freemium model** — unlimited tracking free, PRO 5€/month for invoices, export & sync
- **PDF invoices** with auto-numbering, customizable templates, and Puppeteer rendering
- **DATEV/SKR03 tax export** — CSV export compatible with German tax advisors
- **Recurring transactions** — subscriptions with automatic processing
- **Budgets** — per-category spending limits with real-time status
- **Projects** — tag transactions for per-project P&L tracking
- **Period comparison** — compare months, quarters, or years side by side
- **i18n** — English (default), German, Spanish, French
- **Cloud sync** — optional sync to web dashboard at spendlog.dev
- **Local-first** — SQLite database, no network required
