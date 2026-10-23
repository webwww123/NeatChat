import { ServiceProvider } from "../app/constant";

let access: any;
let modelConfig: any;

jest.mock("../app/store", () => ({
  useAccessStore: { getState: () => access },
  useChatStore: {
    getState: () => ({ currentSession: () => ({ mask: { modelConfig } }) }),
  },
}));
jest.mock("../app/config/client", () => ({ getClientConfig: () => ({}) }));

const platforms: Record<string, string> = {
  openai: "ChatGPTApi",
  google: "GeminiProApi",
  anthropic: "ClaudeApi",
  baidu: "ErnieApi",
  bytedance: "DoubaoApi",
  alibaba: "QwenApi",
  tencent: "HunyuanApi",
  moonshot: "MoonshotApi",
  iflytek: "SparkApi",
  xai: "XAIApi",
  glm: "ChatGLMApi",
};
for (const [platform, className] of Object.entries(platforms)) {
  jest.doMock(`../app/client/platforms/${platform}`, () => ({
    [className]: class {
      platform = platform;
    },
  }));
}
const {
  getClientApi,
  getHeaders,
  getEffectiveProvider,
} = require("../app/client/api");

beforeEach(() => {
  access = {
    openaiCompatibleGateway: true,
    useCustomConfig: false,
    accessCode: "test-customer-code",
    enabledAccessControl: () => true,
    openaiApiKey: "unused-saved-openai-key",
    googleApiKey: "saved-google-key",
  };
  modelConfig = {
    model: "gemini-3-flash",
    providerName: ServiceProvider.Google,
  };
});

describe("站点兼容网关", () => {
  it.each([
    ServiceProvider.Google,
    ServiceProvider.Anthropic,
    ServiceProvider.Azure,
  ])("旧会话的 %s 标签使用兼容客户端和访问码，不改会话设置", (provider) => {
    modelConfig.providerName = provider;
    const before = JSON.stringify(modelConfig);
    expect(getClientApi(provider).llm.platform).toBe("openai");
    expect(getEffectiveProvider(provider)).toBe(ServiceProvider.OpenAI);
    expect(getHeaders()).toEqual({
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: "Bearer nk-test-customer-code",
    });
    expect(JSON.stringify(modelConfig)).toBe(before);
  });

  it("用户启用自定义 Google 配置后继续使用原生客户端与密钥", () => {
    access.useCustomConfig = true;
    expect(getClientApi(ServiceProvider.Google).llm.platform).toBe("google");
    expect(getHeaders()["x-goog-api-key"]).toBe("saved-google-key");
    expect(getHeaders().Authorization).toBeUndefined();
  });

  it("未开启网关的部署保持原生服务行为", () => {
    access.openaiCompatibleGateway = false;
    expect(getClientApi(ServiceProvider.Google).llm.platform).toBe("google");
    expect(getHeaders()["x-goog-api-key"]).toBe("saved-google-key");
  });
});
