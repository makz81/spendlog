import { DataSource } from 'typeorm';
import { User } from '../entities/User.js';
import { Profile } from '../entities/Profile.js';
import { Category } from '../entities/Category.js';
import { Transaction } from '../entities/Transaction.js';
import { Invoice } from '../entities/Invoice.js';
import { Recurring } from '../entities/Recurring.js';
import { Project } from '../entities/Project.js';
import { SyncQueue } from '../entities/SyncQueue.js';
import { Budget } from '../entities/Budget.js';
import path from 'path';
import { homedir } from 'os';
import fs from 'fs';

// Default to ~/.spendlog for user data (consistent with CLI)
const dataDir = process.env.SPENDLOG_DATA_DIR || path.join(homedir(), '.spendlog');

// Ensure data directory exists (skip in test environment)
if (!process.env.VITEST && !fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const databasePath = process.env.DATABASE_PATH || path.join(dataDir, 'spendlog.db');

// The active data source - can be swapped for testing
let activeDataSource: DataSource | null = null;

// Production data source
const ProductionDataSource = new DataSource({
  type: 'better-sqlite3',
  database: databasePath,
  entities: [User, Profile, Category, Transaction, Invoice, Recurring, Project, SyncQueue, Budget],
  synchronize: true, // Auto-create tables in development
  logging: process.env.DEBUG ? true : false,
});

/**
 * Get the active data source.
 * In production, this returns the production data source.
 * In tests, this can return a test data source if one has been set.
 */
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

/**
 * Set a custom data source (for testing)
 */
export function setDataSource(dataSource: DataSource): void {
  activeDataSource = dataSource;
}

/**
 * Reset to the production data source
 */
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
  }

  initialized = true;
  return AppDataSource;
}

export async function closeDatabase(): Promise<void> {
  const source = activeDataSource || ProductionDataSource;
  if (source.isInitialized) {
    await source.destroy();
    initialized = false;
  }
}
