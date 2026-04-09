import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { AppDataSource } from '../db/index.js';
import { Profile } from '../entities/Profile.js';
import { setProfileSchema, type SetProfileInput } from '../utils/validation.js';
import { getCurrentUserId } from './index.js';
import { t } from '../i18n/index.js';

export function getProfileToolDefinitions(): Tool[] {
  return [
    {
      name: 'get_profile',
      annotations: { readOnlyHint: true },
      description: t('profile.getDesc'),
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'set_profile',
      annotations: { idempotentHint: true },
      description: t('profile.setDesc'),
      inputSchema: {
        type: 'object',
        properties: {
          company_name: {
            type: 'string',
            description: t('profile.companyNameDesc'),
          },
          address: {
            type: 'string',
            description: t('profile.addressDesc'),
          },
          tax_id: {
            type: 'string',
            description: t('profile.taxIdDesc'),
          },
          is_kleinunternehmer: {
            type: 'boolean',
            description: t('profile.kleinunternehmerDesc'),
          },
          bank_details: {
            type: 'string',
            description: t('profile.bankDetailsDesc'),
          },
          phone: {
            type: 'string',
            description: t('profile.phoneDesc'),
          },
          email: {
            type: 'string',
            description: t('profile.emailDesc'),
          },
        },
        required: ['company_name', 'address'],
      },
    },
  ];
}

export async function getProfile(_args: Record<string, unknown>): Promise<unknown> {
  const userId = getCurrentUserId();
  const profileRepo = AppDataSource.getRepository(Profile);

  const profile = await profileRepo.findOne({
    where: { userId },
  });

  if (!profile) {
    return {
      exists: false,
      message: t('profile.noProfile'),
    };
  }

  return {
    exists: true,
    profile: {
      company_name: profile.companyName,
      address: profile.address,
      tax_id: profile.taxId || null,
      is_kleinunternehmer: profile.isKleinunternehmer,
      bank_details: profile.bankDetails || null,
      phone: profile.phone || null,
      email: profile.email || null,
    },
  };
}

export async function setProfile(args: Record<string, unknown>): Promise<unknown> {
  const input = setProfileSchema.parse(args) as SetProfileInput;
  const userId = getCurrentUserId();
  const profileRepo = AppDataSource.getRepository(Profile);

  // Check for existing profile
  let profile = await profileRepo.findOne({
    where: { userId },
  });

  if (profile) {
    // Update existing profile
    profile.companyName = input.company_name;
    profile.address = input.address;
    profile.taxId = input.tax_id || undefined;
    profile.isKleinunternehmer = input.is_kleinunternehmer;
    profile.bankDetails = input.bank_details || undefined;
    profile.phone = input.phone || undefined;
    profile.email = input.email || undefined;
  } else {
    // Create new profile
    profile = profileRepo.create({
      userId,
      companyName: input.company_name,
      address: input.address,
      taxId: input.tax_id,
      isKleinunternehmer: input.is_kleinunternehmer,
      bankDetails: input.bank_details,
      phone: input.phone,
      email: input.email,
    });
  }

  await profileRepo.save(profile);

  const kleinunternehmerHint = profile.isKleinunternehmer ? t('profile.kleinunternehmerHint') : '';

  return {
    success: true,
    message: t('profile.saved', { company: profile.companyName }) + kleinunternehmerHint,
    profile: {
      company_name: profile.companyName,
      address: profile.address,
      tax_id: profile.taxId || null,
      is_kleinunternehmer: profile.isKleinunternehmer,
      bank_details: profile.bankDetails || null,
      phone: profile.phone || null,
      email: profile.email || null,
    },
  };
}
