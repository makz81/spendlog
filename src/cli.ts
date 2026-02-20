#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { homedir, platform } from 'os';
import { join, dirname } from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import Database from 'better-sqlite3';
import { initI18n, t, getLocale, getIntlLocale } from './i18n/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PACKAGE_NAME = 'spendlog';
const MCP_SERVER_BIN = 'spendlog-mcp';
const VERSION = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf-8')).version;

// ============================================================================
// Types
// ============================================================================

interface TransactionRow {
  type: string;
  amount: number;
  category_name: string | null;
}

interface ExportRow {
  id: string;
  date: string;
  type: string;
  amount: number;
  description: string;
  category_name: string | null;
}

interface DateRange {
  start: Date;
  end: Date;
  label: string;
}

interface CategoryTotal {
  category_name: string | null;
  total: number;
  count: number;
}

// ============================================================================
// Date Helpers
// ============================================================================

function getMonthName(month: number): string {
  const date = new Date(2024, month, 1);
  return new Intl.DateTimeFormat(getIntlLocale(), { month: 'long' }).format(date);
}

function getMonthRange(year: number, month: number): DateRange {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0, 23, 59, 59);
  const label = `${getMonthName(month)} ${year}`;
  return { start, end, label };
}

function getYearRange(year: number): DateRange {
  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31, 23, 59, 59);
  const label = t('cli.yearLabel', { year });
  return { start, end, label };
}

function parsePeriodArg(arg: string | undefined, args: string[]): DateRange {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  // Check for flags
  const hasLastFlag = args.includes('--last') || args.includes('-l');
  const hasYearFlag = args.includes('--year') || args.includes('-y');

  if (hasYearFlag) {
    return getYearRange(currentYear);
  }

  if (hasLastFlag) {
    const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const lastYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    return getMonthRange(lastYear, lastMonth);
  }

  // Check for specific period argument (YYYY-MM or YYYY)
  if (arg && /^\d{4}-\d{2}$/.test(arg)) {
    const [year, month] = arg.split('-').map(Number);
    return getMonthRange(year, month - 1);
  }

  if (arg && /^\d{4}$/.test(arg)) {
    return getYearRange(parseInt(arg, 10));
  }

  // Default: current month
  return getMonthRange(currentYear, currentMonth);
}

interface ClaudeConfig {
  mcpServers?: Record<string, McpServerConfig>;
  [key: string]: unknown;
}

interface McpServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

// ============================================================================
// Path Helpers
// ============================================================================

function getClaudeDesktopConfigPath(): string {
  const home = homedir();
  switch (platform()) {
    case 'darwin':
      return join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
    case 'win32':
      return join(home, 'AppData', 'Roaming', 'Claude', 'claude_desktop_config.json');
    default:
      return join(home, '.config', 'Claude', 'claude_desktop_config.json');
  }
}

function getClaudeRulesDir(): string {
  return join(homedir(), '.claude');
}

function getDataDir(): string {
  return join(homedir(), '.spendlog');
}

const DEFAULT_INCOME_CATEGORIES = [
  { name: 'Dienstleistung', type: 'income', color: '#22c55e' },
  { name: 'Produktverkauf', type: 'income', color: '#3b82f6' },
  { name: 'Affiliate/Provision', type: 'income', color: '#8b5cf6' },
  { name: 'Sonstiges', type: 'income', color: '#6b7280' },
];

const DEFAULT_EXPENSE_CATEGORIES = [
  { name: 'IT & Software', type: 'expense', color: '#ef4444' },
  { name: 'Marketing & Werbung', type: 'expense', color: '#f97316' },
  { name: 'Büro & Material', type: 'expense', color: '#eab308' },
  { name: 'Reisen & Transport', type: 'expense', color: '#14b8a6' },
  { name: 'Weiterbildung', type: 'expense', color: '#6366f1' },
  { name: 'Telefon & Internet', type: 'expense', color: '#ec4899' },
  { name: 'Versicherungen', type: 'expense', color: '#84cc16' },
  { name: 'Sonstiges', type: 'expense', color: '#6b7280' },
];

/**
 * Ensures the database exists with schema and default data.
 * Auto-creates DB, tables, user, and categories if missing.
 * Returns the db path, or null if creation failed.
 */
function ensureDatabase(): string | null {
  const dataDir = getDataDir();
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = join(dataDir, 'spendlog.db');
  const isNew = !existsSync(dbPath);

  try {
    const db = new Database(dbPath);

    // Create tables if they don't exist
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE,
        createdAt DATETIME DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
        isDefault INTEGER DEFAULT 0,
        color TEXT,
        userId TEXT,
        FOREIGN KEY (userId) REFERENCES users(id)
      );
      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
        amount REAL NOT NULL,
        description TEXT NOT NULL,
        date DATETIME NOT NULL,
        categoryId TEXT,
        projectId TEXT,
        userId TEXT NOT NULL,
        metadata TEXT,
        createdAt DATETIME DEFAULT (datetime('now')),
        updatedAt DATETIME DEFAULT (datetime('now')),
        FOREIGN KEY (categoryId) REFERENCES categories(id),
        FOREIGN KEY (userId) REFERENCES users(id)
      );
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        budget REAL,
        status TEXT DEFAULT 'active',
        userId TEXT NOT NULL,
        createdAt DATETIME DEFAULT (datetime('now')),
        updatedAt DATETIME DEFAULT (datetime('now')),
        FOREIGN KEY (userId) REFERENCES users(id)
      );
    `);

    // Ensure default user exists
    let userRow = db.prepare('SELECT id FROM users LIMIT 1').get() as { id: string } | undefined;
    if (!userRow) {
      const userId = crypto.randomUUID();
      db.prepare('INSERT INTO users (id, createdAt) VALUES (?, ?)').run(
        userId,
        new Date().toISOString()
      );
      userRow = { id: userId };
    }

    // Seed default categories if none exist
    const catCount = db
      .prepare('SELECT COUNT(*) as count FROM categories WHERE isDefault = 1')
      .get() as { count: number };
    if (catCount.count === 0) {
      const insert = db.prepare(
        'INSERT INTO categories (id, name, type, isDefault, color, userId) VALUES (?, ?, ?, 1, ?, ?)'
      );
      for (const cat of [...DEFAULT_INCOME_CATEGORIES, ...DEFAULT_EXPENSE_CATEGORIES]) {
        insert.run(crypto.randomUUID(), cat.name, cat.type, cat.color, userRow.id);
      }
    }

    db.close();

    if (isNew) {
      console.log(chalk.green('  ✓') + chalk.gray(` ${t('cli.dbInitialized')}`));
      console.log('');
    }

    return dbPath;
  } catch {
    console.log(chalk.red(`  ${t('cli.dbError')}`));
    console.log('');
    return null;
  }
}

function noDataYetMessage(): void {
  console.log(chalk.yellow(`  ${t('cli.noDataYet')}`));
  console.log(chalk.gray(`  ${t('cli.noDataStartWith')}`));
  console.log(chalk.cyan('    npx spendlog add expense 50 Hosting'));
  console.log(chalk.gray(`  ${t('cli.noDataOrSay')}`));
  console.log(chalk.cyan(`    ${t('cli.noDataExample')}`));
  console.log('');
}

// ============================================================================
// Config Helpers
// ============================================================================

function readClaudeConfig(configPath: string): ClaudeConfig {
  if (!existsSync(configPath)) {
    return {};
  }
  try {
    const content = readFileSync(configPath, 'utf-8');
    return JSON.parse(content) as ClaudeConfig;
  } catch {
    return {};
  }
}

function writeClaudeConfig(configPath: string, config: ClaudeConfig): void {
  const dir = join(configPath, '..');
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(configPath, JSON.stringify(config, null, 2));
}

function isClaudeCodeInstalled(): boolean {
  try {
    execSync('claude --version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function isClaudeDesktopInstalled(): boolean {
  return (
    existsSync(getClaudeDesktopConfigPath()) || existsSync(join(getClaudeDesktopConfigPath(), '..'))
  );
}

// ============================================================================
// Smart Expense Tracking Rules (Confidence-Based)
// ============================================================================

const CLAUDE_RULES_EN = `# Spendlog - Smart Expense Tracking

Spendlog MCP is installed. Track expenses and income automatically.

## Known Costs (auto-track, just inform user)

| Tool/Pattern | Cost | Category |
|--------------|------|----------|
| mcp__nanobanana__* | $0.039/image | IT & Software |
| mcp__ideogram__* | $0.08/image | IT & Software |
| DALL-E API | $0.04/image | IT & Software |
| Replicate/Flux | $0.06/image | IT & Software |
| Domain registration | ask amount | IT & Software |

## Detection Triggers

**Expenses:** "$X", "costs", "paid", "spent", "bought", "subscription", "API credits"
**Income:** "earned", "received", "payment", "invoice paid", "revenue"

## Confidence-Based Behavior

1. **HIGH** (known tool/pattern): Track silently → "💰 0.07€ logged"
2. **MEDIUM** (looks like expense): Track → "(0.07€ logged - correct?)"
3. **LOW** (unsure): Ask first → "Did this cost money?"

## Learning

When user confirms new cost, append to ~/.claude/spendlog-costs.md:
\`- [service]: $X.XX/unit (learned [date])\`

Check that file for user-specific costs before asking.

## Format

\`mcp__spendlog__add_expense({ amount: X.XX, description: "Service: What", category: "IT & Software" })\`
\`mcp__spendlog__add_income({ amount: X.XX, description: "What", category: "Dienstleistung" })\`

## Categories

Expenses: IT & Software, Marketing & Werbung, Büro & Material, Sonstiges
Income: Dienstleistung, Produktverkauf, Affiliate/Provision, Sonstiges
`;

