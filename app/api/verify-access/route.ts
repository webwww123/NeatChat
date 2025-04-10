import { NextRequest, NextResponse } from "next/server";
import { getServerSideConfig } from "@/app/config/server";
import md5 from "spark-md5";

// 该API用于在用户尝试登录前验证访问码是否正确
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { accessCode } = body;

    if (!accessCode) {
      return NextResponse.json(
        { success: false, message: "访问码不能为空" },
        { status: 400 },
      );
    }

    // 获取服务器配置
    const serverConfig = getServerSideConfig();

    // 如果服务器没有设置访问码验证，直接返回成功
    if (!serverConfig.needCode) {
      return NextResponse.json({ success: true });
    }

    // 计算提交的访问码的哈希值
    const hashedCode = md5.hash(accessCode).trim();

    // 验证哈希值是否在允许列表中
    if (serverConfig.codes.has(hashedCode)) {
      return NextResponse.json({ success: true });
    } else {
      // 记录失败的尝试
      console.log("[访问失败] 错误的访问码:", accessCode);
      console.log("[访问失败] 时间:", new Date().toLocaleString());
      console.log(
        "[访问失败] IP:",
        req.ip ||
          req.headers.get("x-real-ip") ||
          req.headers.get("x-forwarded-for"),
      );

      return NextResponse.json(
        { success: false, message: "访问码不正确" },
        { status: 401 },
      );
    }
  } catch (error) {
    console.error("[验证访问码] 错误:", error);
    return NextResponse.json(
      { success: false, message: "服务器错误" },
      { status: 500 },
    );
  }
}

export const runtime = "edge";
