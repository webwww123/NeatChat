import { NextRequest, NextResponse } from "next/server";
import { getServerSideConfig } from "@/app/config/server";
import { authAccessCodeOnly } from "../auth";

export const runtime = "edge";

// 该接口只用于服务端模型列表：上游地址和路径都固定，客户端不能指定。
const MODEL_LIST_PATH = "/v1/models";
const UPSTREAM_TIMEOUT_MS = 15 * 1000;

function normalizeBaseUrl(baseUrl?: string) {
  const value = (baseUrl || "https://api.openai.com").trim();
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return null;
    }
    return `${parsed.origin}${parsed.pathname.replace(/\/+$/, "")}`;
  } catch {
    return null;
  }
}

function isSameUrl(a: string, b: string) {
  try {
    const normalize = (value: string) => {
      const url = new URL(value);
      return {
        origin: url.origin,
        pathname: url.pathname.replace(/\/+/g, "/").replace(/\/+$/, ""),
        search: url.search,
      };
    };
    const ua = normalize(a);
    const ub = normalize(b);
    return (
      ua.origin === ub.origin &&
      ua.pathname === ub.pathname &&
      ua.search === ub.search
    );
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  // 必须持有合法访问码，且不能用客户端自带的 API key 代替访问码。
  const authResult = authAccessCodeOnly(req);
  if (authResult.error) {
    return NextResponse.json(authResult, { status: 401 });
  }

  const serverConfig = getServerSideConfig();
  const apiKey = serverConfig.apiKey;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Server API key not configured" },
      { status: 500 },
    );
  }

  const baseUrl = normalizeBaseUrl(serverConfig.baseUrl);
  if (!baseUrl) {
    return NextResponse.json(
      { error: "Server base url is invalid" },
      { status: 500 },
    );
  }

  const allowedUrl = `${baseUrl}${MODEL_LIST_PATH}`;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // 兼容不带 body 的调用，目标地址仍然只由服务端配置决定
    body = {};
  }

  // 旧版前端会带上 url；只接受与固定允许地址完全一致的值，
  // 任意其他 URL（包括伪装包含 api.openai.com 的地址）一律拒绝。
  if (body?.url !== undefined) {
    if (typeof body.url !== "string" || !isSameUrl(body.url, allowedUrl)) {
      return NextResponse.json(
        { error: "URL is not allowed" },
        { status: 403 },
      );
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const response = await fetch(allowedUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      // 不跟随重定向，避免把服务端密钥带到其他地址
      redirect: "manual",
      signal: controller.signal,
    });

    if (response.status >= 300 && response.status < 400) {
      return NextResponse.json(
        { error: "Upstream redirect is not allowed" },
        { status: 502 },
      );
    }

    if (!response.ok) {
      return NextResponse.json(
        { error: `Upstream returned ${response.status}` },
        { status: 502 },
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch {
    // 不返回上游地址、密钥或原始异常详情
    console.error("[Proxy] model list request failed");
    return NextResponse.json(
      { error: "Failed to fetch model list" },
      { status: 502 },
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