const CLAUDE_RULES_DE = `# Spendlog - Automatisches Ausgaben-Tracking

Spendlog MCP ist installiert. Ausgaben und Einnahmen werden automatisch erfasst.

## Bekannte Kosten (automatisch tracken, nur informieren)

| Tool/Pattern | Kosten | Kategorie |
|--------------|--------|-----------|
| mcp__nanobanana__* | $0.039/Bild | IT & Software |
| mcp__ideogram__* | $0.08/Bild | IT & Software |
| DALL-E API | $0.04/Bild | IT & Software |
| Replicate/Flux | $0.06/Bild | IT & Software |
| Domain-Registrierung | Betrag fragen | IT & Software |

## Erkennungs-Trigger

**Ausgaben:** "X€", "kostet", "bezahlt", "gekauft", "Ausgabe", "Abo", "API Credits"
**Einnahmen:** "verdient", "erhalten", "Einnahme", "Umsatz", "Rechnung bezahlt"

## Konfidenz-basiertes Verhalten

1. **HOCH** (bekanntes Tool/Pattern): Still tracken → "💰 0,07€ erfasst"
2. **MITTEL** (sieht nach Ausgabe aus): Tracken → "(0,07€ erfasst - stimmt das?)"
3. **NIEDRIG** (unsicher): Erst fragen → "Hat das Geld gekostet?"

## Lernen

Wenn User neue Kosten bestätigt, in ~/.claude/spendlog-costs.md eintragen:
\`- [Service]: $X.XX/Einheit (gelernt [Datum])\`

Diese Datei vor dem Nachfragen prüfen.

## Format

\`mcp__spendlog__add_expense({ amount: X.XX, description: "Service: Wofür", category: "IT & Software" })\`
\`mcp__spendlog__add_income({ amount: X.XX, description: "Wofür", category: "Dienstleistung" })\`

## Kategorien

Ausgaben: IT & Software, Marketing & Werbung, Büro & Material, Sonstiges
Einnahmen: Dienstleistung, Produktverkauf, Affiliate/Provision, Sonstiges
`;

const LEARNED_COSTS_TEMPLATE = `# Spendlog - Learned Costs

This file is auto-updated when you confirm new cost information.
Claude reads this to remember your specific tool costs.

## Tools
<!-- Claude adds learned tool costs here -->

## Services
<!-- Claude adds learned service costs here -->

## One-Time
<!-- Claude adds one-time purchases here -->
`;

function installClaudeRules(): boolean {
  const rulesDir = getClaudeRulesDir();
  const rulesPath = join(rulesDir, 'spendlog.md');
  const learnedCostsPath = join(rulesDir, 'spendlog-costs.md');

  if (!existsSync(rulesDir)) {
    mkdirSync(rulesDir, { recursive: true });
  }

  // Write language-aware rules
  const rules = getLocale() === 'de' ? CLAUDE_RULES_DE : CLAUDE_RULES_EN;
  writeFileSync(rulesPath, rules);

  // Create learned costs file if it doesn't exist (don't overwrite user data)
  if (!existsSync(learnedCostsPath)) {
    writeFileSync(learnedCostsPath, LEARNED_COSTS_TEMPLATE);
  }

  return true;
}

function uninstallClaudeRules(): boolean {
  const rulesPath = join(getClaudeRulesDir(), 'spendlog.md');
  if (existsSync(rulesPath)) {
    unlinkSync(rulesPath);
    return true;
  }
  return false;
}

// ============================================================================
// UI Helpers
// ============================================================================

function printBanner(): void {
  console.log('');
  console.log(chalk.cyan('  ╔═══════════════════════════════════════╗'));
  console.log(
    chalk.cyan('  ║') +
      chalk.white.bold('  Spendlog MCP                         ') +
      chalk.cyan('║')
  );
  console.log(
    chalk.cyan('  ║') + chalk.gray(`  v${VERSION} - Finance tracking for Claude `) + chalk.cyan('║')
  );
  console.log(chalk.cyan('  ╚═══════════════════════════════════════╝'));
  console.log('');
}

function printSuccess(claudeCode: boolean, claudeDesktop: boolean): void {
  console.log('');
  console.log(chalk.green.bold(`  ✓ ${t('cli.installed')}`));
  console.log('');

  if (claudeCode || claudeDesktop) {
    console.log(chalk.white(`  ${t('cli.installedFor')}`));
    if (claudeCode) console.log(chalk.gray(`    • ${t('cli.claudeCodeCli')}`));
    if (claudeDesktop) console.log(chalk.gray(`    • ${t('cli.claudeDesktopApp')}`));
    console.log('');
  }

  console.log(chalk.white(`  ${t('cli.sayInClaude')}`));
  console.log(chalk.cyan(`    → ${t('cli.examplePrompt')}`));
  console.log('');
  console.log(chalk.gray(`  ${t('cli.dataLocation')}`));
  console.log('');

  if (claudeCode && !claudeDesktop) {
    console.log(chalk.green(`  ✓ ${t('cli.readyToGo')}`));
    console.log('');
  } else if (claudeDesktop) {
    console.log(chalk.yellow.bold(`  ⚠ ${t('cli.restartDesktop')}`));
    console.log(chalk.yellow(`    ${t('cli.restartDesktopHint')}`));
    console.log('');
    if (claudeCode) {
      console.log(chalk.green(`  ✓ ${t('cli.claudeCodeReady')}`));
      console.log('');
    }
  }
}

// ============================================================================
// Commands
// ============================================================================

async function install(args: string[] = []): Promise<void> {
  console.log(chalk.gray(`  ${t('cli.settingUp')}`));
  console.log('');

  // 1. Check Node version
  const nodeVersion = process.versions.node;
  const major = parseInt(nodeVersion.split('.')[0], 10);
  if (major < 18) {
    console.log(chalk.red(`  ✗ Node.js 18+ required (found ${nodeVersion})`));
    process.exit(1);
  }
  console.log(chalk.green('  ✓') + chalk.gray(` Node.js ${nodeVersion}`));

  // 2. Create data directory
  const dataDir = getDataDir();
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }
  console.log(chalk.green('  ✓') + chalk.gray(' Data directory ~/.spendlog'));

  // 3. Detect Claude installations
  const hasClaudeCode = isClaudeCodeInstalled();
  const hasClaudeDesktop = isClaudeDesktopInstalled();

  // 4. Install for Claude Code (via claude mcp add)
  let claudeCodeInstalled = false;
  if (hasClaudeCode) {
    try {
      // Check if already installed
      const mcpList = execSync('claude mcp list 2>/dev/null || echo ""', { encoding: 'utf-8' });
      if (!mcpList.includes('spendlog')) {
        process.stdout.write(chalk.gray('  ⏳ Claude Code MCP registrieren...'));
        const spinner = setInterval(() => process.stdout.write(chalk.gray('.')), 1000);
        try {
          execSync(
            `claude mcp add spendlog --scope user -- npx -y --package=${PACKAGE_NAME} ${MCP_SERVER_BIN}`,
            { stdio: 'pipe' }
          );
        } finally {
          clearInterval(spinner);
          process.stdout.write('\x1B[2K\r');
        }
      }
      claudeCodeInstalled = true;
      console.log(chalk.green('  ✓') + chalk.gray(' Claude Code MCP registered'));
    } catch {
      console.log(chalk.yellow('  ⚠') + chalk.gray(' Claude Code: Manual setup needed'));
      console.log(
        chalk.gray(
          `      claude mcp add spendlog -- npx -y --package=${PACKAGE_NAME} ${MCP_SERVER_BIN}`
        )
      );
    }
  }

  // 5. Install for Claude Desktop (config file)
  let claudeDesktopInstalled = false;
  if (hasClaudeDesktop) {
    const configPath = getClaudeDesktopConfigPath();
    const config = readClaudeConfig(configPath);

    if (!config.mcpServers) {
      config.mcpServers = {};
    }

    // Non-invasive: only add/update spendlog, don't touch other servers
    config.mcpServers['spendlog'] = {
      command: 'npx',
      args: ['-y', `--package=${PACKAGE_NAME}`, MCP_SERVER_BIN],
    };

    writeClaudeConfig(configPath, config);
    claudeDesktopInstalled = true;
    console.log(chalk.green('  ✓') + chalk.gray(' Claude Desktop config updated'));
  }

  // 6. Install Claude rules for smart tracking
  installClaudeRules();
  console.log(chalk.green('  ✓') + chalk.gray(' Smart tracking rules installed'));
  console.log(chalk.green('  ✓') + chalk.gray(' Learning file created'));

  // 7. Show what wasn't detected
  if (!hasClaudeCode && !hasClaudeDesktop) {
    console.log('');
    console.log(chalk.yellow(`  ⚠ ${t('cli.noClaudeDetected')}`));
    console.log(chalk.gray('    Install Claude Code: https://claude.ai/code'));
    console.log(chalk.gray('    Or Claude Desktop: https://claude.ai/download'));
    console.log('');
    console.log(chalk.gray('  Manual setup for Claude Code:'));
    console.log(
      chalk.white(
        `    claude mcp add spendlog -- npx -y --package=${PACKAGE_NAME} ${MCP_SERVER_BIN}`
      )
    );
  }

  printSuccess(claudeCodeInstalled, claudeDesktopInstalled);

  // Handle --project flag
  const projectIdx = args.findIndex((a) => a === '--project');
  const projectName = projectIdx !== -1 && args[projectIdx + 1] ? args[projectIdx + 1] : null;
  if (projectName) {
    console.log(chalk.gray(`  ${t('cli.settingProject')}`));
    console.log('');
    await setProject(projectName);
  }
}

async function uninstall(): Promise<void> {
  console.log(chalk.gray(`  ${t('cli.removing')}`));
  console.log('');

  // 1. Remove from Claude Code
  if (isClaudeCodeInstalled()) {
    try {
      execSync('claude mcp remove spendlog 2>/dev/null || true', { stdio: 'pipe' });
      console.log(chalk.green('  ✓') + chalk.gray(' Removed from Claude Code'));
    } catch {
      // Ignore
    }
  }

  // 2. Remove from Claude Desktop config
  const configPath = getClaudeDesktopConfigPath();
  const config = readClaudeConfig(configPath);

  if (config.mcpServers?.['spendlog']) {
    delete config.mcpServers['spendlog'];
    writeClaudeConfig(configPath, config);
    console.log(chalk.green('  ✓') + chalk.gray(' Removed from Claude Desktop'));
  }

  // 3. Remove rules
  if (uninstallClaudeRules()) {
    console.log(chalk.green('  ✓') + chalk.gray(' Removed auto-tracking rules'));
  }

  console.log('');
  console.log(chalk.gray(`  ${t('cli.dataKept')}`));
  console.log(chalk.gray(`  ${t('cli.dataDeleteHint')}`));
  console.log('');
}

