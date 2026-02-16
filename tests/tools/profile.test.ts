/**
 * Profile Tool Integration Tests
 *
 * Tests for: get_profile, set_profile
 * Note: Profile uses company_name and address as required fields
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { tools } from '../helpers/index.js';
import {
  setupTestDb,
  teardownTestDb,
} from '../setup.js';
import {
  profileFactory,
  resetFactories,
} from '../fixtures/index.js';

describe('Profile Tools', () => {
  beforeEach(async () => {
    await setupTestDb();
    resetFactories();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  describe('get_profile', () => {
    it('returns no profile initially', async () => {
      const result = await tools.getProfile();

      expect(result.exists).toBe(false);
      expect(result.message).toContain('Noch kein Profil');
    });

    it('returns profile after setting', async () => {
      await tools.setProfile({
        company_name: 'Test Business',
        address: 'Test Street 1\n12345 City',
      });

      const result = await tools.getProfile();

      expect(result.exists).toBe(true);
      expect(result.profile.company_name).toBe('Test Business');
    });
  });

  describe('set_profile', () => {
    it('sets required fields (company_name and address)', async () => {
      const result = await tools.setProfile({
        company_name: 'My Business GmbH',
        address: 'Musterstraße 1\n12345 Berlin',
      });

      expect(result.success).toBe(true);
      expect(result.profile.company_name).toBe('My Business GmbH');
      expect(result.profile.address).toBe('Musterstraße 1\n12345 Berlin');
    });

    it('sets tax ID', async () => {
      const result = await tools.setProfile({
        company_name: 'Test',
        address: 'Test Address',
        tax_id: 'DE123456789',
      });

      expect(result.profile.tax_id).toBe('DE123456789');
    });

    it('sets Kleinunternehmer status', async () => {
      const result = await tools.setProfile({
        company_name: 'Freelancer',
        address: 'Test Address',
        is_kleinunternehmer: true,
      });

      expect(result.profile.is_kleinunternehmer).toBe(true);
      expect(result.message).toContain('§19 UStG');
    });

    it('sets bank details', async () => {
      const result = await tools.setProfile({
        company_name: 'Test',
        address: 'Test Address',
        bank_details: 'DE89370400440532013000 / Deutsche Bank',
      });

      expect(result.profile.bank_details).toBe('DE89370400440532013000 / Deutsche Bank');
    });

    it('sets contact information', async () => {
      const result = await tools.setProfile({
        company_name: 'Test',
        address: 'Test Address',
        email: 'test@example.com',
        phone: '+49 123 456789',
      });

      expect(result.profile.email).toBe('test@example.com');
      expect(result.profile.phone).toBe('+49 123 456789');
    });

    it('sets complete profile at once', async () => {
      const input = profileFactory.create();
      const result = await tools.setProfile(input);

      expect(result.profile.company_name).toBe(input.company_name);
      expect(result.profile.address).toBe(input.address);
      expect(result.profile.tax_id).toBe(input.tax_id);
      expect(result.profile.email).toBe(input.email);
      expect(result.profile.phone).toBe(input.phone);
    });

    it('updates existing profile', async () => {
      await tools.setProfile({
        company_name: 'Old Name',
        address: 'Old Address',
      });

      const result = await tools.setProfile({
        company_name: 'New Name',
        address: 'New Address',
      });

      expect(result.profile.company_name).toBe('New Name');
      expect(result.profile.address).toBe('New Address');
    });

    it('requires company_name', async () => {
      await expect(
        tools.setProfile({ address: 'Test Address' } as never)
      ).rejects.toThrow();
    });

    it('requires address', async () => {
      await expect(
        tools.setProfile({ company_name: 'Test' } as never)
      ).rejects.toThrow();
    });

    it('validates email format', async () => {
      await expect(
        tools.setProfile({
          company_name: 'Test',
          address: 'Test Address',
          email: 'invalid-email',
        })
      ).rejects.toThrow();
    });
  });

  describe('Profile Workflow', () => {
    it('creates and retrieves complete profile', async () => {
      // Set complete profile
      const input = profileFactory.create();
      await tools.setProfile(input);

      // Retrieve and verify
      const result = await tools.getProfile();

      expect(result.exists).toBe(true);
      expect(result.profile.company_name).toBe(input.company_name);
      expect(result.profile.address).toBe(input.address);
      expect(result.profile.tax_id).toBe(input.tax_id);
    });
  });
});
