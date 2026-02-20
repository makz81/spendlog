/**
 * Connection Tool Integration Tests
 *
 * Tests for: connect, connection_status, disconnect, sync_status, sync_now
 * Note: These tests are limited as connection requires network access.
 * Most tests verify local state behavior without actual API calls.
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { tools } from '../helpers/index.js';
import {
  setupTestDb,
  teardownTestDb,
} from '../setup.js';
import {
  resetFactories,
} from '../fixtures/index.js';
import { clearConnectionState } from '../../src/services/connection.js';

describe('Connection Tools', () => {
  beforeEach(async () => {
    await setupTestDb();
    resetFactories();
    // Clear any existing connection state to ensure clean test environment
    clearConnectionState();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  describe('connection_status', () => {
    it('returns not connected by default', async () => {
      const result = await tools.connectionStatus();

      expect(result.connected).toBe(false);
      expect(result.local_only).toBe(true);
    });

    it('shows hint for connecting', async () => {
      const result = await tools.connectionStatus();

      expect(result.hint).toContain('Verbinde');
    });

    it('lists features available after connect', async () => {
      const result = await tools.connectionStatus();

      expect(result.features_available_after_connect).toBeDefined();
      expect(result.features_available_after_connect?.length).toBeGreaterThan(0);
    });
  });

  describe('disconnect', () => {
    it('returns error when not connected', async () => {
      const result = await tools.disconnect();

      expect(result.success).toBe(false);
      expect(result.message).toContain('nicht verbunden');
    });
  });

  describe('sync_status', () => {
    it('shows not connected when disconnected', async () => {
      const result = await tools.syncStatus();

      expect(result.connected).toBe(false);
      expect(result.hint).toContain('Verbinde');
    });
  });

  describe('sync_now', () => {
    it('returns error when not connected', async () => {
      const result = await tools.syncNow();

      expect(result.success).toBe(false);
      expect(result.message).toContain('Nicht verbunden');
    });
  });

  describe('connect', () => {
    // Note: This test will fail with network error since we don't have a real API
    // We test that it attempts the connection and returns a sensible error
    it('attempts to create connect link', async () => {
      const result = await tools.connect();

      // Without network, this will fail but should have appropriate structure
      if (result.success) {
        // If it somehow succeeds (mock API available)
        expect(result.connect_url).toBeDefined();
        expect(result.instructions).toBeDefined();
      } else {
        // Expected: network failure without real API
        expect(result.message).toBeDefined();
      }
    });
  });

  describe('Connection Workflow (Limited)', () => {
    it('shows correct status flow', async () => {
      // Start disconnected
      const statusBefore = await tools.connectionStatus();
      expect(statusBefore.connected).toBe(false);

      // Try to disconnect when not connected
      const disconnectResult = await tools.disconnect();
      expect(disconnectResult.success).toBe(false);

      // Sync status also shows not connected
      const syncStatus = await tools.syncStatus();
      expect(syncStatus.connected).toBe(false);

      // Sync now fails without connection
      const syncResult = await tools.syncNow();
      expect(syncResult.success).toBe(false);
    });
  });
});