async function status(): Promise<void> {
  const desktopConfigPath = getClaudeDesktopConfigPath();
  const desktopConfig = readClaudeConfig(desktopConfigPath);
  const dataDir = getDataDir();
  const rulesPath = join(getClaudeRulesDir(), 'spendlog.md');

  console.log(chalk.white(`  ${t('cli.installStatus')}`));
  console.log('');

  // Claude Code
  if (isClaudeCodeInstalled()) {
    try {
      const mcpList = execSync('claude mcp list 2>/dev/null || echo ""', { encoding: 'utf-8' });
      if (mcpList.includes('spendlog')) {
        console.log(chalk.green('  ✓') + chalk.gray(' Claude Code: Installed'));
      } else {
        console.log(chalk.yellow('  ○') + chalk.gray(' Claude Code: Not configured'));
      }
    } catch {
      console.log(chalk.yellow('  ○') + chalk.gray(' Claude Code: Unknown'));
    }
  } else {
    console.log(chalk.gray('  ○') + chalk.gray(' Claude Code: Not installed'));
  }

  // Claude Desktop
  if (desktopConfig.mcpServers?.['spendlog']) {
    console.log(chalk.green('  ✓') + chalk.gray(' Claude Desktop: Installed'));
  } else if (isClaudeDesktopInstalled()) {
    console.log(chalk.yellow('  ○') + chalk.gray(' Claude Desktop: Not configured'));
  } else {
    console.log(chalk.gray('  ○') + chalk.gray(' Claude Desktop: Not installed'));
  }

  // Rules
  if (existsSync(rulesPath)) {
    console.log(chalk.green('  ✓') + chalk.gray(' Auto-tracking rules: Active'));
  } else {
    console.log(chalk.yellow('  ○') + chalk.gray(' Auto-tracking rules: Not installed'));
  }

  // Learned costs
  const learnedCostsPath = join(getClaudeRulesDir(), 'spendlog-costs.md');
  if (existsSync(learnedCostsPath)) {
    console.log(chalk.green('  ✓') + chalk.gray(' Learning file: Ready'));
  } else {
    console.log(chalk.gray('  ○') + chalk.gray(' Learning file: Not created'));
  }

  // Default project
  const desktopSpendlogConfig = desktopConfig.mcpServers?.['spendlog'];
  const defaultProject = desktopSpendlogConfig?.env?.['SPENDLOG_PROJECT'];
  if (defaultProject) {
    console.log(chalk.green('  ✓') + chalk.gray(` Default project: ${defaultProject}`));
  } else {
    console.log(chalk.gray('  ○') + chalk.gray(' Default project: Not set'));
  }

  // Data
  console.log('');
  console.log(chalk.white(`  ${t('cli.dataSection')}`));
  if (existsSync(dataDir)) {
    const dbPath = join(dataDir, 'spendlog.db');
    if (existsSync(dbPath)) {
      console.log(chalk.green('  ✓') + chalk.gray(` ${t('cli.databaseFound')}`));

      // Show transaction count for current month
      try {
        const db = new Database(dbPath, { readonly: true });
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const monthEnd = new Date(
          now.getFullYear(),
          now.getMonth() + 1,
          0,
          23,
          59,
          59
        ).toISOString();
        const countRow = db
          .prepare('SELECT COUNT(*) as count FROM transactions WHERE date >= ? AND date <= ?')
          .get(monthStart, monthEnd) as { count: number };
        db.close();

        console.log(
          chalk.green('  ✓') + chalk.gray(` Transactions: ${countRow.count}`)
        );
      } catch {
        // DB query failed, skip tx count
      }
    } else {
      console.log(chalk.yellow('  ○') + chalk.gray(` ${t('cli.databaseNotCreated')}`));
    }
  } else {
    console.log(chalk.gray('  ○') + chalk.gray(` ${t('cli.dataDirNotCreated')}`));
  }

  console.log('');
}

function printHelp(): void {
  console.log(chalk.white('  Transactions:'));
  console.log(chalk.cyan('    list') + chalk.gray('         Recent transactions (l)'));
  console.log(chalk.cyan('    add') + chalk.gray('          Add expense/income'));
  console.log(chalk.cyan('    edit') + chalk.gray('         Edit transaction'));
  console.log(chalk.cyan('    delete') + chalk.gray('       Delete transaction (rm)'));
  console.log(chalk.cyan('    search') + chalk.gray('       Search by description (s)'));
  console.log('');
  console.log(chalk.white('  Reports:'));
  console.log(chalk.cyan('    quick') + chalk.gray('        Monthly summary (q)'));
  console.log(chalk.cyan('    breakdown') + chalk.gray('    Category breakdown (bd)'));
  console.log(chalk.cyan('    compare') + chalk.gray('      Compare with previous (cmp)'));
  console.log(chalk.cyan('    stats') + chalk.gray('        All-time statistics'));
  console.log(chalk.cyan('    export') + chalk.gray('       Export to CSV (e)'));
  console.log('');
  console.log(chalk.white('  Management:'));
  console.log(chalk.cyan('    recurring') + chalk.gray('    Recurring transactions (rec)'));
  console.log(chalk.cyan('    cat') + chalk.gray('          Category management'));
  console.log('');
  console.log(chalk.white('  Projects:'));
  console.log(chalk.cyan('    set-project') + chalk.gray('  Set default project'));
  console.log(chalk.cyan('    unset-project') + chalk.gray('Remove default project'));
  console.log('');
  console.log(chalk.white('  Setup:'));
  console.log(chalk.cyan('    (default)') + chalk.gray('    Install Spendlog'));
  console.log(chalk.cyan('    status') + chalk.gray('       Check installation'));
  console.log(chalk.cyan('    uninstall') + chalk.gray('    Remove Spendlog'));
  console.log('');
  console.log(chalk.white('  Time periods:'));
  console.log(chalk.gray('    --last, -l    Last month'));
  console.log(chalk.gray('    --year, -y    Current year'));
  console.log(chalk.gray('    2025-12       Specific month'));
  console.log('');
  console.log(chalk.white('  Examples:'));
  console.log(chalk.gray('    npx spendlog edit abc -a 59.99'));
  console.log(chalk.gray('    npx spendlog recurring add expense 29.99 monthly Spotify'));
  console.log(chalk.gray('    npx spendlog cat add expense Reisen'));
  console.log('');
}

// ============================================================================
// Quick Summary Command
// ============================================================================

function formatEuro(amount: number): string {
  const formatted = Math.abs(amount).toLocaleString(getIntlLocale(), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${amount >= 0 ? '+' : '-'}${formatted} €`;
}

function formatEuroPlain(amount: number): string {
  return (
    amount.toLocaleString(getIntlLocale(), {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + ' €'
  );
}

async function quick(periodArg?: string, allArgs: string[] = []): Promise<void> {
  const dbPath = join(getDataDir(), 'spendlog.db');

  if (!existsSync(dbPath)) {
    noDataYetMessage();
    return;
  }

  // Parse period from arguments
  const dateRange = parsePeriodArg(periodArg, allArgs);
  const startDate = dateRange.start;
  const endDate = dateRange.end;
  const monthLabel = dateRange.label;

  try {
    const db = new Database(dbPath, { readonly: true });

    // Query transactions for current month with category names
    const query = `
      SELECT
        t.type,
        t.amount,
        c.name as category_name
      FROM transactions t
      LEFT JOIN categories c ON t.categoryId = c.id
      WHERE t.date >= ? AND t.date <= ?
    `;

    const transactions = db
      .prepare(query)
      .all(startDate.toISOString(), endDate.toISOString()) as TransactionRow[];

    db.close();

    // Calculate totals
    const income = transactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const expenses = transactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const net = income - expenses;

    const incomeCount = transactions.filter((t) => t.type === 'income').length;
    const expenseCount = transactions.filter((t) => t.type === 'expense').length;

    // Calculate top expense categories
    const expenseByCategory: Record<string, number> = {};
    for (const tx of transactions.filter((tr) => tr.type === 'expense')) {
      const cat = tx.category_name || t('common.noCategory');
      expenseByCategory[cat] = (expenseByCategory[cat] || 0) + Number(tx.amount);
    }

    const topCategories = Object.entries(expenseByCategory)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    // Print summary box
    const title = `Spendlog - ${monthLabel}`;
    const boxWidth = 43;

    console.log(chalk.cyan('  ╔' + '═'.repeat(boxWidth) + '╗'));
    console.log(
      chalk.cyan('  ║') + chalk.white.bold(`  ${title}`.padEnd(boxWidth)) + chalk.cyan('║')
    );
    console.log(chalk.cyan('  ╠' + '═'.repeat(boxWidth) + '╣'));

    // Income line
    const incomeStr = formatEuro(income);
    const incomeLabel = t('cli.incomeLabel').padEnd(12);
    const incomeLine = `  📈 ${incomeLabel}${incomeStr.padStart(14)}  (${incomeCount})`;
    console.log(chalk.cyan('  ║') + chalk.green(incomeLine.padEnd(boxWidth)) + chalk.cyan('║'));

    // Expense line
    const expenseStr = formatEuro(-expenses);
    const expensesLabel = t('cli.expensesLabel').padEnd(12);
    const expenseLine = `  📉 ${expensesLabel}${expenseStr.padStart(14)}  (${expenseCount})`;
    console.log(chalk.cyan('  ║') + chalk.red(expenseLine.padEnd(boxWidth)) + chalk.cyan('║'));

    // Separator
    console.log(chalk.cyan('  ║') + chalk.gray('  ' + '─'.repeat(boxWidth - 2)) + chalk.cyan('║'));

    // Net line
    const netStr = formatEuro(net);
    const netColor = net >= 0 ? chalk.green : chalk.red;
    const netLabelStr = t('cli.netLabel').padEnd(12);
    const netLine = `  💰 ${netLabelStr}${netStr.padStart(14)}`;
    console.log(chalk.cyan('  ║') + netColor(netLine.padEnd(boxWidth)) + chalk.cyan('║'));

    // Transaction count line
    try {
      const countDb = new Database(dbPath, { readonly: true });
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
      const countRow = countDb
        .prepare('SELECT COUNT(*) as count FROM transactions WHERE date >= ? AND date <= ?')
        .get(monthStart, monthEnd) as { count: number };
      countDb.close();

      const txLine = `  📊 Transactions: ${countRow.count}`;
      console.log(chalk.cyan('  ║') + chalk.gray(txLine.padEnd(boxWidth)) + chalk.cyan('║'));
    } catch {
      // Skip tx count on error
    }

    console.log(chalk.cyan('  ╚' + '═'.repeat(boxWidth) + '╝'));

    // Top categories (if any)
    if (topCategories.length > 0) {
      console.log('');
      const topCatStrings = topCategories.map(
        ([name, amount]) => `${name} (${formatEuroPlain(amount)})`
      );
      console.log(chalk.gray(`  ${t('cli.topExpenses')}`) + chalk.white(topCatStrings.join(', ')));
    }

    // Hint for more details
    console.log('');
    console.log(chalk.gray(`  💡 ${t('cli.hintMore')}`));
    console.log(chalk.gray(`     ${t('cli.hintMoreExample')}`));
    console.log('');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.log(chalk.red(`  Error reading database: ${message}`));
    console.log('');
  }
}

// ============================================================================
// Export Command
// ============================================================================

async function exportData(periodArg?: string, allArgs: string[] = []): Promise<void> {
  const dbPath = join(getDataDir(), 'spendlog.db');

  if (!existsSync(dbPath)) {
    noDataYetMessage();
    return;
  }

  // Parse period from arguments
  const dateRange = parsePeriodArg(periodArg, allArgs);

  try {
    const db = new Database(dbPath, { readonly: true });

    // Query transactions for the period
    const query = `
      SELECT
        t.id,
        t.date,
        t.type,
        t.amount,
        t.description,
        c.name as category_name
      FROM transactions t
      LEFT JOIN categories c ON t.categoryId = c.id
      WHERE t.date >= ? AND t.date <= ?
      ORDER BY t.date ASC
    `;

    const transactions = db
      .prepare(query)
      .all(dateRange.start.toISOString(), dateRange.end.toISOString()) as ExportRow[];

    db.close();

    if (transactions.length === 0) {
      console.log(chalk.yellow(`  No transactions for ${dateRange.label}.`));
      console.log('');
      return;
    }

    // Generate CSV content
    const csvHeader = 'Datum,Typ,Betrag,Beschreibung,Kategorie';
    const csvRows = transactions.map((t) => {
      const date = t.date.split('T')[0]; // YYYY-MM-DD
      const type = t.type === 'income' ? 'Einnahme' : 'Ausgabe';
      const amount = Number(t.amount).toFixed(2).replace('.', ',');
      const description = `"${t.description.replace(/"/g, '""')}"`;
      const category = t.category_name || 'Keine Kategorie';
      return `${date},${type},${amount},${description},${category}`;
    });

    const csvContent = [csvHeader, ...csvRows].join('\n');

    // Generate filename
    const exportDir = join(getDataDir(), 'exports');
    if (!existsSync(exportDir)) {
      mkdirSync(exportDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().slice(0, 10);
    const periodSlug = dateRange.label.toLowerCase().replace(/\s+/g, '-');
    const filename = `spendlog-${periodSlug}-${timestamp}.csv`;
    const filepath = join(exportDir, filename);

    writeFileSync(filepath, csvContent, 'utf-8');

    // Calculate totals for summary
    const income = transactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const expenses = transactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    // Print success
    console.log(chalk.green.bold(`  ✓ ${t('cli.exportSuccess')}`));
    console.log('');
    console.log(chalk.white(`  ${t('cli.exportPeriod', { label: dateRange.label })}`));
    console.log(chalk.gray(`  ${t('cli.exportTransactions', { count: transactions.length })}`));
    console.log(chalk.green(`  ${t('cli.exportIncome', { amount: formatEuroPlain(income) })}`));
    console.log(chalk.red(`  ${t('cli.exportExpenses', { amount: formatEuroPlain(expenses) })}`));
    console.log('');
    console.log(chalk.white(`  ${t('cli.exportFile')}`));
    console.log(chalk.cyan(`  ${filepath}`));
    console.log('');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.log(chalk.red(`  Export error: ${message}`));
    console.log('');
  }
}

