# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[1.0.0]: https://github.com/makz81/spendlog/releases/tag/v1.0.0
