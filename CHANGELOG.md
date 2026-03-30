# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.5] - 2026-03-30

### Added

- New `delete_invoice` tool for removing invoices and their PDFs
- EN category name aliases in DATEV export (works with both EN and DE seeded categories)
- SQLite foreign key constraints enabled (`PRAGMA foreign_keys = ON`)
- WAL mode for better concurrent read performance
- Unique constraints on Invoice (userId + invoiceNumber), Category (name + type + userId), Project (name + userId)

### Fixed

- `list_categories` response now uses English keys (`income`/`expense`/`is_default`) instead of German
- `duplicate_invoice` date parameters now validated with YYYY-MM-DD format
- `process_recurring` catch-up loop capped at 100 transactions to prevent runaway creation
- CSV export now escapes category names containing semicolons or quotes
- Invoice creation no longer throws when Puppeteer is missing — saves invoice, warns about PDF
- Demo image in README uses absolute URL (renders correctly on npmjs.com)
- Removed tracked `.DS_Store` from `.github/`

## [1.0.4] - 2026-03-30

### Changed

- Added `mcpName` field to package.json (required by MCP Registry)
- Published to official MCP Registry as `io.github.makz81/spendlog`

## [1.0.3] - 2026-03-30

### Changed

- Version bump for MCP Registry publish

## [1.0.2] - 2026-03-29

### Fixed

- Fix flaky notifications test (date-dependent tax reminder)
- Clean up for public release

## [1.0.1] - 2026-03-23

### Changed

- Renamed npm package from `spendlog-mcp` to `spendlog`
- Fixed permission denied on npx: chmod +x bin files in prepublish

## [1.0.0] - 2026-02-25

### Added

- MCP server for expense tracking via Claude (stdio and HTTP/SSE transport)
- Income and expense tracking with categories and projects
- Invoice generation with PDF export (via Puppeteer)
- Budget tracking with alerts and thresholds
- Recurring transactions (weekly, monthly, quarterly, yearly)
- Project management with budget tracking
- Financial summaries (monthly, quarterly, yearly)
- Category breakdown and period comparison
- Tax overview with SKR03/SKR04 account mapping
- Export: CSV, JSON, and DATEV-compatible formats
- Notification system (due recurring, overdue invoices, budget warnings)
- Web dashboard connection with sync support
- CLI installer (`npx spendlog`) for Claude Code and Claude Desktop
- Internationalization: English (default) and German
- Profile management for invoice generation
- SQLite database with TypeORM (local at `~/.spendlog/spendlog.db`)

[1.0.5]: https://github.com/makz81/spendlog/compare/v1.0.4...v1.0.5
[1.0.4]: https://github.com/makz81/spendlog/compare/v1.0.3...v1.0.4
[1.0.3]: https://github.com/makz81/spendlog/compare/v1.0.2...v1.0.3
[1.0.2]: https://github.com/makz81/spendlog/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/makz81/spendlog/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/makz81/spendlog/releases/tag/v1.0.0
