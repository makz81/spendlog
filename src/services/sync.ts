import { AppDataSource, initializeDatabase } from '../db/data-source.js';
import { SyncQueue, SyncAction, SyncEntityType, SyncStatus } from '../entities/SyncQueue.js';
import { Transaction } from '../entities/Transaction.js';
import { Category } from '../entities/Category.js';
import { getConnectionState, saveConnectionState, isConnected, getApiUrl } from './connection.js';

const MAX_RETRIES = 3;
const BATCH_SIZE = 50;

// ============================================================================
// Queue Management
// ============================================================================

export async function queueForSync(
  entityType: SyncEntityType,
  entityId: string,
  action: SyncAction
): Promise<void> {
  if (!isConnected()) {
    return; // Don't queue if not connected
  }

  await initializeDatabase();
  const repo = AppDataSource.getRepository(SyncQueue);

  // Check if already queued (pending)
  const existing = await repo.findOne({
    where: {
      entityType,
      entityId,
      status: 'pending' as SyncStatus,
    },
  });

  if (existing) {
    // Update action if already queued
    existing.action = action;
    await repo.save(existing);
    return;
  }

  // Create new queue entry
  const entry = repo.create({
    entityType,
    entityId,
    action,
    status: 'pending',
    retries: 0,
  });

  await repo.save(entry);

  // Try to sync immediately (fire and forget)
  processQueue().catch(() => {
    // Ignore errors, will retry later
  });
}

export async function getPendingCount(): Promise<number> {
  await initializeDatabase();
  const repo = AppDataSource.getRepository(SyncQueue);
  return repo.count({ where: { status: 'pending' as SyncStatus } });
}

export async function getQueueStats(): Promise<{
  pending: number;
  synced: number;
  error: number;
}> {
  await initializeDatabase();
  const repo = AppDataSource.getRepository(SyncQueue);

  const [pending, synced, error] = await Promise.all([
    repo.count({ where: { status: 'pending' as SyncStatus } }),
    repo.count({ where: { status: 'synced' as SyncStatus } }),
    repo.count({ where: { status: 'error' as SyncStatus } }),
  ]);

  return { pending, synced, error };
}

// ============================================================================
// Sync Processing (via API)
// ============================================================================

interface SyncTransactionPayload {
  local_id: string;
  type: 'income' | 'expense';
  amount: number;
  description: string;
  category?: string;
  date: string;
  action: 'create' | 'update' | 'delete';
}

interface SyncApiResponse {
  success: boolean;
  created: number;
  updated: number;
  deleted: number;
  errors: string[];
}

export async function processQueue(): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
}> {
  if (!isConnected()) {
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  const state = getConnectionState();
  if (!state.token || !state.userId) {
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  await initializeDatabase();
  const repo = AppDataSource.getRepository(SyncQueue);

  // Get pending transaction items only (categories handled locally)
  const pending = await repo.find({
    where: {
      status: 'pending' as SyncStatus,
      entityType: 'transaction' as SyncEntityType,
    },
    order: { createdAt: 'ASC' },
    take: BATCH_SIZE,
  });

  if (pending.length === 0) {
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  // Mark all as syncing
  for (const item of pending) {
    item.status = 'syncing';
    await repo.save(item);
  }

  // Build batch payload
  const txRepo = AppDataSource.getRepository(Transaction);
  const catRepo = AppDataSource.getRepository(Category);
  const transactions: SyncTransactionPayload[] = [];

  for (const item of pending) {
    if (item.action === 'delete') {
      transactions.push({
        local_id: item.entityId,
        type: 'expense', // doesn't matter for delete
        amount: 0,
        description: '',
        date: new Date().toISOString().split('T')[0],
        action: 'delete',
      });
    } else {
      const tx = await txRepo.findOne({ where: { id: item.entityId } });
      if (!tx) {
        // Transaction deleted locally, mark as synced
        item.status = 'synced';
        item.syncedAt = new Date();
        await repo.save(item);
        continue;
      }

      // Get category name
      let categoryName: string | undefined;
      if (tx.categoryId) {
        const cat = await catRepo.findOne({ where: { id: tx.categoryId } });
        categoryName = cat?.name;
      }

      // Convert Date to ISO string for API
      const dateStr =
        tx.date instanceof Date ? tx.date.toISOString().split('T')[0] : String(tx.date);

      transactions.push({
        local_id: tx.id,
        type: tx.type as 'income' | 'expense',
        amount: tx.amount,
        description: tx.description,
        category: categoryName,
        date: dateStr,
        action: item.action as 'create' | 'update',
      });
    }
  }

  if (transactions.length === 0) {
    return { processed: pending.length, succeeded: pending.length, failed: 0 };
  }

  // Send to API
  try {
    const apiUrl = getApiUrl();
    const response = await fetch(`${apiUrl}/sync/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${state.token}`,
      },
      body: JSON.stringify({ transactions }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const result = (await response.json()) as SyncApiResponse;

    // Mark items as synced or error based on API response
    const succeeded = result.created + result.updated + result.deleted;
    const failed = result.errors.length;

    // Update queue items
    for (const item of pending) {
      const hasError = result.errors.some((e) => e.includes(item.entityId));
      if (hasError) {
        item.retries++;
        if (item.retries >= MAX_RETRIES) {
          item.status = 'error';
          item.lastError = result.errors.find((e) => e.includes(item.entityId)) || 'Unknown error';
        } else {
          item.status = 'pending';
        }
      } else {
        item.status = 'synced';
        item.syncedAt = new Date();
      }
      await repo.save(item);
    }

    // Update lastSync in connection state
    state.lastSync = new Date().toISOString();
    saveConnectionState(state);

    return { processed: pending.length, succeeded, failed };
  } catch (error) {
    // Network or API error - mark all as pending for retry
    for (const item of pending) {
      item.retries++;
      item.lastError = error instanceof Error ? error.message : 'Unknown error';
      if (item.retries >= MAX_RETRIES) {
        item.status = 'error';
      } else {
        item.status = 'pending';
      }
      await repo.save(item);
    }

    return { processed: pending.length, succeeded: 0, failed: pending.length };
  }
}

// ============================================================================
// Full Sync (initial or manual)
// ============================================================================

export async function fullSync(): Promise<{
  transactions: number;
  categories: number;
  errors: string[];
}> {
  if (!isConnected()) {
    return { transactions: 0, categories: 0, errors: ['Not connected'] };
  }

  const state = getConnectionState();
  if (!state.userId) {
    return { transactions: 0, categories: 0, errors: ['No user ID'] };
  }

  await initializeDatabase();
  const errors: string[] = [];
  let transactionCount = 0;

  // Queue all transactions for sync (categories stay local only)
  const txRepo = AppDataSource.getRepository(Transaction);
  const transactions = await txRepo.find();

  for (const tx of transactions) {
    await queueForSync('transaction', tx.id, 'create');
    transactionCount++;
  }

  // Process the queue
  const result = await processQueue();

  if (result.failed > 0) {
    errors.push(`${result.failed} items failed to sync`);
  }

  // Update connection state
  state.lastSync = new Date().toISOString();
  saveConnectionState(state);

  return { transactions: transactionCount, categories: 0, errors };
}

// ============================================================================
// Sync Status
// ============================================================================

export async function getSyncStatus(): Promise<{
  connected: boolean;
  lastSync: string | null;
  pendingItems: number;
  queueStats: { pending: number; synced: number; error: number };
}> {
  const state = getConnectionState();
  const stats = await getQueueStats();

  return {
    connected: state.connected,
    lastSync: state.lastSync || null,
    pendingItems: stats.pending,
    queueStats: stats,
  };
}
