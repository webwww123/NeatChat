import { Pool, QueryResult } from 'pg';
import md5 from 'spark-md5';

// 创建数据库连接池
const pool = new Pool({
  user: process.env.DB_USER || 'avnadmin',
  password: process.env.DB_PASSWORD || '',
  host: process.env.DB_HOST || '',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'defaultdb',
  ssl: {
    rejectUnauthorized: false
  }
});

// 测试数据库连接
pool.query('SELECT NOW()', (err: Error | null, res: QueryResult) => {
  if (err) {
    console.error('数据库连接失败:', err);
  } else {
    console.log('数据库连接成功，当前时间:', res.rows[0].now);
  }
});

/**
 * 执行SQL查询
 * @param text SQL查询文本
 * @param params 查询参数
 * @returns 查询结果
 */
export async function query(text: string, params?: any[]): Promise<QueryResult> {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('执行查询', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('查询执行失败:', error);
    throw error;
  }
}

/**
 * 初始化数据库表
 */
export async function initDatabase() {
  try {
    // 创建用户表
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        access_code VARCHAR(255) NOT NULL UNIQUE,
        access_code_hash VARCHAR(255) NOT NULL UNIQUE,
        is_active BOOLEAN DEFAULT true,
        usage_count INTEGER DEFAULT 0,
        max_usage INTEGER,
        expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_active_at TIMESTAMP
      );
    `);

    // 创建使用日志表
    await query(`
      CREATE TABLE IF NOT EXISTS usage_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        api_endpoint VARCHAR(255) NOT NULL,
        request_method VARCHAR(10) NOT NULL,
        request_body JSONB,
        request_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        response_status INTEGER,
        response_time INTEGER,
        client_ip VARCHAR(50),
        user_agent TEXT
      );
    `);

    // 从环境变量导入访问代码
    await importAccessCodesFromEnv();

    console.log('数据库初始化完成');
    return true;
  } catch (error) {
    console.error('数据库初始化失败:', error);
    return false;
  }
}

/**
 * 从环境变量导入访问代码
 */
async function importAccessCodesFromEnv() {
  try {
    // 检查是否已存在用户
    const existingUsers = await query('SELECT COUNT(*) FROM users');
    
    // 如果已有用户则不导入
    if (parseInt(existingUsers.rows[0].count) > 0) {
      console.log('数据库中已存在用户数据，跳过导入访问代码');
      return;
    }

    // 获取环境变量中的访问代码
    const accessCodesStr = process.env.ACCESS_CODES || '';
    if (!accessCodesStr) {
      console.log('未配置ACCESS_CODES环境变量，跳过导入');
      return;
    }

    // 分割并处理每个访问代码
    const accessCodes = accessCodesStr.split(',').map(code => code.trim()).filter(Boolean);
    console.log(`从环境变量导入 ${accessCodes.length} 个访问代码`);

    // 插入每个访问代码
    for (const code of accessCodes) {
      const hash = md5.hash(code);
      await query(
        'INSERT INTO users (access_code, access_code_hash) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [code, hash]
      );
    }

    console.log('成功导入所有访问代码');
  } catch (error) {
    console.error('导入访问代码失败:', error);
  }
}

// 导出
export default pool; 