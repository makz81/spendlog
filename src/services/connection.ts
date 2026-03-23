import { existsSync, readFileSync, writeFileSync, unlinkSync, chmodSync, mkdirSync } from 'fs';
import { homedir, hostname, userInfo } from 'os';
import { join } from 'path';
import { randomBytes } from 'crypto';
import { t } from '../i18n/index.js';

export interface ConnectionState {
  connected: boolean;
  userId?: string;
  deviceId?: string;
  token?: string;
  webUrl: string;
  connectedAt?: string;
  lastSync?: string;
  pendingToken?: string;
  pendingExpires?: string;
}

export interface LinkToken {
  token: string;
  expiresAt: Date;
  deviceId: string;
}

const WEB_URL = process.env.SPENDLOG_WEB_URL || 'https://spendlog.dev';
const API_URL = process.env.SPENDLOG_API_URL || 'https://api.spendlog.dev';
const CONNECTION_FILE = 'connection.json';
const TOKEN_EXPIRY_MINUTES = 10;

function getDataDir(): string {
  const dir = join(homedir(), '.spendlog');
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    chmodSync(dir, 0o700);
  }
  return dir;
}

function getConnectionPath(): string {
  return join(getDataDir(), CONNECTION_FILE);
}

function getDeviceId(): string {
  const host = hostname();
  const username = userInfo().username;
  return `${host}-${username}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
}

export function getConnectionState(): ConnectionState {
  const path = getConnectionPath();

  if (!existsSync(path)) {
    return {
      connected: false,
      webUrl: WEB_URL,
    };
  }

  try {
    const content = readFileSync(path, 'utf-8');
    const state = JSON.parse(content) as ConnectionState;
    return {
      ...state,
      webUrl: WEB_URL,
    };
  } catch {
    return {
      connected: false,
      webUrl: WEB_URL,
    };
  }
}

export function isConnected(): boolean {
  return getConnectionState().connected;
}

export function saveConnectionState(state: ConnectionState): void {
  const path = getConnectionPath();
  writeFileSync(path, JSON.stringify(state, null, 2));
  chmodSync(path, 0o600);
}

export function clearConnectionState(): boolean {
  const path = getConnectionPath();
  if (existsSync(path)) {
    unlinkSync(path);
    return true;
  }
  return false;
}

export function generateLinkToken(): LinkToken {
  const token = `splog_${randomBytes(24).toString('hex')}`;
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MINUTES * 60 * 1000);
  const deviceId = getDeviceId();

  return {
    token,
    expiresAt,
    deviceId,
  };
}

export function getConnectUrl(token: string): string {
  return `${WEB_URL}/connect?token=${token}`;
}

export function getDeeplink(
  type: 'dashboard' | 'transaction' | 'invoices' | 'settings' | 'analytics',
  id?: string
): string | null {
  if (!isConnected()) {
    return null;
  }

  const baseUrl = WEB_URL;

  switch (type) {
    case 'dashboard':
      return `${baseUrl}/dashboard`;
    case 'transaction':
      return id ? `${baseUrl}/tx/${id}` : `${baseUrl}/transactions`;
    case 'invoices':
      return id ? `${baseUrl}/invoice/${id}` : `${baseUrl}/invoices`;
    case 'settings':
      return `${baseUrl}/settings`;
    case 'analytics':
      return `${baseUrl}/analytics`;
    default:
      return baseUrl;
  }
}

export function getConnectionHint(): string | null {
  if (isConnected()) {
    return null;
  }

  // Show hint randomly (not every time to avoid annoyance)
  // ~30% chance to show hint
  if (Math.random() > 0.3) {
    return null;
  }

  return t('connection.connectionHint');
}

// Show hint for summary/list commands (~50% chance)
export function getConnectionHintForSummary(): string | null {
  if (isConnected()) {
    return null;
  }

  if (Math.random() > 0.5) {
    return null;
  }

  return t('connection.connectionHintSummary');
}

export function getTokenExpiryWarning(): string | null {
  const state = getConnectionState();
  if (!state.connected || !state.connectedAt) return null;

  const connectedAt = new Date(state.connectedAt);
  const daysSinceConnect = (Date.now() - connectedAt.getTime()) / (1000 * 60 * 60 * 24);

  if (daysSinceConnect > 25) {
    return t('connection.tokenExpiringSoon');
  }

  return null;
}

export { API_URL, WEB_URL };
