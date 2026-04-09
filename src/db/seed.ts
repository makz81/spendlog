import 'reflect-metadata';
import { AppDataSource, initializeDatabase } from './data-source.js';
import { Category } from '../entities/Category.js';
import { User } from '../entities/User.js';
import { t } from '../i18n/index.js';

const DEFAULT_INCOME_CATEGORIES = [
  { nameKey: 'categoryNames.service', color: '#22c55e' },
  { nameKey: 'categoryNames.productSales', color: '#3b82f6' },
  { nameKey: 'categoryNames.affiliateCommission', color: '#8b5cf6' },
  { nameKey: 'categoryNames.other', color: '#6b7280' },
];

const DEFAULT_EXPENSE_CATEGORIES = [
  { nameKey: 'categoryNames.itSoftware', color: '#ef4444' },
  { nameKey: 'categoryNames.marketingAdvertising', color: '#f97316' },
  { nameKey: 'categoryNames.officeSupplies', color: '#eab308' },
  { nameKey: 'categoryNames.travelTransport', color: '#14b8a6' },
  { nameKey: 'categoryNames.education', color: '#6366f1' },
  { nameKey: 'categoryNames.phoneInternet', color: '#ec4899' },
  { nameKey: 'categoryNames.insurance', color: '#84cc16' },
  { nameKey: 'categoryNames.other', color: '#6b7280' },
];

export async function seedDefaultCategories(): Promise<void> {
  const categoryRepo = AppDataSource.getRepository(Category);

  // Check if default categories already exist
  const existingDefaults = await categoryRepo.findBy({ isDefault: true });
  if (existingDefaults.length > 0) {
    console.error('Default categories already exist, skipping seed.');
    return;
  }

  // Seed income categories
  for (const cat of DEFAULT_INCOME_CATEGORIES) {
    const category = categoryRepo.create({
      name: t(cat.nameKey),
      type: 'income',
      isDefault: true,
      color: cat.color,
    });
    await categoryRepo.save(category);
  }

  // Seed expense categories
  for (const cat of DEFAULT_EXPENSE_CATEGORIES) {
    const category = categoryRepo.create({
      name: t(cat.nameKey),
      type: 'expense',
      isDefault: true,
      color: cat.color,
    });
    await categoryRepo.save(category);
  }

  console.error('Default categories seeded successfully.');
}

export async function getOrCreateDefaultUser(): Promise<User> {
  const userRepo = AppDataSource.getRepository(User);

  // Check for existing user
  let user = await userRepo.findOne({ where: {} });

  if (!user) {
    user = userRepo.create({});
    await userRepo.save(user);
    console.error('Default user created.');
  }

  return user;
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  console.error('Running database seed...');
  await initializeDatabase();
  await seedDefaultCategories();
  await getOrCreateDefaultUser();
  console.error('Seed complete.');
  process.exit(0);
}