// ============================================================================
// List Command
// ============================================================================

async function listTransactions(countArg?: string, allArgs: string[] = []): Promise<void> {
  const dbPath = join(getDataDir(), 'spendlog.db');

  if (!existsSync(dbPath)) {
    noDataYetMessage();
    return;
  }

  // Parse limit - check if countArg is a number or a flag
  let limit = 10;
  if (countArg && /^\d+$/.test(countArg)) {
    limit = parseInt(countArg, 10);
  }

  // Parse category filter
  const catIndex = allArgs.findIndex((a) => a === '--category' || a === '-c');
  const categoryFilter = catIndex !== -1 && allArgs[catIndex + 1] ? allArgs[catIndex + 1] : null;

  // Parse type filter
  const onlyExpenses = allArgs.includes('--expenses') || allArgs.includes('-e');
  const onlyIncome = allArgs.includes('--income') || allArgs.includes('-i');

  try {
    const db = new Database(dbPath, { readonly: true });

    let query = `
      SELECT
        t.id,
        t.date,
        t.type,
        t.amount,
        t.description,
        c.name as category_name
      FROM transactions t
      LEFT JOIN categories c ON t.categoryId = c.id
      WHERE 1=1
    `;

    const params: (string | number)[] = [];

    if (categoryFilter) {
      query += ' AND c.name LIKE ?';
      params.push(`%${categoryFilter}%`);
    }

    if (onlyExpenses) {
      query += ' AND t.type = ?';
      params.push('expense');
    } else if (onlyIncome) {
      query += ' AND t.type = ?';
      params.push('income');
    }

    query += ' ORDER BY t.date DESC, t.createdAt DESC LIMIT ?';
    params.push(limit);

    const transactions = db.prepare(query).all(...params) as ExportRow[];
    db.close();

    if (transactions.length === 0) {
      console.log(chalk.yellow('  No transactions found.'));
      console.log('');
      return;
    }

    let title = `Last ${transactions.length} transactions`;
    if (categoryFilter) title += ` in "${categoryFilter}"`;
    if (onlyExpenses) title += ' (expenses only)';
    if (onlyIncome) title += ' (income only)';

    console.log(chalk.white(`  ${title}:`));
    console.log('');

    for (const t of transactions) {
      const date = t.date.split('T')[0];
      const typeIcon = t.type === 'income' ? '📈' : '📉';
      const amountColor = t.type === 'income' ? chalk.green : chalk.red;
      const sign = t.type === 'income' ? '+' : '-';
      const amount = `${sign}${formatEuroPlain(Number(t.amount))}`.padStart(14);
      const desc = t.description.length > 30 ? t.description.slice(0, 27) + '...' : t.description;

      console.log(
        chalk.gray(`  ${date}`) + ` ${typeIcon} ` + amountColor(amount) + chalk.white(` ${desc}`)
      );
    }

    console.log('');
    console.log(chalk.gray(`  💡 Filter: --category IT, --expenses, --income`));
    console.log('');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.log(chalk.red(`  Error: ${message}`));
    console.log('');
  }
}

// ============================================================================
// Breakdown Command
// ============================================================================

async function breakdown(periodArg?: string, allArgs: string[] = []): Promise<void> {
  const dbPath = join(getDataDir(), 'spendlog.db');

  if (!existsSync(dbPath)) {
    noDataYetMessage();
    return;
  }

  const dateRange = parsePeriodArg(periodArg, allArgs);
  const showIncome = allArgs.includes('--income') || allArgs.includes('-i');

  try {
    const db = new Database(dbPath, { readonly: true });

    const type = showIncome ? 'income' : 'expense';
    const query = `
      SELECT
        c.name as category_name,
        SUM(t.amount) as total,
        COUNT(*) as count
      FROM transactions t
      LEFT JOIN categories c ON t.categoryId = c.id
      WHERE t.type = ? AND t.date >= ? AND t.date <= ?
      GROUP BY c.name
      ORDER BY total DESC
    `;

    const categories = db
      .prepare(query)
      .all(type, dateRange.start.toISOString(), dateRange.end.toISOString()) as CategoryTotal[];

    db.close();

    if (categories.length === 0) {
      const typeLabel = showIncome ? t('common.incomePlural') : t('common.expensePlural');
      console.log(chalk.yellow(`  ${typeLabel}: ${t('cli.noDataYet')} (${dateRange.label})`));
      console.log('');
      return;
    }

    const grandTotal = categories.reduce((sum, c) => sum + Number(c.total), 0);
    const typeLabel = showIncome ? t('common.incomePlural') : t('common.expensePlural');
    const icon = showIncome ? '📈' : '📉';

    console.log(chalk.white.bold(`  ${icon} ${typeLabel} - ${dateRange.label}`));
    console.log('');

    // Find max category name length for alignment
    const noCat = t('common.noCategory');
    const maxNameLen = Math.max(...categories.map((c) => (c.category_name || noCat).length));

    for (const cat of categories) {
      const name = (cat.category_name || noCat).padEnd(maxNameLen);
      const amount = formatEuroPlain(Number(cat.total)).padStart(12);
      const percent = ((Number(cat.total) / grandTotal) * 100).toFixed(0).padStart(3);
      const bar = '█'.repeat(Math.round((Number(cat.total) / grandTotal) * 20));

      const color = showIncome ? chalk.green : chalk.red;
      console.log(
        chalk.gray('  ') +
          chalk.white(name) +
          color(` ${amount}`) +
          chalk.gray(` (${percent}%) `) +
          color(bar)
      );
    }

    console.log('');
    console.log(chalk.gray('  ─'.repeat(25)));
    const totalLabel = t('common.total').padEnd(maxNameLen);
    const totalAmount = formatEuroPlain(grandTotal).padStart(12);
    const totalColor = showIncome ? chalk.green : chalk.red;
    console.log(
      chalk.gray('  ') + chalk.white.bold(totalLabel) + totalColor.bold(` ${totalAmount}`)
    );
    console.log('');

    if (!showIncome) {
      console.log(chalk.gray('  💡 Einnahmen: npx spendlog breakdown --income'));
    } else {
      console.log(chalk.gray('  💡 Ausgaben: npx spendlog breakdown'));
    }
    console.log('');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.log(chalk.red(`  Error: ${message}`));
    console.log('');
  }
}

// ============================================================================
// Add Command
// ============================================================================

