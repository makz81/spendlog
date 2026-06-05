import 'reflect-metadata';
import { initializeDatabase, closeDatabase } from './data-source.js';

async function migrate() {
  console.log('Running database migration...');

  try {
    await initializeDatabase();
    await closeDatabase();
    console.log('Migration complete.');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
