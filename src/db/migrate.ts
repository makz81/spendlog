import 'reflect-metadata';
import { initializeDatabase, closeDatabase } from './data-source.js';

async function migrate() {
  console.log('Running database migration...');

  try {
    await initializeDatabase();
    console.log('Database initialized and synchronized.');

    // With synchronize: true, TypeORM handles schema creation automatically
    // For production, we'd use explicit migrations

    await closeDatabase();
    console.log('Migration complete.');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
