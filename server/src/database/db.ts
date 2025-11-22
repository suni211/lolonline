import mariadb from 'mariadb';
import dotenv from 'dotenv';

dotenv.config();

const pool = mariadb.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'lolpro_online',
  connectionLimit: 10,
  acquireTimeout: 30000,
});

export async function getConnection() {
  return await pool.getConnection();
}

export async function query(sql: string, params?: any[]) {
  const conn = await getConnection();
  try {
    return await conn.query(sql, params);
  } finally {
    conn.release();
  }
}

export default pool;

