import { AppDataSource } from '../db/data-source.js';
import { User } from '../entities/User.js';
import type { UserTier } from '../entities/User.js';
import { UPGRADE_URL } from '../constants.js';
import { t } from '../i18n/index.js';

/**
 * Get the user's tier.
 */
export async function getUserTier(userId: string): Promise<UserTier> {
  const userRepo = AppDataSource.getRepository(User);
  const user = await userRepo.findOne({ where: { id: userId } });
  return user?.tier || 'free';
}

/**
 * Check if user has PRO tier. Returns allowed status and optional upgrade message.
 */
export async function requirePro(
  userId: string,
  featureName: string
): Promise<{ allowed: boolean; message?: string }> {
  const tier = await getUserTier(userId);
  if (tier === 'pro') return { allowed: true };
  return { allowed: false, message: t(`${featureName}.proOnly`, { url: UPGRADE_URL }) };
}
