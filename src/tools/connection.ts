import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import {
  getConnectionState,
  isConnected,
  generateLinkToken,
  getConnectUrl,
  clearConnectionState,
  saveConnectionState,
  getDeeplink,
  WEB_URL,
  API_URL,
} from '../services/connection.js';
import { getSyncStatus, fullSync, processQueue } from '../services/sync.js';
import { t } from '../i18n/index.js';

export function getConnectionToolDefinitions(): Tool[] {
  return [
    {
      name: 'connect',
      annotations: { openWorldHint: true },
      description: t('connection.connectDesc'),
      inputSchema: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
    {
      name: 'connection_status',
      annotations: { readOnlyHint: true },
      description: t('connection.statusDesc'),
      inputSchema: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
    {
      name: 'disconnect',
      annotations: { destructiveHint: true },
      description: t('connection.disconnectDesc'),
      inputSchema: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
    {
      name: 'sync_status',
      annotations: { readOnlyHint: true },
      description: t('connection.syncStatusDesc'),
      inputSchema: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
    {
      name: 'sync_now',
      annotations: { openWorldHint: true },
      description: t('connection.syncNowDesc'),
      inputSchema: {
        type: 'object',
        properties: {
          full: {
            type: 'boolean',
            description: t('connection.syncFullDesc'),
          },
        },
        required: [],
      },
    },
  ];
}

export async function connect(): Promise<unknown> {
  // Check if already connected
  if (isConnected()) {
    const state = getConnectionState();
    return {
      success: false,
      message: t('connection.alreadyConnected'),
      status: 'already_connected',
      dashboard_url: getDeeplink('dashboard'),
      connected_at: state.connectedAt,
    };
  }

  // Generate link token
  const linkToken = generateLinkToken();

  // Register token with API (so web can validate it)
  try {
    const response = await fetch(`${API_URL}/auth/link`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token: linkToken.token,
        device_id: linkToken.deviceId,
      }),
    });

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as { error?: string };
      return {
        success: false,
        message: t('connection.linkError'),
        error: errorData.error || `API returned ${response.status}`,
      };
    }

    const apiResult = (await response.json()) as { connect_url?: string };
    const connectUrl = apiResult.connect_url || getConnectUrl(linkToken.token);

    // Store pending token locally
    const pendingState = {
      connected: false,
      pendingToken: linkToken.token,
      pendingExpires: linkToken.expiresAt.toISOString(),
      deviceId: linkToken.deviceId,
      webUrl: WEB_URL,
    };

    saveConnectionState(pendingState);

    return {
      success: true,
      message: t('connection.linkCreated'),
      connect_url: connectUrl,
      expires_in_minutes: 10,
      instructions: [
        t('connection.instruction1'),
        t('connection.instruction2'),
        t('connection.instruction3'),
      ],
      hint: t('connection.linkHint'),
    };
  } catch (err) {
    return {
      success: false,
      message: t('connection.apiError'),
      error: err instanceof Error ? err.message : 'Network error',
      hint: t('connection.apiErrorHint'),
    };
  }
}

export async function connectionStatus(): Promise<unknown> {
  const state = getConnectionState();

  if (state.connected) {
    return {
      connected: true,
      message: t('connection.connected'),
      user_id: state.userId,
      device_id: state.deviceId,
      connected_at: state.connectedAt,
      last_sync: state.lastSync,
      dashboard_url: getDeeplink('dashboard'),
      features: [
        t('connection.featureRealtime'),
        t('connection.featureDashboard'),
        t('connection.featureExport'),
        t('connection.featureCharts'),
      ],
    };
  }

  // Check for pending connection
  if (state.pendingToken) {
    // Poll API to check if connection was completed
    const pollResult = await pollConnectionStatus(state.pendingToken!, state.deviceId || '');

    if (pollResult.connected) {
      // Connection was completed on web! Update local state
      saveConnectionState({
        connected: true,
        userId: pollResult.userId,
        deviceId: state.deviceId || '',
        token: pollResult.sessionToken,
        webUrl: WEB_URL,
        connectedAt: new Date().toISOString(),
        lastSync: new Date().toISOString(),
      });

      // Trigger initial sync in background
      fullSync().catch(() => { /* fire-and-forget */ });

      return {
        connected: true,
        message: t('connection.connectionSuccess'),
        user_id: pollResult.userId,
        device_id: state.deviceId,
        dashboard_url: getDeeplink('dashboard'),
        hint: t('connection.syncHint'),
      };
    }

    const expires = new Date(state.pendingExpires!);
    const isExpired = expires < new Date();

    if (isExpired) {
      return {
        connected: false,
        message: t('connection.linkExpired'),
        hint: t('connection.linkExpiredHint'),
      };
    }

    return {
      connected: false,
      message: t('connection.pendingLink'),
      expires_at: state.pendingExpires,
      hint: t('connection.pendingLinkHint'),
    };
  }

  return {
    connected: false,
    message: t('connection.notConnected'),
    local_only: true,
    hint: t('connection.notConnectedHint'),
    features_available_after_connect: [
      t('connection.featureDashboard'),
      t('connection.featurePdfCsv'),
      t('connection.featureMultiDevice'),
      t('connection.featureBackup'),
    ],
  };
}

