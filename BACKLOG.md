# Spendlog Backlog

> **Pivot (2026-06-05):** Nach dem Produkt-Audit (`docs/PRODUCT_AUDIT_2026-06.md`) ist Spendlog
> ein fokussiertes **Claude-Code-Tool für Solo-Entrepreneurs zum Kosten-Tracking** — kein Web-Login,
> kein Cloud-Sync, nur eine Marketing-Website. Bezahl-Dashboard/Sync-Strategie aufgegeben.
> Monetarisierung vorerst zurückgestellt (Option B "B2B via Steuerberater" nur nach Discovery).

## Daily Tasks

| Task | Frequency | Last Done | Notes |
|------|-----------|-----------|-------|
| — | — | — | No daily tasks defined yet |

## Backlog

### Done
| ID | Task | Priority | Effort | Status |
|----|------|----------|--------|--------|
| SL-001a | ~~GSC access — API connected~~ | P0 | - | done |
| SL-001b | ~~Prerender/SSR for spendlog.dev SPA~~ | P0 | L | done |
| SL-002 | ~~Review dashboard business case~~ (superseded by SL-019) | P1 | S | done |
| SL-003 | ~~Add npm keywords / package.json SEO~~ | P2 | S | done |
| SL-004 | ~~Improve README for npm~~ | P2 | M | done |
| SL-005 | ~~Set up CI (GitHub Actions)~~ | P2 | M | done |
| SL-006 | ~~Commit docs/MANUAL_TEST_GUIDE.md~~ | P3 | XS | done |
| SL-019 | ~~Deep product/tech/security/strategy audit~~ | P0 | L | done |
| SL-020 | ~~Reposition CLI (README + package.json) to solo-entrepreneur cost tracking~~ | P0 | S | done |
| SL-021 | ~~Remove sync/connect code + i18n (no web login)~~ | P1 | M | done |
| SL-022 | ~~Fix CSV/DATEV formula injection in exports~~ | P0 | S | done |
| SL-023 | ~~Money fields read as numbers (decimal transformer)~~ | P0 | M | done |

### Open

**Code hygiene (from audit — independent of strategy)**
| ID | Task | Priority | Effort | Status | Notes |
|----|------|----------|--------|--------|-------|
| SL-024 | Replace `synchronize:true` with versioned migrations + backup-before-migrate | P1 | M | open | `data-source.ts:32` — data-loss risk on npm updates; also fix `db:reset` path. Prereq for true integer-cents storage |
| SL-028 | Integer-cents storage (after SL-024) | P2 | M | open | Transformer (SL-023) already guarantees numbers; this is the arithmetic gold standard, needs migration of existing DBs |
| SL-025 | Remove dead PDF artifacts (`templates/invoice.hbs`, `Invoice.pdfPath`, "deletes PDF" strings) | P3 | XS | open | PDF generation never implemented |
| SL-008 | Fix & merge Dependabot PRs (#18 dev-deps, #19 prod-deps) | P1 | S | open | Both failing CI — needs investigation |

**Website pivot (spendlog-dashboard repo)**
| ID | Task | Priority | Effort | Status | Notes |
|----|------|----------|--------|--------|-------|
| SL-026 | Reduce spendlog-dashboard to static marketing site (no login/Supabase) | P1 | L | open | Core of the pivot — kill auth/dashboard UI |
| SL-027 | Remove orphaned sync endpoints + tables (`/auth/link`, `/auth/link/status`, `/sync/transactions`) | P1 | S | open | Now dead — no client calls them after SL-021 |
| SL-016 | Update softwareVersion in JSON-LD to current version | P3 | XS | open | Says 1.0.0 in spendlog-dashboard |
| SL-009 | Verify pre-render deployment on spendlog.dev | P2 | XS | open | Check crawlable HTML in browser source |

**SEO / Discovery**
| ID | Task | Priority | Effort | Status | Notes |
|----|------|----------|--------|--------|-------|
| SL-010 | Submit sitemap to GSC | P1 | XS | open | No sitemap registered yet |
| SL-011 | List on MCP directories (mcp.so, glama.ai) | P1 | S | open | Reaches devs, not the ICP — modest leverage |
| SL-012 | Monitor indexing & identify quick wins via GSC | P2 | S | open | After sitemap + crawl, check coverage |
| SL-013 | Test npm search discoverability | P2 | XS | open | Search "expense tracker mcp" etc., verify ranking |

**Community / Awareness**
| ID | Task | Priority | Effort | Status | Notes |
|----|------|----------|--------|--------|-------|
| SL-017 | Launch post (r/ClaudeAI, r/selbststaendig, Show HN) | P1 | M | open | New positioning (solo entrepreneurs); also the demand-signal / go-no-go instrument |
| SL-018 | Check GitHub issues for community activity | P2 | XS | open | Open good-first-issues, 0 contributions so far |
| SL-014 | Add `search_transactions` tool | P2 | M | open | GitHub #6, good first issue |
| SL-015 | Add `get_balance` tool | P2 | M | open | GitHub #7, good first issue |

### Parked (revisit only if monetization is reopened)
| ID | Task | Priority | Effort | Status | Notes |
|----|------|----------|--------|--------|-------|
| SL-007 | MVP Konnektor (lexoffice/sevDesk) | — | XL | parked | Was the paid-dashboard wedge; only relevant if Option B (B2B via Steuerberater) is validated |

## Priority Legend

- **P0**: Blocking / critical
- **P1**: Important, do soon
- **P2**: Nice to have
- **P3**: Low priority

## Effort Legend

- **XS**: <15 min | **S**: <1h | **M**: 1-4h | **L**: 4h+ | **XL**: multi-day
