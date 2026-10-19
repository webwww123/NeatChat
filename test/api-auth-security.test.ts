/** @jest-environment node */
import md5 from "spark-md5";
import { NextRequest } from "next/server";
import { getServerSideConfig } from "@/app/config/server";
import { POST as proxyModelList } from "@/app/api/proxy/route";
import { POST as modelTest } from "@/app/api/model-test/route";
import { handle as unknownProviderProxy } from "@/app/api/proxy";
import { auth } from "@/app/api/auth";
import { ModelProvider } from "@/app/constant";

jest.mock("@/app/config/server", () => ({
  getServerSideConfig: jest.fn(),
}));

const SERVER_KEY = "sk-server-secret-should-not-leak";
const ACCESS_CODE = "correct-access-code";
const ATTACKER_KEY = "sk-attacker-supplied-key";
const BASE_URL = "https://upstream.internal.example";

function makeConfig(overrides: Record<string, any> = {}) {
  return {
    apiKey: SERVER_KEY,
    baseUrl: BASE_URL,
    needCode: true,
    codes: new Set([md5.hash(ACCESS_CODE)]),
    hideUserApiKey: false,
    customModels: "",
    ...overrides,
  };
}

const fetchMock = jest.fn();

function jsonResponse(body: any, status: number = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function accessHeaders(code: string = ACCESS_CODE) {
  return { Authorization: `Bearer nk-${code}` };
}

function makeRequest(
  path: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: any;
  } = {},
) {
  const headers = new Headers(options.headers);
  if (options.body !== undefined && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  return new NextRequest(`https://site.example.com${path}`, {
    method: options.method ?? "POST",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
}

function customProxyRequest(
  baseUrl: string,
  options: {
    code?: string | null;
    authorization?: string;
    method?: string;
  } = {},
) {
  const headers: Record<string, string> = { "x-base-url": baseUrl };
  if (options.code !== null) {
    headers["x-neatchat-access-code"] = options.code ?? ACCESS_CODE;
  }
  if (options.authorization) {
    headers.Authorization = options.authorization;
  }
  return new NextRequest(
    "https://site.example.com/api/custom/v1/chat/completions?foo=bar",
    {
      method: options.method ?? "POST",
      headers,
      body: options.method === "GET" ? undefined : "{}",
    },
  );
}

beforeEach(() => {
  (getServerSideConfig as jest.Mock).mockReset();
  (getServerSideConfig as jest.Mock).mockReturnValue(makeConfig());
  fetchMock.mockReset();
  global.fetch = fetchMock as any;
});

describe("/api/proxy 服务端模型列表", () => {
  const body = { url: `${BASE_URL}/v1/models` };

  it("匿名请求被拒绝，且不发起上游调用", async () => {
    const res = await proxyModelList(makeRequest("/api/proxy", { body }));

    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await res.text()).not.toContain(SERVER_KEY);
  });

  it("错误访问码被拒绝", async () => {
    const res = await proxyModelList(
      makeRequest("/api/proxy", {
        headers: accessHeaders("wrong-code"),
        body,
      }),
    );

    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("客户端自带任意 key 不能代替访问码", async () => {
    const res = await proxyModelList(
      makeRequest("/api/proxy", {
        headers: { Authorization: `Bearer ${ATTACKER_KEY}` },
        body,
      }),
    );

    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await res.text()).not.toContain(SERVER_KEY);
  });

  it("合法访问码正常返回模型列表并使用服务端 key", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: [{ id: "gpt-4o" }] }));

    const res = await proxyModelList(
      makeRequest("/api/proxy", { headers: accessHeaders(), body }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: [{ id: "gpt-4o" }] });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/v1/models`);
    expect(new Headers(init.headers).get("authorization")).toBe(
      `Bearer ${SERVER_KEY}`,
    );
  });

  it("伪装包含 api.openai.com 的外部 URL 不会拿到服务端 key", async () => {
    const res = await proxyModelList(
      makeRequest("/api/proxy", {
        headers: accessHeaders(),
        body: { url: "https://evil.example/api.openai.com/v1/models" },
      }),
    );

    expect(res.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("上游重定向不透传 Location，也不泄露服务端 key", async () => {
    fetchMock.mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { location: "https://evil.example/steal" },
      }),
    );

    const res = await proxyModelList(
      makeRequest("/api/proxy", { headers: accessHeaders(), body }),
    );

    expect(res.status).toBe(502);
    expect(res.headers.get("location")).toBeNull();
    expect(await res.text()).not.toContain(SERVER_KEY);
  });

  it("上游错误不暴露服务端 key", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: { message: `bad key ${SERVER_KEY}` } }, 500),
    );

    const res = await proxyModelList(
      makeRequest("/api/proxy", { headers: accessHeaders(), body }),
    );

    expect(res.status).toBe(502);
    expect(await res.text()).not.toContain(SERVER_KEY);
  });
  it("BASE_URL 带尾斜杠时模型列表仍保持兼容", async () => {
    (getServerSideConfig as jest.Mock).mockReturnValue(
      makeConfig({ baseUrl: `${BASE_URL}/` }),
    );
    fetchMock.mockResolvedValue(jsonResponse({ data: [] }));

    const res = await proxyModelList(
      makeRequest("/api/proxy", {
        headers: accessHeaders(),
        body: { url: `${BASE_URL}//v1/models` },
      }),
    );

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(`${BASE_URL}/v1/models`);
  });
});

