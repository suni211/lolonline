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

// BigInt를 Number로 변환하는 헬퍼 함수
function convertBigIntToNumber(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj === 'bigint') {
    return Number(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(convertBigIntToNumber);
  }
  
  if (typeof obj === 'object') {
    const converted: any = {};
    for (const key in obj) {
      converted[key] = convertBigIntToNumber(obj[key]);
    }
    return converted;
  }
  
  return obj;
}

export async function query(sql: string, params?: any[]) {
  const conn = await getConnection();
  try {
    const result = await conn.query(sql, params);
    return convertBigIntToNumber(result);
  } finally {
    conn.release();
  }
}

// pool.query를 래핑하여 BigInt 변환
const originalQuery = pool.query.bind(pool);
pool.query = async function(sql: string, params?: any[]) {
  const result = await originalQuery(sql, params);
  return convertBigIntToNumber(result);
};

export default pool;

