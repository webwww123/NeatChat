import { NextRequest, NextResponse } from "next/server";
import { withAdminAuth } from "../../middleware";
import { 
  getAccessCodeById, 
  updateAccessCode, 
  deleteAccessCode 
} from "../../../../db/models/accessCode";

// 添加 Node.js 运行时声明
export const runtime = 'nodejs';

// 根据ID获取访问码
async function handleGetCode(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id);
    
    if (isNaN(id)) {
      return NextResponse.json(
        { success: false, message: "无效的ID" },
        { status: 400 }
      );
    }
    
    const code = await getAccessCodeById(id);
    
    if (!code) {
      return NextResponse.json(
        { success: false, message: "访问码不存在" },
        { status: 404 }
      );
    }
    
    // 返回安全版本的访问码信息
    const safeCode = {
      id: code.id,
      hashed_code: code.hashed_code,
      masked_code: code.code.length > 5 
        ? `${code.code.substring(0, 3)}***${code.code.substring(code.code.length - 2)}`
        : '***',
      created_at: code.created_at,
      last_used_at: code.last_used_at,
      usage_count: code.usage_count,
      is_active: code.is_active,
      usage_limit: code.usage_limit,
      expiry_date: code.expiry_date
    };
    
    return NextResponse.json({ success: true, data: safeCode });
  } catch (error) {
    console.error("获取访问码失败:", error);
    return NextResponse.json(
      { success: false, message: "获取访问码失败" },
      { status: 500 }
    );
  }
}

// 更新访问码
async function handleUpdateCode(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id);
    
    if (isNaN(id)) {
      return NextResponse.json(
        { success: false, message: "无效的ID" },
        { status: 400 }
      );
    }
    
    const { is_active, usage_limit, expiry_date } = await req.json();
    
    // 准备更新对象
    const updates: any = {};
    
    if (is_active !== undefined) {
      updates.is_active = Boolean(is_active);
    }
    
    if (usage_limit !== undefined) {
      updates.usage_limit = usage_limit === null ? null : parseInt(usage_limit);
    }
    
    if (expiry_date !== undefined) {
      if (expiry_date === null) {
        updates.expiry_date = null;
      } else {
        const date = new Date(expiry_date);
        if (isNaN(date.getTime())) {
          return NextResponse.json(
            { success: false, message: "无效的过期日期格式" },
            { status: 400 }
          );
        }
        updates.expiry_date = date;
      }
    }
    
    // 如果没有要更新的内容，返回错误
    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, message: "未提供任何更新内容" },
        { status: 400 }
      );
    }
    
    const updatedCode = await updateAccessCode(id, updates);
    
    if (!updatedCode) {
      return NextResponse.json(
        { success: false, message: "更新访问码失败或访问码不存在" },
        { status: 404 }
      );
    }
    
    // 返回安全版本的访问码信息
    const safeCode = {
      id: updatedCode.id,
      hashed_code: updatedCode.hashed_code,
      masked_code: updatedCode.code.length > 5 
        ? `${updatedCode.code.substring(0, 3)}***${updatedCode.code.substring(updatedCode.code.length - 2)}`
        : '***',
      created_at: updatedCode.created_at,
      last_used_at: updatedCode.last_used_at,
      usage_count: updatedCode.usage_count,
      is_active: updatedCode.is_active,
      usage_limit: updatedCode.usage_limit,
      expiry_date: updatedCode.expiry_date
    };
    
    return NextResponse.json(
      { success: true, message: "更新访问码成功", data: safeCode }
    );
  } catch (error) {
    console.error("更新访问码失败:", error);
    return NextResponse.json(
      { success: false, message: "更新访问码失败" },
      { status: 500 }
    );
  }
}

// 删除访问码
async function handleDeleteCode(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id);
    
    if (isNaN(id)) {
      return NextResponse.json(
        { success: false, message: "无效的ID" },
        { status: 400 }
      );
    }
    
    const success = await deleteAccessCode(id);
    
    if (!success) {
      return NextResponse.json(
        { success: false, message: "删除访问码失败或访问码不存在" },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { success: true, message: "删除访问码成功" }
    );
  } catch (error) {
    console.error("删除访问码失败:", error);
    return NextResponse.json(
      { success: false, message: "删除访问码失败" },
      { status: 500 }
    );
  }
}

// 路由处理
export const GET = withAdminAuth((req: NextRequest, ctx: any) => handleGetCode(req, ctx));
export const PUT = withAdminAuth((req: NextRequest, ctx: any) => handleUpdateCode(req, ctx));
export const DELETE = withAdminAuth((req: NextRequest, ctx: any) => handleDeleteCode(req, ctx)); 