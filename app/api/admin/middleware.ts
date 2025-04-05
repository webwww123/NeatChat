import { NextRequest, NextResponse } from "next/server";

type RouteHandler<T = unknown> = (
  req: NextRequest,
  context?: any
) => Promise<NextResponse<T>>;

/**
 * 验证管理员权限的中间件
 * 简单实现，检查Authorization头部是否以'Bearer admin_'开头
 */
export function withAdminAuth<T = unknown>(handler: RouteHandler<T>): RouteHandler<T> {
  return async (req: NextRequest, context?: any) => {
    const authHeader = req.headers.get("Authorization");
    
    if (!authHeader || !authHeader.startsWith("Bearer admin_")) {
      return NextResponse.json(
        { success: false, message: "管理员权限验证失败" },
        { status: 401 }
      ) as NextResponse<T>;
    }
    
    // 在真正的应用中，应该验证令牌的有效性，例如通过签名验证
    
    // 调用处理函数
    return handler(req, context);
  };
} 