describe("/api/model-test 服务端模型测试", () => {
  const body = { models: ["gpt-4o"], timeoutSeconds: 5 };

  it("匿名请求被拒绝，且不发起真实模型调用", async () => {
    const res = await modelTest(makeRequest("/api/model-test", { body }));

    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await res.text()).not.toContain(SERVER_KEY);
  });

  it("客户端自带任意 key 不能代替访问码", async () => {
    const res = await modelTest(
      makeRequest("/api/model-test", {
        headers: { Authorization: `Bearer ${ATTACKER_KEY}` },
        body,
      }),
    );

    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("合法访问码可测试模型，请求固定为最小生成", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ choices: [] }));

    const res = await modelTest(
      makeRequest("/api/model-test", {
        headers: accessHeaders(),
        body: { models: ["gpt-4o"], timeoutSeconds: 5 },
      }),
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.results["gpt-4o"].success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/v1/chat/completions`);
    expect(new Headers(init.headers).get("authorization")).toBe(
      `Bearer ${SERVER_KEY}`,
    );
    const upstreamBody = JSON.parse(init.body);
    expect(upstreamBody.max_tokens).toBe(1);
    expect(upstreamBody.stream).toBe(false);
  });

  it("模型数量超过上限被拒绝", async () => {
    const models = Array.from({ length: 11 }, (_, index) => `model-${index}`);
    const res = await modelTest(
      makeRequest("/api/model-test", {
        headers: accessHeaders(),
        body: { models },
      }),
    );

    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("非法模型名（控制字符）被拒绝", async () => {
    const res = await modelTest(
      makeRequest("/api/model-test", {
        headers: accessHeaders(),
        body: { models: ["bad\nmodel"] },
      }),
    );

    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("中文模型名可以正常测试", async () => {
    (getServerSideConfig as jest.Mock).mockReturnValue(
      makeConfig({ customModels: "3super测试@Other" }),
    );
    fetchMock.mockResolvedValue(jsonResponse({ choices: [] }));

    const res = await modelTest(
      makeRequest("/api/model-test", {
        headers: accessHeaders(),
        body: { models: ["3super测试"] },
      }),
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.results["3super测试"].success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("-all 之后的 +模型 可用，其他模型被拒绝", async () => {
    (getServerSideConfig as jest.Mock).mockReturnValue(
      makeConfig({ customModels: "-all,+gpt-4o" }),
    );
    fetchMock.mockResolvedValue(jsonResponse({ choices: [] }));

    const res = await modelTest(
      makeRequest("/api/model-test", {
        headers: accessHeaders(),
        body: { models: ["gpt-4o", "other-model"] },
      }),
    );

    const data = await res.json();
    expect(data.results["gpt-4o"].success).toBe(true);
    expect(data.results["other-model"].success).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("+all 之后的 -模型 被拒绝，其他模型可用", async () => {
    (getServerSideConfig as jest.Mock).mockReturnValue(
      makeConfig({ customModels: "+all,-gpt-4o" }),
    );
    fetchMock.mockResolvedValue(jsonResponse({ choices: [] }));

    const res = await modelTest(
      makeRequest("/api/model-test", {
        headers: accessHeaders(),
        body: { models: ["gpt-4o", "other-model"] },
      }),
    );

    const data = await res.json();
    expect(data.results["gpt-4o"].success).toBe(false);
    expect(data.results["other-model"].success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("模型条目之后的 -all 会覆盖前面的正向条目", async () => {
    (getServerSideConfig as jest.Mock).mockReturnValue(
      makeConfig({ customModels: "gpt-4o,-all" }),
    );

    const res = await modelTest(
      makeRequest("/api/model-test", {
        headers: accessHeaders(),
        body: { models: ["gpt-4o"] },
      }),
    );

    const data = await res.json();
    expect(data.results["gpt-4o"].success).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("displayName 不作为额外可测试的模型名", async () => {
    (getServerSideConfig as jest.Mock).mockReturnValue(
      makeConfig({ customModels: "real-model=显示名" }),
    );
    fetchMock.mockResolvedValue(jsonResponse({ choices: [] }));

    const res = await modelTest(
      makeRequest("/api/model-test", {
        headers: accessHeaders(),
        body: { models: ["显示名", "real-model"] },
      }),
    );

    const data = await res.json();
    expect(data.results["显示名"].success).toBe(false);
    expect(data.results["real-model"].success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("上游重定向被拒绝，不回传 Location", async () => {
    fetchMock.mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { location: "https://evil.example/steal" },
      }),
    );

    const res = await modelTest(
      makeRequest("/api/model-test", {
        headers: accessHeaders(),
        body: { models: ["gpt-4o"] },
      }),
    );

    const text = await res.text();
    expect(text).not.toContain("evil.example");
    const data = JSON.parse(text);
    expect(data.results["gpt-4o"].success).toBe(false);
    expect(data.results["gpt-4o"].message).toBe("上游重定向被拒绝");
  });

  it("被 CUSTOM_MODELS 禁用的模型不会触发上游调用", async () => {
    (getServerSideConfig as jest.Mock).mockReturnValue(
      makeConfig({ customModels: "-gpt-4o" }),
    );

    const res = await modelTest(
      makeRequest("/api/model-test", {
        headers: accessHeaders(),
        body: { models: ["gpt-4o"] },
      }),
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.results["gpt-4o"].success).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("配置了正向模型列表时只允许列表内模型", async () => {
    (getServerSideConfig as jest.Mock).mockReturnValue(
      makeConfig({ customModels: "gpt-4o,claude-3" }),
    );

    const res = await modelTest(
      makeRequest("/api/model-test", {
        headers: accessHeaders(),
        body: { models: ["not-in-list"] },
      }),
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.results["not-in-list"].success).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("上游失败信息中的服务端 key 会被脱敏", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        { error: { message: `invalid api key: ${SERVER_KEY}` } },
        401,
      ),
    );

    const res = await modelTest(
      makeRequest("/api/model-test", {
        headers: accessHeaders(),
        body,
      }),
    );

    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toContain(SERVER_KEY);
    const data = JSON.parse(text);
    expect(data.results["gpt-4o"].message).toContain("[redacted]");
    expect(data.results["gpt-4o"].error).toBeUndefined();
  });
});

describe("未知 provider 兜底代理", () => {
  const params = { path: ["v1", "chat", "completions"] };

  it("匿名请求被拒绝", async () => {
    const res = await unknownProviderProxy(
      customProxyRequest("https://plugin.example", { code: null }),
      { params },
    );

    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("任意外部 URL（含 api.openai.com 子串伪装）拿不到服务端 key", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));

    const res = await unknownProviderProxy(
      customProxyRequest("https://api.openai.com.evil.example/v1"),
      { params },
    );

    expect(res.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("https://api.openai.com.evil.example/v1/");
    expect(new Headers(init.headers).get("authorization")).toBeNull();
    expect(await res.text()).not.toContain(SERVER_KEY);
  });

  it("路径中包含 api.openai.com 的外部 URL 同样不注入服务端 key", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));

    await unknownProviderProxy(
      customProxyRequest("https://evil.example/api.openai.com/v1"),
      { params },
    );

    const [, init] = fetchMock.mock.calls[0];
    expect(new Headers(init.headers).get("authorization")).toBeNull();
  });

  it("放在 Authorization 的访问码不会被转发到上游", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));

    const res = await unknownProviderProxy(
      customProxyRequest("https://plugin.example", {
        code: null,
        authorization: `Bearer nk-${ACCESS_CODE}`,
      }),
      { params },
    );

    expect(res.status).toBe(200);
    const [, init] = fetchMock.mock.calls[0];
    expect(new Headers(init.headers).get("authorization")).toBeNull();
    expect(await res.text()).not.toContain(ACCESS_CODE);
  });

  it("用户自己的插件鉴权头会原样转发", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));

    await unknownProviderProxy(
      customProxyRequest("https://plugin.example", {
        authorization: "Bearer user-plugin-token",
      }),
      { params },
    );

    const [, init] = fetchMock.mock.calls[0];
    expect(new Headers(init.headers).get("authorization")).toBe(
      "Bearer user-plugin-token",
    );
    expect(init.headers.get("x-neatchat-access-code")).toBeNull();
  });

  it("上游重定向被拒绝且不返回 Location", async () => {
    fetchMock.mockResolvedValue(
      new Response(null, {
        status: 307,
        headers: { location: "https://evil.example/steal" },
      }),
    );

    const res = await unknownProviderProxy(
      customProxyRequest("https://plugin.example"),
      { params },
    );

    expect(res.status).toBe(502);
    expect(res.headers.get("location")).toBeNull();
    expect(await res.text()).not.toContain(SERVER_KEY);
  });

  it("普通域名以 fc/fd 开头不会被误封", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));

    for (const baseUrl of [
      "https://fc.example.com",
      "https://fd-cdn.example.com",
    ]) {
      const res = await unknownProviderProxy(customProxyRequest(baseUrl), {
        params,
      });
      expect(res.status).toBe(200);
    }
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("本机/内网地址被拒绝", async () => {
    for (const baseUrl of [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "http://169.254.169.254",
      "http://10.0.0.5",
    ]) {
      const res = await unknownProviderProxy(customProxyRequest(baseUrl), {
        params,
      });
      expect(res.status).toBe(400);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("auth 日志脱敏", () => {
  it("不记录完整访问码、哈希或服务端密钥", () => {
    const spy = jest.spyOn(console, "log").mockImplementation(() => {});

    try {
      const req = makeRequest("/api/openai/v1/chat/completions", {
        headers: accessHeaders(),
      });
      const result = auth(req, ModelProvider.GPT);

      expect(result.error).toBe(false);
      // 合法访问码仍能正常注入服务端密钥，聊天流程不受影响
      expect(req.headers.get("Authorization")).toBe(`Bearer ${SERVER_KEY}`);

      const logged = spy.mock.calls.flat().map(String).join(" ");
      expect(logged).not.toContain(ACCESS_CODE);
      expect(logged).not.toContain(md5.hash(ACCESS_CODE));
      expect(logged).not.toContain(SERVER_KEY);
    } finally {
      spy.mockRestore();
    }
  });
});