async function addTransaction(args: string[]): Promise<void> {
  // Parse: add expense 50 Hosting
  // Parse: add income 1200 Beratung
  // Parse: add -e 50 Hosting
  // Parse: add -i 1200 Beratung

  const isExpense = args.includes('-e') || args.includes('expense');
  const isIncome = args.includes('-i') || args.includes('income');

  if (!isExpense && !isIncome) {
    console.log(chalk.yellow('  Bitte Typ angeben: expense oder income'));
    console.log('');
    console.log(chalk.gray('  Beispiele:'));
    console.log(chalk.gray('    npx spendlog add expense 50 Hosting'));
    console.log(chalk.gray('    npx spendlog add income 1200 Beratung'));
    console.log(chalk.gray('    npx spendlog add -e 29.99 GitHub Copilot'));
    console.log('');
    return;
  }

  // Filter out type flags and find amount + description
  const filteredArgs = args.filter(
    (a) => a !== '-e' && a !== '-i' && a !== 'expense' && a !== 'income'
  );

  if (filteredArgs.length < 2) {
    console.log(chalk.yellow('  Bitte Betrag und Beschreibung angeben.'));
    console.log('');
    console.log(chalk.gray('  Beispiel: npx spendlog add expense 50 Hosting-Kosten'));
    console.log('');
    return;
  }

  const amountStr = filteredArgs[0].replace(',', '.');
  const amount = parseFloat(amountStr);

  if (isNaN(amount) || amount <= 0) {
    console.log(chalk.red(`  Ungültiger Betrag: ${filteredArgs[0]}`));
    console.log('');
    return;
  }

  const description = filteredArgs.slice(1).join(' ');

  const dbPath = join(getDataDir(), 'spendlog.db');

  if (!existsSync(dbPath)) {
    const initialized = ensureDatabase();
    if (!initialized) return;
  }

  try {
    const db = new Database(dbPath);

    // Get or create default user
    let userRow = db.prepare('SELECT id FROM users LIMIT 1').get() as { id: string } | undefined;

    if (!userRow) {
      const userId = crypto.randomUUID();
      db.prepare('INSERT INTO users (id) VALUES (?)').run(userId);
      userRow = { id: userId };
    }

    const userId = userRow.id;

    // Get default category
    const type = isIncome ? 'income' : 'expense';
    const defaultCategoryName = isIncome ? 'Sonstiges' : 'IT & Software';

    const categoryRow = db
      .prepare('SELECT id FROM categories WHERE name = ? AND type = ?')
      .get(defaultCategoryName, type) as { id: string } | undefined;

    const categoryId = categoryRow?.id || null;

    // Generate UUID
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(
      `
      INSERT INTO transactions (id, type, amount, description, date, categoryId, createdAt, userId)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `
    ).run(id, type, amount, description, now, categoryId, now, userId);

    db.close();

    const icon = isIncome ? '📈' : '📉';
    const color = isIncome ? chalk.green : chalk.red;
    const typeLabel = isIncome ? 'Einnahme' : 'Ausgabe';

    console.log(chalk.green.bold('  ✓ Transaktion hinzugefügt!'));
    console.log('');
    console.log(`  ${icon} ${typeLabel}: ` + color(formatEuroPlain(amount)));
    console.log(chalk.gray(`     ${description}`));
    console.log('');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.log(chalk.red(`  Error: ${message}`));
    console.log('');
  }
}

// ============================================================================
// Compare Command
// ============================================================================

async function compare(periodArg?: string, allArgs: string[] = []): Promise<void> {
  const dbPath = join(getDataDir(), 'spendlog.db');

  if (!existsSync(dbPath)) {
    noDataYetMessage();
    return;
  }

  // Get current period
  const currentRange = parsePeriodArg(periodArg, allArgs);

  // Calculate previous period
  let previousRange: DateRange;
  const isYearRange = currentRange.start.getMonth() === 0 && currentRange.end.getMonth() === 11;

  if (isYearRange) {
    const year = currentRange.start.getFullYear() - 1;
    previousRange = getYearRange(year);
  } else {
    const prevMonth = currentRange.start.getMonth() === 0 ? 11 : currentRange.start.getMonth() - 1;
    const prevYear =
      currentRange.start.getMonth() === 0
        ? currentRange.start.getFullYear() - 1
        : currentRange.start.getFullYear();
    previousRange = getMonthRange(prevYear, prevMonth);
  }

  try {
    const db = new Database(dbPath, { readonly: true });

    const query = `
      SELECT type, SUM(amount) as total, COUNT(*) as count
      FROM transactions
      WHERE date >= ? AND date <= ?
      GROUP BY type
    `;

    interface PeriodTotals {
      income: number;
      expense: number;
      incomeCount: number;
      expenseCount: number;
    }

    function getTotals(start: Date, end: Date): PeriodTotals {
      const rows = db.prepare(query).all(start.toISOString(), end.toISOString()) as Array<{
        type: string;
        total: number;
        count: number;
      }>;
      const result: PeriodTotals = { income: 0, expense: 0, incomeCount: 0, expenseCount: 0 };
      for (const row of rows) {
        if (row.type === 'income') {
          result.income = Number(row.total);
          result.incomeCount = row.count;
        } else {
          result.expense = Number(row.total);
          result.expenseCount = row.count;
        }
      }
      return result;
    }

    const current = getTotals(currentRange.start, currentRange.end);
    const previous = getTotals(previousRange.start, previousRange.end);

    db.close();

    const currentNet = current.income - current.expense;
    const previousNet = previous.income - previous.expense;

    // Calculate changes
    function calcChange(
      curr: number,
      prev: number
    ): { diff: number; percent: string; arrow: string } {
      const diff = curr - prev;
      if (prev === 0) {
        return { diff, percent: curr > 0 ? '+∞' : '0', arrow: curr > 0 ? '↑' : '→' };
      }
      const pct = ((diff / prev) * 100).toFixed(0);
      const arrow = diff > 0 ? '↑' : diff < 0 ? '↓' : '→';
      return { diff, percent: `${diff >= 0 ? '+' : ''}${pct}%`, arrow };
    }

    const incomeChange = calcChange(current.income, previous.income);
    const expenseChange = calcChange(current.expense, previous.expense);
    const netChange = calcChange(currentNet, previousNet);

    console.log(chalk.white.bold(`  📊 ${currentRange.label} vs ${previousRange.label}`));
    console.log('');

    // Header - use consistent column headers
    const currentHeader = getLocale() === 'de' ? 'Aktuell' : 'Current';
    const previousHeader = getLocale() === 'de' ? 'Vorher' : 'Previous';
    const changeHeader = getLocale() === 'de' ? 'Änderung' : 'Change';
    console.log(
      chalk.gray('                      ') +
        chalk.white(currentHeader.padStart(14)) +
        chalk.gray(`  ${previousHeader}`.padStart(14)) +
        chalk.white(`  ${changeHeader}`.padStart(12))
    );
    console.log(chalk.gray('  ' + '─'.repeat(56)));

    // Income row
    const cmpIncomeLabel = `  📈 ${t('cli.incomeLabel').padEnd(12)}`;
    const incomeColor = incomeChange.diff >= 0 ? chalk.green : chalk.red;
    console.log(
      chalk.white(cmpIncomeLabel) +
        chalk.green(formatEuroPlain(current.income).padStart(14)) +
        chalk.gray(formatEuroPlain(previous.income).padStart(14)) +
        incomeColor(`  ${incomeChange.arrow} ${incomeChange.percent}`.padStart(12))
    );

    // Expense row
    const cmpExpensesLabel = `  📉 ${t('cli.expensesLabel').padEnd(12)}`;
    const expenseColor = expenseChange.diff <= 0 ? chalk.green : chalk.red;
    console.log(
      chalk.white(cmpExpensesLabel) +
        chalk.red(formatEuroPlain(current.expense).padStart(14)) +
        chalk.gray(formatEuroPlain(previous.expense).padStart(14)) +
        expenseColor(`  ${expenseChange.arrow} ${expenseChange.percent}`.padStart(12))
    );

    console.log(chalk.gray('  ' + '─'.repeat(56)));

    // Net row
    const cmpNetLabel = `  💰 ${t('cli.netLabel').padEnd(12)}`;
    const netColor = netChange.diff >= 0 ? chalk.green : chalk.red;
    const currentNetColor = currentNet >= 0 ? chalk.green : chalk.red;
    console.log(
      chalk.white.bold(cmpNetLabel) +
        currentNetColor(formatEuroPlain(currentNet).padStart(14)) +
        chalk.gray(formatEuroPlain(previousNet).padStart(14)) +
        netColor(`  ${netChange.arrow} ${netChange.percent}`.padStart(12))
    );

    console.log('');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.log(chalk.red(`  Error: ${message}`));
    console.log('');
  }
}

// ============================================================================
// Delete Command
// ============================================================================

async function deleteTransaction(idArg?: string): Promise<void> {
  const dbPath = join(getDataDir(), 'spendlog.db');

  if (!existsSync(dbPath)) {
    noDataYetMessage();
    return;
  }

  if (!idArg) {
    console.log(chalk.yellow('  Bitte ID angeben.'));
    console.log('');
    console.log(chalk.gray('  Verwendung: npx spendlog delete <ID>'));
    console.log(chalk.gray('  IDs findest du mit: npx spendlog list --ids'));
    console.log('');
    return;
  }

  try {
    const db = new Database(dbPath);

    // Find the transaction first
    const tx = db
      .prepare(
        `
      SELECT t.id, t.type, t.amount, t.description, t.date
      FROM transactions t
      WHERE t.id LIKE ?
    `
      )
      .get(`${idArg}%`) as
      | { id: string; type: string; amount: number; description: string; date: string }
      | undefined;

    if (!tx) {
      console.log(chalk.red(`  Keine Transaktion gefunden mit ID: ${idArg}`));
      console.log('');
      db.close();
      return;
    }

    // Delete it
    db.prepare('DELETE FROM transactions WHERE id = ?').run(tx.id);
    db.close();

    const icon = tx.type === 'income' ? '📈' : '📉';
    const typeLabel = tx.type === 'income' ? 'Einnahme' : 'Ausgabe';

    console.log(chalk.green.bold('  ✓ Transaktion gelöscht!'));
    console.log('');
    console.log(`  ${icon} ${typeLabel}: ${formatEuroPlain(Number(tx.amount))}`);
    console.log(chalk.gray(`     ${tx.description}`));
    console.log(chalk.gray(`     ID: ${tx.id.slice(0, 8)}...`));
    console.log('');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.log(chalk.red(`  Error: ${message}`));
    console.log('');
  }
}

// ============================================================================
// Search Command
// ============================================================================

