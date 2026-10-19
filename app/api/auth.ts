import { NextRequest } from "next/server";
import { getServerSideConfig } from "../config/server";
import md5 from "spark-md5";
import { ACCESS_CODE_PREFIX, ModelProvider } from "../constant";

function getIP(req: NextRequest) {
  let ip = req.ip ?? req.headers.get("x-real-ip");
  const forwardedFor = req.headers.get("x-forwarded-for");

  if (!ip && forwardedFor) {
    ip = forwardedFor.split(",").at(0) ?? "";
  }

  return ip;
}

function parseApiKey(bearToken: string) {
  const token = bearToken.trim().replaceAll("Bearer ", "").trim();
  const isApiKey = !token.startsWith(ACCESS_CODE_PREFIX);

  return {
    accessCode: isApiKey ? "" : token.slice(ACCESS_CODE_PREFIX.length),
    apiKey: isApiKey ? token : "",
  };
}

/**
 * 从请求中取访问码。
 * 兼容两种传递方式：
 * 1. Authorization: Bearer nk-<accessCode>（普通聊天/模型列表等前端请求）
 * 2. x-neatchat-access-code: <accessCode>（插件代理请求，避免和插件自己的
 *    Authorization 头冲突）
 * 注意：普通 API key 不会被当成访问码。
 */
export function getAccessCodeFromRequest(req: NextRequest): string {
  const authToken = req.headers.get("Authorization") ?? "";
  const { accessCode } = parseApiKey(authToken);
  if (accessCode) return accessCode;

  return (req.headers.get("x-neatchat-access-code") ?? "").trim();
}

/**
 * 只校验访问码，不允许用用户自带的 API key 代替。
 * 用于必须使用服务端密钥的接口（/api/proxy、/api/model-test 等），
 * 防止攻击者随便填一个客户端 key 就绕过访问码并套用服务端 key。
 */
export function authAccessCodeOnly(req: NextRequest): {
  error: boolean;
  msg?: string;
} {
  const serverConfig = getServerSideConfig();

  // 未开启访问码的实例保持原有开放行为
  if (!serverConfig.needCode) {
    return { error: false };
  }

  const accessCode = getAccessCodeFromRequest(req);
  if (!accessCode) {
    return { error: true, msg: "empty access code" };
  }

  const hashedCode = md5.hash(accessCode).trim();
  if (!serverConfig.codes.has(hashedCode)) {
    return { error: true, msg: "wrong access code" };
  }

  return { error: false };
}

export function auth(req: NextRequest, modelProvider: ModelProvider) {
  const authToken = req.headers.get("Authorization") ?? "";

  // check if it is openai api key or user token
  const { accessCode, apiKey } = parseApiKey(authToken);

  const hashedCode = md5.hash(accessCode ?? "").trim();

  const serverConfig = getServerSideConfig();
  const codeMatched = serverConfig.codes.has(hashedCode);
  // 只记录判定结果，不记录访问码、哈希或任何密钥
  console.log(
    "[Auth] needCode:",
    serverConfig.needCode,
    "codeMatched:",
    codeMatched,
    "usingUserApiKey:",
    !!apiKey,
  );
  console.log("[User IP] ", getIP(req));
  console.log("[Time] ", new Date().toLocaleString());

  if (serverConfig.needCode && !codeMatched && !apiKey) {
    return {
      error: true,
      msg: !accessCode ? "empty access code" : "wrong access code",
    };
  }

  if (serverConfig.hideUserApiKey && !!apiKey) {
    return {
      error: true,
      msg: "you are not allowed to access with your own api key",
    };
  }

  // if user does not provide an api key, inject system api key
  if (!apiKey) {
    const serverConfig = getServerSideConfig();

    // const systemApiKey =
    //   modelProvider === ModelProvider.GeminiPro
    //     ? serverConfig.googleApiKey
    //     : serverConfig.isAzure
    //     ? serverConfig.azureApiKey
    //     : serverConfig.apiKey;

    let systemApiKey: string | undefined;

    switch (modelProvider) {
      case ModelProvider.Stability:
        systemApiKey = serverConfig.stabilityApiKey;
        break;
      case ModelProvider.GeminiPro:
        systemApiKey = serverConfig.googleApiKey;
        break;
      case ModelProvider.Claude:
        systemApiKey = serverConfig.anthropicApiKey;
        break;
      case ModelProvider.Doubao:
        systemApiKey = serverConfig.bytedanceApiKey;
        break;
      case ModelProvider.Ernie:
        systemApiKey = serverConfig.baiduApiKey;
        break;
      case ModelProvider.Qwen:
        systemApiKey = serverConfig.alibabaApiKey;
        break;
      case ModelProvider.Moonshot:
        systemApiKey = serverConfig.moonshotApiKey;
        break;
      case ModelProvider.Iflytek:
        systemApiKey =
          serverConfig.iflytekApiKey + ":" + serverConfig.iflytekApiSecret;
        break;
      case ModelProvider.XAI:
        systemApiKey = serverConfig.xaiApiKey;
        break;
      case ModelProvider.ChatGLM:
        systemApiKey = serverConfig.chatglmApiKey;
        break;
      case ModelProvider.GPT:
      default:
        if (req.nextUrl.pathname.includes("azure/deployments")) {
          systemApiKey = serverConfig.azureApiKey;
        } else {
          systemApiKey = serverConfig.apiKey;
        }
    }

    if (systemApiKey) {
      console.log("[Auth] use system api key");
      req.headers.set("Authorization", `Bearer ${systemApiKey}`);
    } else {
      console.log("[Auth] admin did not provide an api key");
    }
  } else {
    console.log("[Auth] use user api key");
  }

  return {
    error: false,
  };
}
