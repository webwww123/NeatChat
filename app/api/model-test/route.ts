import { NextRequest, NextResponse } from "next/server";
import { getServerSideConfig } from "@/app/config/server";
import type { ModelTestResult } from "@/app/utils/model-test";
import { getModelProvider } from "@/app/utils/model";
import { authAccessCodeOnly } from "../auth";

// 输入限制：单次最多测试的模型数、模型名长度、单模型超时和整体时间预算
const MAX_MODELS = 10;
const MAX_MODEL_NAME_LENGTH = 128;
const DEFAULT_TIMEOUT_SECONDS = 5;
const MAX_TIMEOUT_SECONDS = 15;
const MAX_TOTAL_MS = 20 * 1000;
const MAX_UPSTREAM_MESSAGE_LENGTH = 200;
// 模型名只是 JSON 字段，不做 ASCII 白名单（客户有中文模型名），只拒绝控制字符
const CONTROL_CHAR_PATTERN = /[\u0000-\u001f\u007f]/;

function redact(text: string, secrets: string[]) {
  let output = String(text ?? "");
  for (const secret of secrets) {
    if (secret) {
      output = output.split(secret).join("[redacted]");
    }
  }
  return output.slice(0, MAX_UPSTREAM_MESSAGE_LENGTH);
}

function getTimeoutSeconds(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_TIMEOUT_SECONDS;
  }
  return Math.min(Math.max(Math.floor(parsed), 1), MAX_TIMEOUT_SECONDS);
}

/**
 * 按 CUSTOM_MODELS 的书写顺序计算模型可用性，与现有配置语义一致：
 * - `all` 设置全局默认，后面的条目可以覆盖它（如 `-all,+gpt-4o`）；
 * - 同一模型多次出现时以最后一次为准；
 * - displayName 只用于展示，不作为额外可测试的模型名。
 */
function getModelPolicy(customModels: string) {
  const explicit = new Map<string, boolean>();
  let defaultAllowed: boolean | undefined;
  let hasPositiveEntry = false;

  customModels
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .forEach((entry) => {
      const negative = entry.startsWith("-");
      const raw = entry.replace(/^[+-]/, "");
      const [nameConfig] = raw.split("=");
      const [modelName] = getModelProvider(nameConfig || "");

      if (!modelName) return;
      if (!negative) {
        hasPositiveEntry = true;
      }
      if (modelName === "all") {
        // all/-all 覆盖此前所有具体条目，后续条目再覆盖它
        explicit.clear();
        defaultAllowed = !negative;
        return;
      }
      explicit.set(modelName, !negative);
    });

  return {
    explicit,
    // 没有任何正向条目时保持开放（仅排除被明确禁用的模型）
    defaultAllowed: defaultAllowed ?? !hasPositiveEntry,
  };
}

function isModelAllowed(
  model: string,
  policy: ReturnType<typeof getModelPolicy>,
) {
  if (policy.explicit.has(model)) {
    return policy.explicit.get(model) === true;
  }
  return policy.defaultAllowed;
}

// 测试单个模型
async function testModel(
  model: string,
  baseUrl: string,
  apiKey: string,
  timeoutSeconds: number,
): Promise<ModelTestResult> {
  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutSeconds * 1000);

  try {
    // 构建请求URL
    const url = `${baseUrl}/v1/chat/completions`;

    // 构建请求体（固定最小请求，不接收客户端消息内容）
    const requestBody = {
      model: model,
      messages: [
        {
          role: "user",
          content: "Hello!",
        },
      ],
      max_tokens: 1,
      stream: false,
    };

    // 发送请求
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
      // 不跟随上游重定向，避免敏感头或请求被带到其他地址
      redirect: "manual",
      signal: controller.signal,
    });

    const responseTime = Date.now() - startTime;

    // 上游重定向一律拒绝，且不回传 Location
    if (response.status >= 300 && response.status < 400) {
      return {
        success: false,
        message: "上游重定向被拒绝",
        responseTime,
        timeout: false,
      };
    }

    // 检查响应
    if (!response.ok) {
      let upstreamMessage = "";
      try {
        const errorData = await response.json();
        upstreamMessage =
          typeof errorData?.error?.message === "string"
            ? errorData.error.message
            : "";
      } catch {
        upstreamMessage = "";
      }

      return {
        success: false,
        message: upstreamMessage
          ? `测试失败: ${redact(upstreamMessage, [apiKey])}`
          : `测试失败: 上游返回 ${response.status}`,
        responseTime,
        timeout: false,
      };
    }

    return {
      success: true,
      message: `测试成功! 响应时间: ${(responseTime / 1000).toFixed(2)}s`,
      responseTime,
      timeout: false,
    };
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    const isTimeout = error?.name === "AbortError";

    return {
      success: false,
      message: isTimeout ? "请求超时" : "测试出错",
      responseTime,
      timeout: isTimeout,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function POST(req: NextRequest) {
  // 必须持有合法访问码；客户端自带任意 API key 不能代替访问码
  const authResult = authAccessCodeOnly(req);
  if (authResult.error) {
    return NextResponse.json(authResult, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }

  const { models, timeoutSeconds } = body ?? {};

  if (!Array.isArray(models) || models.length === 0) {
    return NextResponse.json(
      { error: "请提供要测试的模型列表" },
      { status: 400 },
    );
  }

  if (models.length > MAX_MODELS) {
    return NextResponse.json(
      { error: `单次最多测试 ${MAX_MODELS} 个模型` },
      { status: 400 },
    );
  }

  const hasInvalidModel = models.some(
    (model: unknown) =>
      typeof model !== "string" ||
      model.length === 0 ||
      model.length > MAX_MODEL_NAME_LENGTH ||
      CONTROL_CHAR_PATTERN.test(model),
  );
  if (hasInvalidModel) {
    return NextResponse.json({ error: "模型名称不合法" }, { status: 400 });
  }

  // 获取服务端配置
  const serverConfig = getServerSideConfig();
  const apiKey = serverConfig.apiKey;
  const baseUrl = serverConfig.baseUrl || "https://api.openai.com";
  const customModels = serverConfig.customModels || "";
  const policy = getModelPolicy(customModels);
  const requestTimeout = getTimeoutSeconds(timeoutSeconds);

  if (!apiKey) {
    return NextResponse.json({ error: "服务端未配置API密钥" }, { status: 500 });
  }

  // 测试结果
  const results: Record<string, ModelTestResult> = {};
  const deadline = Date.now() + MAX_TOTAL_MS;

  // 逐个测试模型
  for (const model of models as string[]) {
    if (!isModelAllowed(model, policy)) {
      results[model] = {
        success: false,
        message: "该模型不在服务端允许列表中",
        timeout: false,
      };
      continue;
    }

    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) {
      results[model] = {
        success: false,
        message: "测试总时长超出限制",
        timeout: true,
      };
      continue;
    }

    const perModelTimeout = Math.min(requestTimeout, remainingMs / 1000);
    results[model] = await testModel(model, baseUrl, apiKey, perModelTimeout);
  }

  return NextResponse.json({ results });
}