async function searchTransactions(searchTerm?: string, _allArgs: string[] = []): Promise<void> {
  const dbPath = join(getDataDir(), 'spendlog.db');

  if (!existsSync(dbPath)) {
    noDataYetMessage();
    return;
  }

  if (!searchTerm) {
    console.log(chalk.yellow('  Bitte Suchbegriff angeben.'));
    console.log('');
    console.log(chalk.gray('  Beispiel: npx spendlog search Hosting'));
    console.log('');
    return;
  }

  const limit = 20;

  try {
    const db = new Database(dbPath, { readonly: true });

    const query = `
      SELECT
        t.id,
        t.date,
        t.type,
        t.amount,
        t.description,
        c.name as category_name
      FROM transactions t
      LEFT JOIN categories c ON t.categoryId = c.id
      WHERE t.description LIKE ?
      ORDER BY t.date DESC
      LIMIT ?
    `;

    const transactions = db.prepare(query).all(`%${searchTerm}%`, limit) as ExportRow[];
    db.close();

    if (transactions.length === 0) {
      console.log(chalk.yellow(`  Keine Treffer für "${searchTerm}".`));
      console.log('');
      return;
    }

    console.log(chalk.white(`  🔍 ${transactions.length} Treffer für "${searchTerm}":`));
    console.log('');

    // Calculate total
    let totalIncome = 0;
    let totalExpense = 0;

    for (const t of transactions) {
      const date = t.date.split('T')[0];
      const typeIcon = t.type === 'income' ? '📈' : '📉';
      const amountColor = t.type === 'income' ? chalk.green : chalk.red;
      const sign = t.type === 'income' ? '+' : '-';
      const amount = `${sign}${formatEuroPlain(Number(t.amount))}`.padStart(14);
      const desc = t.description.length > 30 ? t.description.slice(0, 27) + '...' : t.description;

      if (t.type === 'income') {
        totalIncome += Number(t.amount);
      } else {
        totalExpense += Number(t.amount);
      }

      console.log(
        chalk.gray(`  ${date}`) + ` ${typeIcon} ` + amountColor(amount) + chalk.white(` ${desc}`)
      );
    }

    console.log('');
    console.log(chalk.gray('  ─'.repeat(25)));
    if (totalIncome > 0) {
      console.log(chalk.green(`  Σ Einnahmen: +${formatEuroPlain(totalIncome)}`));
    }
    if (totalExpense > 0) {
      console.log(chalk.red(`  Σ Ausgaben:  -${formatEuroPlain(totalExpense)}`));
    }
    console.log('');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.log(chalk.red(`  Error: ${message}`));
    console.log('');
  }
}

// ============================================================================
// Stats Command
// ============================================================================

async function showStats(): Promise<void> {
  const dbPath = join(getDataDir(), 'spendlog.db');

  if (!existsSync(dbPath)) {
    noDataYetMessage();
    return;
  }

  try {
    const db = new Database(dbPath, { readonly: true });

    // Overall totals
    const totalsQuery = `
      SELECT
        type,
        SUM(amount) as total,
        COUNT(*) as count,
        MIN(date) as first_date,
        MAX(date) as last_date
      FROM transactions
      GROUP BY type
    `;

    interface TotalRow {
      type: string;
      total: number;
      count: number;
      first_date: string;
      last_date: string;
    }

    const totals = db.prepare(totalsQuery).all() as TotalRow[];

    // Transaction count
    const countRow = db.prepare('SELECT COUNT(*) as count FROM transactions').get() as {
      count: number;
    };

    // Date range
    const dateRow = db
      .prepare('SELECT MIN(date) as first, MAX(date) as last FROM transactions')
      .get() as { first: string; last: string };

    // Top categories
    const topCategoriesQuery = `
      SELECT c.name, SUM(t.amount) as total
      FROM transactions t
      LEFT JOIN categories c ON t.categoryId = c.id
      WHERE t.type = 'expense'
      GROUP BY c.name
      ORDER BY total DESC
      LIMIT 5
    `;

    const topCategories = db.prepare(topCategoriesQuery).all() as Array<{
      name: string;
      total: number;
    }>;

    db.close();

    let totalIncome = 0,
      totalExpense = 0,
      incomeCount = 0,
      expenseCount = 0;

    for (const row of totals) {
      if (row.type === 'income') {
        totalIncome = Number(row.total);
        incomeCount = row.count;
      } else {
        totalExpense = Number(row.total);
        expenseCount = row.count;
      }
    }

    const net = totalIncome - totalExpense;
    const firstDate = dateRow.first?.split('T')[0] || '-';
    const lastDate = dateRow.last?.split('T')[0] || '-';

    const statsTitle = getLocale() === 'de' ? 'Gesamtstatistik' : 'Overall Statistics';
    console.log(chalk.white.bold(`  📊 ${statsTitle}`));
    console.log('');

    const rangeLabel = getLocale() === 'de' ? 'Zeitraum' : 'Period';
    console.log(chalk.gray(`  ${rangeLabel}: ${firstDate} – ${lastDate}`));
    console.log(chalk.gray(`  ${t('cli.exportTransactions', { count: countRow.count })}`));
    console.log('');

    const statsIncomeLabel = t('cli.incomeLabel').padEnd(12);
    const statsExpensesLabel = t('cli.expensesLabel').padEnd(12);
    const statsNetLabel = t('cli.netLabel').padEnd(12);

    console.log(chalk.cyan('  ╔' + '═'.repeat(40) + '╗'));
    console.log(
      chalk.cyan('  ║') +
        chalk.green(
          `  📈 ${statsIncomeLabel}${formatEuroPlain(totalIncome).padStart(14)}  (${incomeCount})`.padEnd(
            40
          )
        ) +
        chalk.cyan('║')
    );
    console.log(
      chalk.cyan('  ║') +
        chalk.red(
          `  📉 ${statsExpensesLabel}${formatEuroPlain(totalExpense).padStart(14)}  (${expenseCount})`.padEnd(
            40
          )
        ) +
        chalk.cyan('║')
    );
    console.log(chalk.cyan('  ╠' + '═'.repeat(40) + '╣'));
    const netColor = net >= 0 ? chalk.green : chalk.red;
    console.log(
      chalk.cyan('  ║') +
        netColor(`  💰 ${statsNetLabel}${formatEuroPlain(net).padStart(14)}`.padEnd(40)) +
        chalk.cyan('║')
    );
    console.log(chalk.cyan('  ╚' + '═'.repeat(40) + '╝'));

    if (topCategories.length > 0) {
      console.log('');
      console.log(chalk.white(`  ${t('cli.topExpenses')}`));
      for (const cat of topCategories) {
        const name = (cat.name || t('common.noCategory')).padEnd(20);
        console.log(
          chalk.gray('    ') + chalk.white(name) + chalk.red(formatEuroPlain(Number(cat.total)))
        );
      }
    }

    console.log('');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.log(chalk.red(`  Error: ${message}`));
    console.log('');
  }
}

// ============================================================================
// Edit Command
// ============================================================================