// Poll API to check if link token was used/connection completed
async function pollConnectionStatus(
  token: string,
  _deviceId: string
): Promise<{ connected: boolean; userId?: string; sessionToken?: string }> {
  try {
    const response = await fetch(`${API_URL}/auth/link/status/${token}`);

    if (!response.ok) {
      return { connected: false };
    }

    const data = (await response.json()) as {
      status: string;
      user_id?: string;
      session_token?: string;
    };

    if (data.status === 'connected' && data.user_id) {
      return {
        connected: true,
        userId: data.user_id,
        sessionToken: data.session_token,
      };
    }

    return { connected: false };
  } catch {
    // Network error or API unreachable - assume not connected
    return { connected: false };
  }
}

export async function disconnect(): Promise<unknown> {
  if (!isConnected()) {
    return {
      success: false,
      message: t('connection.notConnectedShort'),
    };
  }

  const state = getConnectionState();
  clearConnectionState();

  return {
    success: true,
    message: t('connection.disconnected'),
    note: t('connection.disconnectedNote'),
    previous_user_id: state.userId,
    hint: t('connection.disconnectedHint'),
  };
}

export async function validateConnection(
  userId: string,
  token: string,
  deviceId: string
): Promise<boolean> {
  const state = getConnectionState();

  // Verify pending token matches
  if (state.pendingToken !== token) {
    return false;
  }

  // Check expiry
  if (state.pendingExpires && new Date(state.pendingExpires) < new Date()) {
    return false;
  }

  // Complete connection
  saveConnectionState({
    connected: true,
    userId,
    deviceId,
    token,
    webUrl: WEB_URL,
    connectedAt: new Date().toISOString(),
    lastSync: new Date().toISOString(),
  });

  // Trigger initial full sync (fire and forget)
  fullSync().catch(() => { /* fire-and-forget */ });

  return true;
}

export async function syncStatus(): Promise<unknown> {
  const status = await getSyncStatus();

  if (!status.connected) {
    return {
      connected: false,
      message: t('connection.syncNotConnected'),
      hint: t('connection.syncNotConnectedHint'),
    };
  }

  const { queueStats } = status;

  if (queueStats.pending === 0 && queueStats.error === 0) {
    return {
      connected: true,
      message: t('connection.allSynced'),
      last_sync: status.lastSync,
      stats: {
        synced_total: queueStats.synced,
        pending: 0,
        errors: 0,
      },
    };
  }

  return {
    connected: true,
    message:
      queueStats.pending > 0
        ? t('connection.pendingEntries', { count: String(queueStats.pending) })
        : t('connection.syncErrors'),
    last_sync: status.lastSync,
    stats: {
      pending: queueStats.pending,
      synced: queueStats.synced,
      errors: queueStats.error,
    },
    hint: queueStats.error > 0 ? t('connection.syncErrorHint') : undefined,
  };
}

export async function syncNow(args: Record<string, unknown>): Promise<unknown> {
  if (!isConnected()) {
    return {
      success: false,
      message: t('connection.syncNotConnectedShort'),
      hint: t('connection.syncNotConnectedShortHint'),
    };
  }

  const doFullSync = args.full === true;

  if (doFullSync) {
    const result = await fullSync();

    if (result.errors.length > 0) {
      return {
        success: false,
        message: t('connection.fullSyncErrors'),
        synced: {
          transactions: result.transactions,
          categories: result.categories,
        },
        errors: result.errors,
      };
    }

    return {
      success: true,
      message: t('connection.fullSyncDone'),
      synced: {
        transactions: result.transactions,
        categories: result.categories,
      },
    };
  }

  // Just process pending queue
  const result = await processQueue();

  if (result.processed === 0) {
    return {
      success: true,
      message: t('connection.nothingToSync'),
    };
  }

  return {
    success: result.failed === 0,
    message:
      result.failed === 0
        ? t('connection.syncedEntries', { count: String(result.succeeded) })
        : t('connection.syncedWithErrors', {
            succeeded: String(result.succeeded),
            failed: String(result.failed),
          }),
    stats: {
      processed: result.processed,
      succeeded: result.succeeded,
      failed: result.failed,
    },
  };
}
