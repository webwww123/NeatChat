import { NextRequest, NextResponse } from "next/server";
import { withAdminAuth } from "../middleware";
import { createAccessCodeTable, getAllAccessCodes, addAccessCode } from "../../../db/models/accessCode";

// 添加 Node.js 运行时声明
export const runtime = 'nodejs';

// 初始化数据库表
createAccessCodeTable().catch(err => {
  console.error("初始化访问码表失败:", err);
});

// 获取所有访问码
async function handleGetAllCodes(req: NextRequest) {
  try {
    const codes = await getAllAccessCodes();
    
    // 出于安全考虑，不返回明文的访问码，只返回哈希值和其他信息
    const safeCodes = codes.map(code => ({
      id: code.id,
      hashed_code: code.hashed_code,
      // 显示访问码的前3位和后2位，中间用***替代
      masked_code: code.code.length > 5 
        ? `${code.code.substring(0, 3)}***${code.code.substring(code.code.length - 2)}`
        : '***',
      created_at: code.created_at,
      last_used_at: code.last_used_at,
      usage_count: code.usage_count,
      is_active: code.is_active,
      usage_limit: code.usage_limit,
      expiry_date: code.expiry_date
    }));
    
    return NextResponse.json({ success: true, data: safeCodes });
  } catch (error) {
    console.error("获取访问码列表失败:", error);
    return NextResponse.json(
      { success: false, message: "获取访问码列表失败" },
      { status: 500 }
    );
  }
}

// 添加新访问码
async function handleAddCode(req: NextRequest) {
  try {
    const { code, usageLimit, expiryDate } = await req.json();
    
    if (!code) {
      return NextResponse.json(
        { success: false, message: "访问码不能为空" },
        { status: 400 }
      );
    }
    
    // 转换日期字符串为Date对象（如果提供了日期）
    let expiryDateObj: Date | undefined = undefined;
    if (expiryDate) {
      expiryDateObj = new Date(expiryDate);
      if (isNaN(expiryDateObj.getTime())) {
        return NextResponse.json(
          { success: false, message: "无效的过期日期格式" },
          { status: 400 }
        );
      }
    }
    
    const newCode = await addAccessCode(
      code,
      usageLimit ? parseInt(usageLimit) : undefined,
      expiryDateObj
    );
    
    if (!newCode) {
      return NextResponse.json(
        { success: false, message: "添加访问码失败" },
        { status: 500 }
      );
    }
    
    // 返回安全版本的访问码信息
    const safeCode = {
      id: newCode.id,
      hashed_code: newCode.hashed_code,
      masked_code: `${newCode.code.substring(0, 3)}***${newCode.code.substring(newCode.code.length - 2)}`,
      created_at: newCode.created_at,
      last_used_at: newCode.last_used_at,
      usage_count: newCode.usage_count,
      is_active: newCode.is_active,
      usage_limit: newCode.usage_limit,
      expiry_date: newCode.expiry_date
    };
    
    return NextResponse.json(
      { success: true, message: "添加访问码成功", data: safeCode },
      { status: 201 }
    );
  } catch (error) {
    console.error("添加访问码失败:", error);
    return NextResponse.json(
      { success: false, message: "添加访问码失败" },
      { status: 500 }
    );
  }
}

// 路由处理
export const GET = withAdminAuth(handleGetAllCodes);
export const POST = withAdminAuth(handleAddCode); 