async function editTransaction(args: string[]): Promise<void> {
  const dbPath = join(getDataDir(), 'spendlog.db');

  if (!existsSync(dbPath)) {
    noDataYetMessage();
    return;
  }

  const idArg = args[0];

  if (!idArg) {
    console.log(chalk.yellow('  Bitte ID und Änderungen angeben.'));
    console.log('');
    console.log(chalk.gray('  Verwendung: npx spendlog edit <ID> [Optionen]'));
    console.log(chalk.gray('  Optionen:'));
    console.log(chalk.gray('    --amount, -a X      Neuer Betrag'));
    console.log(chalk.gray('    --desc, -d "Text"   Neue Beschreibung'));
    console.log(chalk.gray('    --date YYYY-MM-DD   Neues Datum'));
    console.log('');
    console.log(chalk.gray('  Beispiel: npx spendlog edit abc123 -a 59.99'));
    console.log('');
    return;
  }

  // Parse options
  const amountIdx = args.findIndex((a) => a === '--amount' || a === '-a');
  const descIdx = args.findIndex((a) => a === '--desc' || a === '-d');
  const dateIdx = args.findIndex((a) => a === '--date');

  const newAmount =
    amountIdx !== -1 && args[amountIdx + 1]
      ? parseFloat(args[amountIdx + 1].replace(',', '.'))
      : null;
  const newDesc = descIdx !== -1 && args[descIdx + 1] ? args[descIdx + 1] : null;
  const newDate = dateIdx !== -1 && args[dateIdx + 1] ? args[dateIdx + 1] : null;

  if (newAmount === null && newDesc === null && newDate === null) {
    console.log(chalk.yellow('  Keine Änderungen angegeben.'));
    console.log(chalk.gray('  Verwende: --amount, --desc, oder --date'));
    console.log('');
    return;
  }

  try {
    const db = new Database(dbPath);

    // Find the transaction
    const tx = db
      .prepare(
        `
      SELECT t.id, t.type, t.amount, t.description, t.date
      FROM transactions t
      WHERE t.id LIKE ?
    `
      )
      .get(`${idArg}%`) as
      | { id: string; type: string; amount: number; description: string; date: string }
      | undefined;

    if (!tx) {
      console.log(chalk.red(`  Keine Transaktion gefunden mit ID: ${idArg}`));
      console.log('');
      db.close();
      return;
    }

    // Build update query
    const updates: string[] = [];
    const params: (string | number)[] = [];

    if (newAmount !== null && !isNaN(newAmount)) {
      updates.push('amount = ?');
      params.push(newAmount);
    }
    if (newDesc !== null) {
      updates.push('description = ?');
      params.push(newDesc);
    }
    if (newDate !== null) {
      updates.push('date = ?');
      params.push(new Date(newDate).toISOString());
    }

    params.push(tx.id);

    db.prepare(`UPDATE transactions SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    db.close();

    console.log(chalk.green.bold('  ✓ Transaktion aktualisiert!'));
    console.log('');
    if (newAmount !== null) console.log(chalk.gray(`     Betrag: ${formatEuroPlain(newAmount)}`));
    if (newDesc !== null) console.log(chalk.gray(`     Beschreibung: ${newDesc}`));
    if (newDate !== null) console.log(chalk.gray(`     Datum: ${newDate}`));
    console.log(chalk.gray(`     ID: ${tx.id.slice(0, 8)}...`));
    console.log('');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.log(chalk.red(`  Error: ${message}`));
    console.log('');
  }
}

// ============================================================================
// Recurring Commands
// ============================================================================

async function handleRecurring(args: string[]): Promise<void> {
  const subcommand = args[0];
  const dbPath = join(getDataDir(), 'spendlog.db');

  if (!existsSync(dbPath)) {
    noDataYetMessage();
    return;
  }

  if (!subcommand || subcommand === 'list' || subcommand === 'ls') {
    await listRecurring(dbPath);
  } else if (subcommand === 'add') {
    await addRecurring(args.slice(1), dbPath);
  } else if (subcommand === 'delete' || subcommand === 'del' || subcommand === 'rm') {
    await deleteRecurring(args[1], dbPath);
  } else if (subcommand === 'process' || subcommand === 'run') {
    await processRecurring(dbPath);
  } else {
    console.log(chalk.yellow('  Recurring Subcommands:'));
    console.log('');
    console.log(chalk.gray('    npx spendlog recurring list       Alle anzeigen'));
    console.log(chalk.gray('    npx spendlog recurring add        Neue erstellen'));
    console.log(chalk.gray('    npx spendlog recurring delete ID  Löschen'));
    console.log(chalk.gray('    npx spendlog recurring process    Fällige verarbeiten'));
    console.log('');
  }
}

async function listRecurring(dbPath: string): Promise<void> {
  try {
    const db = new Database(dbPath, { readonly: true });

    const query = `
      SELECT r.id, r.type, r.amount, r.description, r.interval, r.startDate, r.endDate, r.lastProcessed, r.active
      FROM recurring_transactions r
      WHERE r.active = 1
      ORDER BY r.startDate DESC
    `;

    interface RecurringRow {
      id: string;
      type: string;
      amount: number;
      description: string;
      interval: string;
      startDate: string;
      endDate: string | null;
      lastProcessed: string | null;
      isActive: number;
    }

    const items = db.prepare(query).all() as RecurringRow[];
    db.close();

    if (items.length === 0) {
      console.log(chalk.yellow('  Keine wiederkehrenden Transaktionen.'));
      console.log('');
      console.log(
        chalk.gray('  Erstellen: npx spendlog recurring add expense 29.99 monthly "GitHub Copilot"')
      );
      console.log('');
      return;
    }

    console.log(chalk.white.bold('  🔄 Wiederkehrende Transaktionen:'));
    console.log('');

    const intervalLabels: Record<string, string> = {
      weekly: 'Wöchentlich',
      monthly: 'Monatlich',
      quarterly: 'Quartalsweise',
      yearly: 'Jährlich',
    };

    for (const r of items) {
      const typeIcon = r.type === 'income' ? '📈' : '📉';
      const amountColor = r.type === 'income' ? chalk.green : chalk.red;
      const sign = r.type === 'income' ? '+' : '-';
      const interval = intervalLabels[r.interval] || r.interval;

      console.log(
        `  ${typeIcon} ` +
          amountColor(`${sign}${formatEuroPlain(Number(r.amount))}`.padEnd(14)) +
          chalk.cyan(interval.padEnd(14)) +
          chalk.white(r.description)
      );
      console.log(chalk.gray(`     ID: ${r.id.slice(0, 8)}  Start: ${r.startDate.split('T')[0]}`));
    }

    console.log('');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.log(chalk.red(`  Error: ${message}`));
    console.log('');
  }
}

async function addRecurring(args: string[], dbPath: string): Promise<void> {
  // Format: add expense 29.99 monthly "GitHub Copilot"
  const isExpense = args.includes('expense') || args.includes('-e');
  const isIncome = args.includes('income') || args.includes('-i');

  if (!isExpense && !isIncome) {
    console.log(chalk.yellow('  Bitte Typ angeben: expense oder income'));
    console.log('');
    console.log(
      chalk.gray('  Format: npx spendlog recurring add <type> <amount> <interval> <description>')
    );
    console.log(chalk.gray('  Intervalle: weekly, monthly, quarterly, yearly'));
    console.log('');
    console.log(
      chalk.gray('  Beispiel: npx spendlog recurring add expense 29.99 monthly "GitHub Copilot"')
    );
    console.log('');
    return;
  }

  const filteredArgs = args.filter(
    (a) => a !== '-e' && a !== '-i' && a !== 'expense' && a !== 'income'
  );

  if (filteredArgs.length < 3) {
    console.log(chalk.yellow('  Bitte Betrag, Intervall und Beschreibung angeben.'));
    console.log('');
    return;
  }

  const amountStr = filteredArgs[0].replace(',', '.');
  const amount = parseFloat(amountStr);
  const interval = filteredArgs[1].toLowerCase();
  const description = filteredArgs.slice(2).join(' ').replace(/"/g, '');

  if (isNaN(amount) || amount <= 0) {
    console.log(chalk.red(`  Ungültiger Betrag: ${filteredArgs[0]}`));
    console.log('');
    return;
  }

  const validIntervals = ['weekly', 'monthly', 'quarterly', 'yearly'];
  if (!validIntervals.includes(interval)) {
    console.log(chalk.red(`  Ungültiges Intervall: ${interval}`));
    console.log(chalk.gray(`  Erlaubt: ${validIntervals.join(', ')}`));
    console.log('');
    return;
  }

  try {
    const db = new Database(dbPath);

    // Get user
    let userRow = db.prepare('SELECT id FROM users LIMIT 1').get() as { id: string } | undefined;
    if (!userRow) {
      const userId = crypto.randomUUID();
      db.prepare('INSERT INTO users (id) VALUES (?)').run(userId);
      userRow = { id: userId };
    }

    const type = isIncome ? 'income' : 'expense';
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(
      `
      INSERT INTO recurring_transactions (id, userId, type, amount, description, interval, startDate, active, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
    `
    ).run(id, userRow.id, type, amount, description, interval, now, now);

    db.close();

    const icon = isIncome ? '📈' : '📉';
    const color = isIncome ? chalk.green : chalk.red;

    console.log(chalk.green.bold('  ✓ Wiederkehrende Transaktion erstellt!'));
    console.log('');
    console.log(`  ${icon} ${color(formatEuroPlain(amount))} ${chalk.cyan(interval)}`);
    console.log(chalk.gray(`     ${description}`));
    console.log('');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.log(chalk.red(`  Error: ${message}`));
    console.log('');
  }
}

async function deleteRecurring(idArg: string | undefined, dbPath: string): Promise<void> {
  if (!idArg) {
    console.log(chalk.yellow('  Bitte ID angeben.'));
    console.log('');
    return;
  }

  try {
    const db = new Database(dbPath);

    const item = db
      .prepare('SELECT id, description FROM recurring_transactions WHERE id LIKE ?')
      .get(`${idArg}%`) as { id: string; description: string } | undefined;

    if (!item) {
      console.log(chalk.red(`  Nicht gefunden: ${idArg}`));
      console.log('');
      db.close();
      return;
    }

    db.prepare('DELETE FROM recurring_transactions WHERE id = ?').run(item.id);
    db.close();

    console.log(chalk.green.bold('  ✓ Gelöscht!'));
    console.log(chalk.gray(`     ${item.description}`));
    console.log('');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.log(chalk.red(`  Error: ${message}`));
    console.log('');
  }
}

async function processRecurring(dbPath: string): Promise<void> {
  try {
    const db = new Database(dbPath);

    // Get active recurring items
    const items = db
      .prepare(
        `
      SELECT r.id, r.userId, r.type, r.amount, r.description, r.interval, r.startDate, r.lastProcessed, r.categoryId
      FROM recurring_transactions r
      WHERE r.active = 1
    `
      )
      .all() as Array<{
      id: string;
      userId: string;
      type: string;
      amount: number;
      description: string;
      interval: string;
      startDate: string;
      lastProcessed: string | null;
      categoryId: string | null;
    }>;

    if (items.length === 0) {
      console.log(chalk.yellow('  Keine wiederkehrenden Transaktionen zum Verarbeiten.'));
      console.log('');
      db.close();
      return;
    }

    const now = new Date();
    let created = 0;

    for (const item of items) {
      const lastDate = item.lastProcessed ? new Date(item.lastProcessed) : new Date(item.startDate);
      let nextDue = new Date(lastDate);

      // Calculate next due date based on interval
      switch (item.interval) {
        case 'weekly':
          nextDue.setDate(nextDue.getDate() + 7);
          break;
        case 'monthly':
          nextDue.setMonth(nextDue.getMonth() + 1);
          break;
        case 'quarterly':
          nextDue.setMonth(nextDue.getMonth() + 3);
          break;
        case 'yearly':
          nextDue.setFullYear(nextDue.getFullYear() + 1);
          break;
      }

      // Create transactions for all due dates
      while (nextDue <= now) {
        const txId = crypto.randomUUID();
        db.prepare(
          `
          INSERT INTO transactions (id, userId, type, amount, description, date, categoryId, createdAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `
        ).run(
          txId,
          item.userId,
          item.type,
          item.amount,
          item.description,
          nextDue.toISOString(),
          item.categoryId,
          now.toISOString()
        );

        // Update lastProcessed
        db.prepare('UPDATE recurring_transactions SET lastProcessed = ? WHERE id = ?').run(
          nextDue.toISOString(),
          item.id
        );

        created++;

        // Calculate next
        switch (item.interval) {
          case 'weekly':
            nextDue.setDate(nextDue.getDate() + 7);
            break;
          case 'monthly':
            nextDue.setMonth(nextDue.getMonth() + 1);
            break;
          case 'quarterly':
            nextDue.setMonth(nextDue.getMonth() + 3);
            break;
          case 'yearly':
            nextDue.setFullYear(nextDue.getFullYear() + 1);
            break;
        }
      }
    }

    db.close();

    if (created > 0) {
      console.log(chalk.green.bold(`  ✓ ${created} Transaktion(en) erstellt!`));
    } else {
      console.log(chalk.gray('  Keine fälligen Transaktionen.'));
    }
    console.log('');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.log(chalk.red(`  Error: ${message}`));
    console.log('');
  }
}

// ============================================================================
// Categories Commands
// ============================================================================

async function handleCategories(args: string[]): Promise<void> {
  const subcommand = args[0];
  const dbPath = join(getDataDir(), 'spendlog.db');

  if (!existsSync(dbPath)) {
    const initialized = ensureDatabase();
    if (!initialized) return;
  }

  if (!subcommand || subcommand === 'list' || subcommand === 'ls') {
    await listCategories(dbPath);
  } else if (subcommand === 'add') {
    await addCategory(args.slice(1), dbPath);
  } else if (subcommand === 'delete' || subcommand === 'del' || subcommand === 'rm') {
    await deleteCategory(args[1], dbPath);
  } else {
    console.log(chalk.yellow('  Categories Subcommands:'));
    console.log('');
    console.log(chalk.gray('    npx spendlog cat list          Alle anzeigen'));
    console.log(chalk.gray('    npx spendlog cat add           Neue erstellen'));
    console.log(chalk.gray('    npx spendlog cat delete ID     Löschen'));
    console.log('');
  }
}

async function listCategories(dbPath: string): Promise<void> {
  try {
    const db = new Database(dbPath, { readonly: true });

    const query =
      'SELECT id, name, type, isDefault FROM categories ORDER BY type, isDefault DESC, name';

    interface CategoryRow {
      id: string;
      name: string;
      type: string;
      isDefault: number;
    }

    const categories = db.prepare(query).all() as CategoryRow[];
    db.close();

    const expenses = categories.filter((c) => c.type === 'expense');
    const incomes = categories.filter((c) => c.type === 'income');

    console.log(chalk.white.bold('  📁 Kategorien'));
    console.log('');

    console.log(chalk.red('  Ausgaben:'));
    for (const c of expenses) {
      const badge = c.isDefault ? chalk.gray(' (Standard)') : '';
      const idPart = c.isDefault ? '' : chalk.gray(` [${c.id.slice(0, 6)}]`);
      console.log(chalk.gray('    • ') + chalk.white(c.name) + badge + idPart);
    }

    console.log('');
    console.log(chalk.green('  Einnahmen:'));
    for (const c of incomes) {
      const badge = c.isDefault ? chalk.gray(' (Standard)') : '';
      const idPart = c.isDefault ? '' : chalk.gray(` [${c.id.slice(0, 6)}]`);
      console.log(chalk.gray('    • ') + chalk.white(c.name) + badge + idPart);
    }

    console.log('');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.log(chalk.red(`  Error: ${message}`));
    console.log('');
  }
}

async function addCategory(args: string[], dbPath: string): Promise<void> {
  // Format: add expense "Neue Kategorie" or add -e "Neue Kategorie"
  const isExpense = args.includes('expense') || args.includes('-e');
  const isIncome = args.includes('income') || args.includes('-i');

  if (!isExpense && !isIncome) {
    console.log(chalk.yellow('  Bitte Typ angeben: expense oder income'));
    console.log('');
    console.log(chalk.gray('  Beispiel: npx spendlog cat add expense "Meine Kategorie"'));
    console.log('');
    return;
  }

  const filteredArgs = args.filter(
    (a) => a !== '-e' && a !== '-i' && a !== 'expense' && a !== 'income'
  );

  if (filteredArgs.length === 0) {
    console.log(chalk.yellow('  Bitte Namen angeben.'));
    console.log('');
    return;
  }

  const name = filteredArgs.join(' ').replace(/"/g, '');
  const type = isIncome ? 'income' : 'expense';

  try {
    const db = new Database(dbPath);

    // Check if exists
    const existing = db
      .prepare('SELECT id FROM categories WHERE name = ? AND type = ?')
      .get(name, type);
    if (existing) {
      console.log(chalk.yellow(`  Kategorie "${name}" existiert bereits.`));
      console.log('');
      db.close();
      return;
    }

    const id = crypto.randomUUID();
    db.prepare('INSERT INTO categories (id, name, type, isDefault) VALUES (?, ?, ?, 0)').run(
      id,
      name,
      type
    );
    db.close();

    const icon = isIncome ? '📈' : '📉';
    console.log(chalk.green.bold('  ✓ Kategorie erstellt!'));
    console.log(`  ${icon} ${name}`);
    console.log('');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.log(chalk.red(`  Error: ${message}`));
    console.log('');
  }
}

async function deleteCategory(idArg: string | undefined, dbPath: string): Promise<void> {
  if (!idArg) {
    console.log(chalk.yellow('  Bitte ID angeben.'));
    console.log('');
    return;
  }

  try {
    const db = new Database(dbPath);

    const cat = db
      .prepare('SELECT id, name, isDefault FROM categories WHERE id LIKE ?')
      .get(`${idArg}%`) as { id: string; name: string; isDefault: number } | undefined;

    if (!cat) {
      console.log(chalk.red(`  Nicht gefunden: ${idArg}`));
      console.log('');
      db.close();
      return;
    }

    if (cat.isDefault) {
      console.log(chalk.red('  Standard-Kategorien können nicht gelöscht werden.'));
      console.log('');
      db.close();
      return;
    }

    db.prepare('DELETE FROM categories WHERE id = ?').run(cat.id);
    db.close();

    console.log(chalk.green.bold('  ✓ Kategorie gelöscht!'));
    console.log(chalk.gray(`     ${cat.name}`));
    console.log('');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.log(chalk.red(`  Error: ${message}`));
    console.log('');
  }
}

// ============================================================================
// Set/Unset Project Commands
// ============================================================================

async function setProject(projectName: string): Promise<void> {
  if (!projectName) {
    console.log(chalk.yellow('  Bitte Projektname angeben.'));
    console.log('');
    console.log(chalk.gray('  Verwendung: npx spendlog set-project <NAME>'));
    console.log('');
    return;
  }

  // Ensure project exists in DB (auto-create if needed)
  const dbPath = join(getDataDir(), 'spendlog.db');
  if (existsSync(dbPath)) {
    try {
      const db = new Database(dbPath);
      const userRow = db.prepare('SELECT id FROM users LIMIT 1').get() as
        | { id: string }
        | undefined;
      if (userRow) {
        const existing = db
          .prepare('SELECT id FROM projects WHERE userId = ? AND LOWER(name) = LOWER(?)')
          .get(userRow.id, projectName) as { id: string } | undefined;

        if (!existing) {
          const projectCount = db
            .prepare('SELECT COUNT(*) as count FROM projects WHERE userId = ?')
            .get(userRow.id) as { count: number };

          if (projectCount.count < 3) {
            const id = crypto.randomUUID();
            const now = new Date().toISOString();
            db.prepare(
              'INSERT INTO projects (id, userId, name, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)'
            ).run(id, userRow.id, projectName, 'active', now, now);
            console.log(chalk.green('  ✓') + chalk.gray(` Projekt "${projectName}" erstellt`));
          }
        }
      }
      db.close();
    } catch {
      // DB not ready yet — that's fine, project will be auto-created at runtime
    }
  }

  // Configure for Claude Code (project-scoped override)
  if (isClaudeCodeInstalled()) {
    try {
      execSync(
        `claude mcp add spendlog --scope project --env SPENDLOG_PROJECT=${projectName} -- npx -y --package=${PACKAGE_NAME} ${MCP_SERVER_BIN}`,
        { stdio: 'pipe' }
      );
      console.log(chalk.green('  ✓') + chalk.gray(' Claude Code: Projekt-Scope gesetzt'));
    } catch {
      console.log(chalk.yellow('  ⚠') + chalk.gray(' Claude Code: Konnte Scope nicht setzen'));
    }
  }

  // Configure for Claude Desktop (add env to config)
  let claudeDesktopSet = false;
  const configPath = getClaudeDesktopConfigPath();
  const config = readClaudeConfig(configPath);
  if (config.mcpServers?.['spendlog']) {
    if (!config.mcpServers['spendlog'].env) {
      config.mcpServers['spendlog'].env = {};
    }
    config.mcpServers['spendlog'].env['SPENDLOG_PROJECT'] = projectName;
    writeClaudeConfig(configPath, config);
    claudeDesktopSet = true;
    console.log(chalk.green('  ✓') + chalk.gray(' Claude Desktop: SPENDLOG_PROJECT gesetzt'));
  }

  console.log('');
  console.log(chalk.green.bold(`  ✓ Standard-Projekt: "${projectName}"`));
  console.log('');
  console.log(
    chalk.gray('  Alle neuen Transaktionen werden automatisch diesem Projekt zugeordnet.')
  );
  console.log(chalk.gray('  Du kannst pro Transaktion trotzdem ein anderes Projekt angeben.'));
  console.log('');

  if (claudeDesktopSet) {
    console.log(chalk.yellow.bold('  ⚠ BITTE STARTE Claude Desktop NEU'));
    console.log(chalk.yellow('    Erst nach dem Neustart wird das Projekt aktiv.'));
    console.log('');
  }
}

async function unsetProject(): Promise<void> {
  // Remove from Claude Code (remove project-scope override)
  if (isClaudeCodeInstalled()) {
    try {
      execSync('claude mcp remove spendlog --scope project 2>/dev/null || true', { stdio: 'pipe' });
      console.log(chalk.green('  ✓') + chalk.gray(' Claude Code: Projekt-Scope entfernt'));
    } catch {
      // Ignore
    }
  }

  // Remove from Claude Desktop config
  let claudeDesktopUnset = false;
  const configPath = getClaudeDesktopConfigPath();
  const config = readClaudeConfig(configPath);
  if (config.mcpServers?.['spendlog']?.env?.['SPENDLOG_PROJECT']) {
    delete config.mcpServers['spendlog'].env['SPENDLOG_PROJECT'];
    // Clean up empty env object
    if (Object.keys(config.mcpServers['spendlog'].env).length === 0) {
      delete config.mcpServers['spendlog'].env;
    }
    writeClaudeConfig(configPath, config);
    claudeDesktopUnset = true;
    console.log(chalk.green('  ✓') + chalk.gray(' Claude Desktop: SPENDLOG_PROJECT entfernt'));
  }

  console.log('');
  console.log(chalk.green.bold('  ✓ Standard-Projekt entfernt'));
  console.log('');
  console.log(chalk.gray('  Transaktionen werden keinem Projekt mehr automatisch zugeordnet.'));
  console.log('');

  if (claudeDesktopUnset) {
    console.log(chalk.yellow.bold('  ⚠ BITTE STARTE Claude Desktop NEU'));
    console.log(chalk.yellow('    Erst nach dem Neustart wird die Änderung aktiv.'));
    console.log('');
  }
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  initI18n();

  const args = process.argv.slice(2);
  const command = args[0];

  printBanner();

  // Default: install
  if (!command || command === 'init' || command === 'install') {
    await install(args.slice(1));
  } else if (command === 'set-project') {
    await setProject(args[1]);
  } else if (command === 'unset-project') {
    await unsetProject();
  } else if (command === 'uninstall' || command === 'remove') {
    await uninstall();
  } else if (command === 'status') {
    await status();
  } else if (command === 'quick' || command === 'q') {
    await quick(args[1], args);
  } else if (command === 'export' || command === 'e') {
    await exportData(args[1], args);
  } else if (command === 'list' || command === 'ls' || command === 'l') {
    await listTransactions(args[1], args);
  } else if (command === 'breakdown' || command === 'bd') {
    await breakdown(args[1], args);
  } else if (command === 'add') {
    await addTransaction(args.slice(1));
  } else if (command === 'compare' || command === 'cmp') {
    await compare(args[1], args);
  } else if (command === 'delete' || command === 'del' || command === 'rm') {
    await deleteTransaction(args[1]);
  } else if (command === 'search' || command === 's') {
    await searchTransactions(args[1], args);
  } else if (command === 'stats') {
    await showStats();
  } else if (command === 'edit') {
    await editTransaction(args.slice(1));
  } else if (command === 'recurring' || command === 'rec') {
    await handleRecurring(args.slice(1));
  } else if (command === 'cat') {
    await handleCategories(args.slice(1));
  } else if (command === 'help' || command === '--help' || command === '-h') {
    printHelp();
  } else if (command === '--version' || command === '-v') {
    console.log(chalk.gray(`  Version: ${VERSION}`));
    console.log('');
  } else {
    console.log(chalk.yellow(`  Unknown command: ${command}`));
    console.log('');
    printHelp();
  }
}

main().catch((error) => {
  console.error(chalk.red('  Error:'), error.message);
  process.exit(1);
});
