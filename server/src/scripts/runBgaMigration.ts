import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../database/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  try {
    const migrationPath = path.resolve(__dirname, '../database/migrations/010_add_bga_url.sql');
    const sql = fs.readFileSync(migrationPath, 'utf-8');

    const statements = sql.split(';').filter(s => s.trim().length > 0 && !s.trim().startsWith('--'));

    for (const statement of statements) {
      try {
        await pool.query(statement);
        console.log('✅ BGA URL column added');
      } catch (error: any) {
        if (error.code === 'ER_DUP_FIELDNAME') {
          console.log('⚠️ Column already exists');
        } else {
          throw error;
        }
      }
    }

    console.log('✅ Migration completed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
