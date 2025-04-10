import { NextRequest, NextResponse } from "next/server";
import { getServerSideConfig } from "@/app/config/server";
import md5 from "spark-md5";

// 需要自动过期的特殊访问码
const TEMPORARY_ACCESS_CODES = ["test1234", "test123"];
// 过期时间（毫秒）
const EXPIRY_TIME_MS = 24 * 60 * 60 * 1000; // 修改为 24 小时

// 该API用于在用户尝试登录前验证访问码是否正确
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { accessCode, clientId } = body;

    console.log(
      `[验证请求] 访问码: ${accessCode.substring(
        0,
        2,
      )}***, 客户端ID: ${clientId?.substring(0, 8)}***`,
    );

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
      // 检查是否是临时访问码
      if (TEMPORARY_ACCESS_CODES.includes(accessCode)) {
        // 计算过期时间 (客户端负责存储和管理这个时间)
        const expiryTime = Date.now() + EXPIRY_TIME_MS;

        // 记录临时访问的信息
        console.log(
          `[临时访问] 访问码: ${accessCode}, 客户端ID: ${clientId?.substring(
            0,
            8,
          )}***, 过期时间: ${new Date(expiryTime).toLocaleString()}`,
        );

        // 返回成功，包含过期时间信息
        return NextResponse.json({
          success: true,
          isTemporary: true,
          expiryTime,
          expiryTimeMs: EXPIRY_TIME_MS,
        });
      }

      // 普通访问码，直接返回成功
      console.log(`[普通验证成功] 访问码: ${accessCode.substring(0, 2)}***`);
      return NextResponse.json({ success: true, isTemporary: false });
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
