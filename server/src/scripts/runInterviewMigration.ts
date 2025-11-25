import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../database/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  try {
    const migrationPath = path.resolve(__dirname, '../database/migrations/009_create_player_interviews.sql');
    const sql = fs.readFileSync(migrationPath, 'utf-8');

    const statements = sql.split(';').filter(s => s.trim().length > 0);

    for (const statement of statements) {
      if (statement.trim() && !statement.trim().startsWith('--')) {
        try {
          await pool.query(statement);
          console.log('✅ Statement executed');
        } catch (error: any) {
          if (error.code === 'ER_TABLE_EXISTS_ERROR') {
            console.log('⚠️ Table already exists, skipping...');
          } else {
            throw error;
          }
        }
      }
    }

    console.log('✅ Migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
