import 'reflect-metadata';
import { AppDataSource, initializeDatabase } from './data-source.js';
import { Category } from '../entities/Category.js';
import { User } from '../entities/User.js';

const DEFAULT_INCOME_CATEGORIES = [
  { name: 'Dienstleistung', color: '#22c55e' },
  { name: 'Produktverkauf', color: '#3b82f6' },
  { name: 'Affiliate/Provision', color: '#8b5cf6' },
  { name: 'Sonstiges', color: '#6b7280' },
];

const DEFAULT_EXPENSE_CATEGORIES = [
  { name: 'IT & Software', color: '#ef4444' },
  { name: 'Marketing & Werbung', color: '#f97316' },
  { name: 'Büro & Material', color: '#eab308' },
  { name: 'Reisen & Transport', color: '#14b8a6' },
  { name: 'Weiterbildung', color: '#6366f1' },
  { name: 'Telefon & Internet', color: '#ec4899' },
  { name: 'Versicherungen', color: '#84cc16' },
  { name: 'Sonstiges', color: '#6b7280' },
];

export async function seedDefaultCategories(): Promise<void> {
  const categoryRepo = AppDataSource.getRepository(Category);

  // Check if default categories already exist
  const existingDefaults = await categoryRepo.findBy({ isDefault: true });
  if (existingDefaults.length > 0) {
    console.log('Default categories already exist, skipping seed.');
    return;
  }

  // Seed income categories
  for (const cat of DEFAULT_INCOME_CATEGORIES) {
    const category = categoryRepo.create({
      name: cat.name,
      type: 'income',
      isDefault: true,
      color: cat.color,
    });
    await categoryRepo.save(category);
  }

  // Seed expense categories
  for (const cat of DEFAULT_EXPENSE_CATEGORIES) {
    const category = categoryRepo.create({
      name: cat.name,
      type: 'expense',
      isDefault: true,
      color: cat.color,
    });
    await categoryRepo.save(category);
  }

  console.log('Default categories seeded successfully.');
}

export async function getOrCreateDefaultUser(): Promise<User> {
  const userRepo = AppDataSource.getRepository(User);

  // Check for existing user
  let user = await userRepo.findOne({ where: {} });

  if (!user) {
    user = userRepo.create({});
    await userRepo.save(user);
    console.log('Default user created.');
  }

  return user;
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Running database seed...');
  await initializeDatabase();
  await seedDefaultCategories();
  await getOrCreateDefaultUser();
  console.log('Seed complete.');
  process.exit(0);
}
