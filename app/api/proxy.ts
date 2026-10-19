import { NextRequest, NextResponse } from "next/server";
import { authAccessCodeOnly } from "./auth";
import { ACCESS_CODE_PREFIX } from "../constant";

const BLOCKED_HOSTNAMES = new Set(["localhost", "metadata.google.internal"]);

// 阻止把代理指向本机/内网/云元数据地址
function isBlockedHostname(hostname: string) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (BLOCKED_HOSTNAMES.has(host) || host.endsWith(".localhost")) {
    return true;
  }
  const isIpv6 = host.includes(":");
  if (
    isIpv6 &&
    (host === "::1" ||
      host === "::" ||
      host.startsWith("fc") ||
      host.startsWith("fd") ||
      host.startsWith("fe80:"))
  ) {
    return true;
  }
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ipv4) return false;
  const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

function parseBaseUrl(req: NextRequest): URL | null {
  const raw = req.headers.get("x-base-url") ?? "";
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return null;
    }
    if (url.username || url.password) {
      return null;
    }
    if (isBlockedHostname(url.hostname)) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

export async function handle(
  req: NextRequest,
  { params }: { params: { path: string[] } },
) {
  console.log("[Proxy Route] params ", params);

  if (req.method === "OPTIONS") {
    return NextResponse.json({ body: "OK" }, { status: 200 });
  }

  // 未知 provider 的通用代理：必须持有合法访问码。
  // 插件请求可能自带 Authorization 用于上游鉴权，因此支持
  // x-neatchat-access-code 单独传递访问码。
  const authResult = authAccessCodeOnly(req);
  if (authResult.error) {
    return NextResponse.json(authResult, { status: 401 });
  }

  const target = parseBaseUrl(req);
  if (!target) {
    return NextResponse.json(
      { error: "X-Base-URL is not allowed" },
      { status: 400 },
    );
  }

  // remove path params from searchParams
  req.nextUrl.searchParams.delete("path");
  req.nextUrl.searchParams.delete("provider");

  const subpath = params.path.join("/");
  if (
    !subpath ||
    subpath
      .split("/")
      .some((segment) => !segment || segment === "." || segment === "..")
  ) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const basePath = target.pathname.replace(/\/+$/, "");
  const fetchUrl = `${
    target.origin
  }${basePath}/${subpath}?${req.nextUrl.searchParams.toString()}`;
  const skipHeaders = ["connection", "host", "origin", "referer", "cookie"];
  const headers = new Headers(
    Array.from(req.headers.entries()).filter((item) => {
      if (
        item[0].indexOf("x-") > -1 ||
        item[0].indexOf("sec-") > -1 ||
        skipHeaders.includes(item[0])
      ) {
        return false;
      }
      return true;
    }),
  );
  // 访问码本身也属于敏感凭据：如果它放在 Authorization 里用于通过鉴权，
  // 不能把它转发给任意外部上游。
  const authorization = headers.get("authorization") ?? "";
  const bareAuthorization = authorization.replace(/^Bearer\s+/i, "").trim();
  if (bareAuthorization.startsWith(ACCESS_CODE_PREFIX)) {
    headers.delete("authorization");
  }

  // 通用代理只转发客户端自己的鉴权头，绝不注入服务端密钥。
  // （原有按 x-base-url 包含 api.openai.com 子串注入密钥的逻辑已删除）

  const controller = new AbortController();
  const fetchOptions: RequestInit = {
    headers,
    method: req.method,
    body: req.body,
    // to fix #2485: https://stackoverflow.com/questions/55920957/cloudflare-worker-typeerror-one-time-use-body
    redirect: "manual",
    // @ts-ignore
    duplex: "half",
    signal: controller.signal,
  };

  const timeoutId = setTimeout(
    () => {
      controller.abort();
    },
    10 * 60 * 1000,
  );

  try {
    const res = await fetch(fetchUrl, fetchOptions);

    // 不跟随也不透传上游重定向，防止浏览器被带到外部地址或泄露敏感头
    if (res.status >= 300 && res.status < 400) {
      return NextResponse.json(
        { error: "Upstream redirect is not allowed" },
        { status: 502 },
      );
    }

    // to prevent browser prompt for credentials
    const newHeaders = new Headers(res.headers);
    newHeaders.delete("www-authenticate");
    // to disable nginx buffering
    newHeaders.set("X-Accel-Buffering", "no");

    // The latest version of the OpenAI API forced the content-encoding to be "br" in json response
    // So if the streaming is disabled, we need to remove the content-encoding header
    // Because Vercel uses gzip to compress the response, if we don't remove the content-encoding header
    // The browser will try to decode the response with brotli and fail
    newHeaders.delete("content-encoding");

    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: newHeaders,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}
