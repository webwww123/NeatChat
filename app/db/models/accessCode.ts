import { query } from '../index';
import md5 from 'spark-md5';

export interface AccessCode {
  id: number;
  code: string;
  hashed_code: string;
  created_at: Date;
  last_used_at: Date | null;
  usage_count: number;
  is_active: boolean;
  usage_limit: number | null; // 使用次数限制，null表示无限制
  expiry_date: Date | null; // 过期日期，null表示永不过期
}

// 创建访问码表（如果不存在）
export async function createAccessCodeTable() {
  const sql = `
    CREATE TABLE IF NOT EXISTS access_codes (
      id SERIAL PRIMARY KEY,
      code VARCHAR(255) NOT NULL UNIQUE,
      hashed_code VARCHAR(255) NOT NULL UNIQUE,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_used_at TIMESTAMP,
      usage_count INTEGER NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      usage_limit INTEGER,
      expiry_date TIMESTAMP
    );
  `;
  
  try {
    await query(sql);
    console.log('访问码表创建成功或已存在');
    
    // 导入环境变量中的初始访问码（如果表是空的）
    const existingCodes = await getAllAccessCodes();
    if (existingCodes.length === 0) {
      await importAccessCodesFromEnv();
    }
  } catch (error) {
    console.error('创建访问码表失败:', error);
    throw error;
  }
}

// 从环境变量导入访问码
async function importAccessCodesFromEnv() {
  try {
    const code = process.env.CODE;
    if (!code) return;
    
    const codes = code.split(',').filter(v => !!v).map(v => v.trim());
    
    for (const code of codes) {
      const hashedCode = md5.hash(code);
      await addAccessCode(code);
      console.log(`已导入访问码: ${code} (哈希: ${hashedCode})`);
    }
  } catch (error) {
    console.error('导入访问码失败:', error);
  }
}

// 添加新的访问码
export async function addAccessCode(code: string, usageLimit?: number, expiryDate?: Date): Promise<AccessCode | null> {
  const hashedCode = md5.hash(code);
  
  const sql = `
    INSERT INTO access_codes (code, hashed_code, usage_limit, expiry_date)
    VALUES ($1, $2, $3, $4)
    RETURNING *;
  `;
  
  try {
    const result = await query(sql, [code, hashedCode, usageLimit || null, expiryDate || null]);
    return result.rows[0] as AccessCode;
  } catch (error) {
    console.error('添加访问码失败:', error);
    return null;
  }
}

// 获取所有访问码
export async function getAllAccessCodes(): Promise<AccessCode[]> {
  const sql = 'SELECT * FROM access_codes ORDER BY created_at DESC;';
  
  try {
    const result = await query(sql);
    return result.rows as AccessCode[];
  } catch (error) {
    console.error('获取所有访问码失败:', error);
    return [];
  }
}

// 根据ID获取访问码
export async function getAccessCodeById(id: number): Promise<AccessCode | null> {
  const sql = 'SELECT * FROM access_codes WHERE id = $1;';
  
  try {
    const result = await query(sql, [id]);
    return result.rows.length > 0 ? result.rows[0] as AccessCode : null;
  } catch (error) {
    console.error('根据ID获取访问码失败:', error);
    return null;
  }
}

// 根据代码获取访问码
export async function getAccessCodeByCode(code: string): Promise<AccessCode | null> {
  const sql = 'SELECT * FROM access_codes WHERE code = $1;';
  
  try {
    const result = await query(sql, [code]);
    return result.rows.length > 0 ? result.rows[0] as AccessCode : null;
  } catch (error) {
    console.error('根据代码获取访问码失败:', error);
    return null;
  }
}

// 根据哈希代码获取访问码
export async function getAccessCodeByHashedCode(hashedCode: string): Promise<AccessCode | null> {
  const sql = 'SELECT * FROM access_codes WHERE hashed_code = $1;';
  
  try {
    const result = await query(sql, [hashedCode]);
    return result.rows.length > 0 ? result.rows[0] as AccessCode : null;
  } catch (error) {
    console.error('根据哈希代码获取访问码失败:', error);
    return null;
  }
}

// 更新访问码
export async function updateAccessCode(id: number, updates: Partial<AccessCode>): Promise<AccessCode | null> {
  const allowedFields = ['is_active', 'usage_limit', 'expiry_date'];
  const setFields = Object.keys(updates)
    .filter(key => allowedFields.includes(key))
    .map((key, index) => `${key} = $${index + 2}`);
  
  if (setFields.length === 0) return null;
  
  const sql = `
    UPDATE access_codes 
    SET ${setFields.join(', ')} 
    WHERE id = $1
    RETURNING *;
  `;
  
  const values = [id, ...Object.values(updates).filter((_, index) => allowedFields.includes(Object.keys(updates)[index]))];
  
  try {
    const result = await query(sql, values);
    return result.rows.length > 0 ? result.rows[0] as AccessCode : null;
  } catch (error) {
    console.error('更新访问码失败:', error);
    return null;
  }
}

// 记录访问码使用
export async function recordAccessCodeUsage(code: string): Promise<boolean> {
  const sql = `
    UPDATE access_codes 
    SET last_used_at = CURRENT_TIMESTAMP, usage_count = usage_count + 1 
    WHERE code = $1 AND is_active = TRUE
    AND (expiry_date IS NULL OR expiry_date > CURRENT_TIMESTAMP)
    AND (usage_limit IS NULL OR usage_count < usage_limit)
    RETURNING *;
  `;
  
  try {
    const result = await query(sql, [code]);
    return result.rowCount !== null && result.rowCount > 0;
  } catch (error) {
    console.error('记录访问码使用失败:', error);
    return false;
  }
}

// 删除访问码
export async function deleteAccessCode(id: number): Promise<boolean> {
  const sql = 'DELETE FROM access_codes WHERE id = $1 RETURNING id;';
  
  try {
    const result = await query(sql, [id]);
    return result.rowCount !== null && result.rowCount > 0;
  } catch (error) {
    console.error('删除访问码失败:', error);
    return false;
  }
}

// 验证访问码
export async function validateAccessCode(code: string): Promise<boolean> {
  const hashedCode = md5.hash(code);
  const sql = `
    SELECT * FROM access_codes 
    WHERE hashed_code = $1 
    AND is_active = TRUE
    AND (expiry_date IS NULL OR expiry_date > CURRENT_TIMESTAMP)
    AND (usage_limit IS NULL OR usage_count < usage_limit);
  `;
  
  try {
    const result = await query(sql, [hashedCode]);
    if (result.rowCount !== null && result.rowCount > 0) {
      // 记录使用情况
      await recordAccessCodeUsage(result.rows[0].code);
      return true;
    }
    return false;
  } catch (error) {
    console.error('验证访问码失败:', error);
    return false;
  }
} 