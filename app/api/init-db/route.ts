import { NextResponse } from "next/server";
import { createAccessCodeTable } from "../../db/models/accessCode";

// 添加 Node.js 运行时声明
export const runtime = 'nodejs';

// 初始化数据库
export async function GET() {
  try {
    // 创建访问码表
    await createAccessCodeTable();
    
    return NextResponse.json(
      { success: true, message: "数据库初始化成功" },
      { status: 200 }
    );
  } catch (error) {
    console.error("数据库初始化失败:", error);
    return NextResponse.json(
      { success: false, message: "数据库初始化失败" },
      { status: 500 }
    );
  }
}