import { NextRequest, NextResponse } from "next/server";

// 添加 Node.js 运行时声明
export const runtime = 'nodejs';

// 简单的管理员认证，使用环境变量中的ADMIN_ACCESS_CODE
export async function POST(request: NextRequest) {
  try {
    const { accessCode } = await request.json();
    
    if (!accessCode) {
      return NextResponse.json({ success: false, message: "请提供访问码" }, { status: 400 });
    }
    
    // 从环境变量获取管理员访问码
    const adminAccessCode = process.env.ADMIN_ACCESS_CODE;
    
    if (!adminAccessCode) {
      return NextResponse.json(
        { success: false, message: "系统未配置管理员访问码" },
        { status: 500 }
      );
    }
    
    if (accessCode === adminAccessCode) {
      // 登录成功，返回一个简单的会话令牌（在实际生产环境中应使用更安全的方法）
      return NextResponse.json(
        { 
          success: true, 
          message: "登录成功",
          token: `admin_${Date.now()}_${Math.random().toString(36).substring(2, 15)}` 
        },
        { status: 200 }
      );
    } else {
      return NextResponse.json(
        { success: false, message: "管理员访问码不正确" },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error("管理员登录失败:", error);
    return NextResponse.json(
      { success: false, message: "服务器错误" },
      { status: 500 }
    );
  }
} 