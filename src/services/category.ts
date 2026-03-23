import { AppDataSource } from '../db/index.js';
import { Category } from '../entities/Category.js';

interface FindOrCreateResult {
  entity: Category | null;
  created: boolean;
}

export async function findOrCreateCategory(
  name: string,
  type: 'income' | 'expense',
  userId: string
): Promise<FindOrCreateResult> {
  if (!name) return { entity: null, created: false };

  const categoryRepo = AppDataSource.getRepository(Category);

  // First, try to find an existing category (default or user-specific)
  const category = await categoryRepo.findOne({
    where: [
      { name, type, isDefault: true },
      { name, type, userId },
    ],
  });

  if (category) {
    return { entity: category, created: false };
  }

  // If not found, create a user-specific category
  const newCategory = categoryRepo.create({
    name,
    type,
    userId,
    isDefault: false,
  });
  await categoryRepo.save(newCategory);

  return { entity: newCategory, created: true };
}
