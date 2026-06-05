import { DataSource } from 'typeorm';
import { User } from '../entities/User.js';
import { Profile } from '../entities/Profile.js';
import { Category } from '../entities/Category.js';
import { Transaction } from '../entities/Transaction.js';
import { Invoice } from '../entities/Invoice.js';
import { Recurring } from '../entities/Recurring.js';
import { Project } from '../entities/Project.js';
import { Budget } from '../entities/Budget.js';
import { InitialSchema1780617600000 } from './migrations/1780617600000-InitialSchema.js';
import path from 'path';
import { homedir } from 'os';
import fs from 'fs';

// Default to ~/.spendlog for user data (consistent with CLI)
const dataDir = process.env.SPENDLOG_DATA_DIR || path.join(homedir(), '.spendlog');

// Ensure data directory exists (skip in test environment)
if (!process.env.VITEST && !fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.chmodSync(dataDir, 0o700);
}

const databasePath = process.env.DATABASE_PATH || path.join(dataDir, 'spendlog.db');

let activeDataSource: DataSource | null = null;

const ProductionDataSource = new DataSource({
  type: 'better-sqlite3',
  database: databasePath,
  entities: [User, Profile, Category, Transaction, Invoice, Recurring, Project, Budget],
  migrations: [InitialSchema1780617600000],
  synchronize: false,
  logging: process.env.SPENDLOG_DEBUG === '1',
  enableWAL: true,
});

export const AppDataSource = new Proxy({} as DataSource, {
  get(_target, prop: keyof DataSource) {
    const source = activeDataSource || ProductionDataSource;
    const value = source[prop];
    if (typeof value === 'function') {
      return value.bind(source);
    }
    return value;
  },
});

export function setDataSource(dataSource: DataSource): void {
  activeDataSource = dataSource;
}

export function resetDataSource(): void {
  activeDataSource = null;
}

let initialized = false;

export async function initializeDatabase(): Promise<DataSource> {
  if (initialized && (activeDataSource || ProductionDataSource).isInitialized) {
    return AppDataSource;
  }

  const source = activeDataSource || ProductionDataSource;
  if (!source.isInitialized) {
    await source.initialize();
    // Enable FK constraints (off by default in SQLite)
    await source.query('PRAGMA foreign_keys = ON');

    // Tests inject an in-memory source that uses synchronize; the real file-based
    // source runs migrations instead, with a one-shot backup before any schema change.
    if (source === ProductionDataSource) {
      const pending = await source.showMigrations();
      if (pending && (await hasExistingSchema(source))) {
        backupDatabase();
      }
      await source.runMigrations({ transaction: 'all' });
    }
  }

  initialized = true;
  return AppDataSource;
}

async function hasExistingSchema(source: DataSource): Promise<boolean> {
  const rows = await source.query(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'transactions'"
  );
  return rows.length > 0;
}

function backupDatabase(): void {
  if (databasePath === ':memory:' || !fs.existsSync(databasePath)) return;

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `${databasePath}.bak-${stamp}`;
  fs.copyFileSync(databasePath, backupPath);
  if (process.env.SPENDLOG_DEBUG === '1') {
    console.error(`[db] backed up to ${backupPath} before migrating`);
  }
}

export async function closeDatabase(): Promise<void> {
  const source = activeDataSource || ProductionDataSource;
  if (source.isInitialized) {
    await source.destroy();
    initialized = false;
  }
}
