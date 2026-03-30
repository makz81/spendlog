# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.x     | Yes       |

## Reporting a Vulnerability

**Do NOT open a public issue for security vulnerabilities.**

Preferred: use [GitHub Private Vulnerability Reporting](https://github.com/makz81/spendlog/security) (Security tab → "Report a vulnerability").

Or email: security@spendlog.dev

You will receive a response within 48 hours. We will work with you to understand
the issue and coordinate a fix before any public disclosure.

## Scope

- The Spendlog MCP server (`src/`)
- The npm package distribution

Cloud infrastructure (spendlog.dev) is out of scope for this repository
but can be reported to the same email.

## Data Handling

- All data is stored locally in `~/.spendlog/spendlog.db` (SQLite)
- Cloud sync is opt-in and requires explicit `connect` action
- No telemetry, no analytics, no tracking in the open-source package
