import {
  GoogleSafetySettingsThreshold,
  ServiceProvider,
  StoreKey,
  ApiPath,
  OPENAI_BASE_URL,
  ANTHROPIC_BASE_URL,
  GEMINI_BASE_URL,
  BAIDU_BASE_URL,
  BYTEDANCE_BASE_URL,
  ALIBABA_BASE_URL,
  TENCENT_BASE_URL,
  MOONSHOT_BASE_URL,
  STABILITY_BASE_URL,
  IFLYTEK_BASE_URL,
  XAI_BASE_URL,
  CHATGLM_BASE_URL,
} from "../constant";
import { getHeaders } from "../client/api";
import { getClientConfig } from "../config/client";
import { createPersistStore } from "../utils/store";
import { ensure } from "../utils/clone";
import { DEFAULT_CONFIG } from "./config";
import { getModelProvider } from "../utils/model";
import { showToast } from "../components/ui-lib";

let fetchState = 0; // 0 not fetch, 1 fetching, 2 done

const isApp = getClientConfig()?.buildMode === "export";

const DEFAULT_OPENAI_URL = isApp ? OPENAI_BASE_URL : ApiPath.OpenAI;

const DEFAULT_GOOGLE_URL = isApp ? GEMINI_BASE_URL : ApiPath.Google;

const DEFAULT_ANTHROPIC_URL = isApp ? ANTHROPIC_BASE_URL : ApiPath.Anthropic;

const DEFAULT_BAIDU_URL = isApp ? BAIDU_BASE_URL : ApiPath.Baidu;

const DEFAULT_BYTEDANCE_URL = isApp ? BYTEDANCE_BASE_URL : ApiPath.ByteDance;

const DEFAULT_ALIBABA_URL = isApp ? ALIBABA_BASE_URL : ApiPath.Alibaba;

const DEFAULT_TENCENT_URL = isApp ? TENCENT_BASE_URL : ApiPath.Tencent;

const DEFAULT_MOONSHOT_URL = isApp ? MOONSHOT_BASE_URL : ApiPath.Moonshot;

const DEFAULT_STABILITY_URL = isApp ? STABILITY_BASE_URL : ApiPath.Stability;

const DEFAULT_IFLYTEK_URL = isApp ? IFLYTEK_BASE_URL : ApiPath.Iflytek;

const DEFAULT_XAI_URL = isApp ? XAI_BASE_URL : ApiPath.XAI;

const DEFAULT_CHATGLM_URL = isApp ? CHATGLM_BASE_URL : ApiPath.ChatGLM;

const DEFAULT_ACCESS_STATE = {
  accessCode: "",
  useCustomConfig: false,

  provider: ServiceProvider.OpenAI,

  // 临时访问码相关
  isTemporaryAccess: false,
  accessExpiryTime: undefined as number | undefined,

  // openai
  openaiUrl: DEFAULT_OPENAI_URL,
  openaiApiKey: "",

  // azure
  azureUrl: "",
  azureApiKey: "",
  azureApiVersion: "2023-08-01-preview",

  // google ai studio
  googleUrl: DEFAULT_GOOGLE_URL,
  googleApiKey: "",
  googleApiVersion: "v1",
  googleSafetySettings: GoogleSafetySettingsThreshold.BLOCK_ONLY_HIGH,

  // anthropic
  anthropicUrl: DEFAULT_ANTHROPIC_URL,
  anthropicApiKey: "",
  anthropicApiVersion: "2023-06-01",

  // baidu
  baiduUrl: DEFAULT_BAIDU_URL,
  baiduApiKey: "",
  baiduSecretKey: "",

  // bytedance
  bytedanceUrl: DEFAULT_BYTEDANCE_URL,
  bytedanceApiKey: "",

  // alibaba
  alibabaUrl: DEFAULT_ALIBABA_URL,
  alibabaApiKey: "",

  // moonshot
  moonshotUrl: DEFAULT_MOONSHOT_URL,
  moonshotApiKey: "",

  //stability
  stabilityUrl: DEFAULT_STABILITY_URL,
  stabilityApiKey: "",

  // tencent
  tencentUrl: DEFAULT_TENCENT_URL,
  tencentSecretKey: "",
  tencentSecretId: "",

  // iflytek
  iflytekUrl: DEFAULT_IFLYTEK_URL,
  iflytekApiKey: "",
  iflytekApiSecret: "",

  // xai
  xaiUrl: DEFAULT_XAI_URL,
  xaiApiKey: "",

  // chatglm
  chatglmUrl: DEFAULT_CHATGLM_URL,
  chatglmApiKey: "",

  // server config
  needCode: true,
  hideUserApiKey: false,
  hideBalanceQuery: false,
  disableGPT4: false,
  disableFastLink: false,
  customModels: "",
  defaultModel: "",

  // tts config
  edgeTTSVoiceName: "zh-CN-YunxiNeural",
};

// 过期检查的时间间隔（毫秒）
const EXPIRY_CHECK_INTERVAL = 10 * 1000; // 10秒检查一次

export const useAccessStore = createPersistStore(
  { ...DEFAULT_ACCESS_STATE },

  (set, get) => ({
    // 检查访问是否过期
    checkAccessExpiry() {
      const state = get();
      // 只有临时访问码需要检查过期
      if (state.isTemporaryAccess && state.accessExpiryTime) {
        const now = Date.now();
        if (now >= state.accessExpiryTime) {
          // 过期了，清除访问码
          console.log("[临时访问] 检测到已过期，清除访问码");

          // 记录当前的访问码，判断是否是临时访问码
          const currentAccessCode = state.accessCode;
          const isTemporaryCode = ["test123", "test1234"].includes(
            currentAccessCode,
          );

          set((access) => {
            access.accessCode = "";
            access.isTemporaryAccess = false;
            access.accessExpiryTime = undefined;
            return access;
          });

          localStorage.removeItem("accessExpiryTime");

          // 不清除全局临时访问码记录，让其他用户仍可使用
          // 以下代码被注释掉
          // ["test123", "test1234"].forEach(code => {
          //   localStorage.removeItem(`temp_access_${code}`);
          // });

          showToast("临时访问码已过期，请重新登录");
          return true;
        }
      }
      return false;
    },

    // 获取剩余时间（秒）
    getRemainingTime() {
      const state = get();
      if (state.isTemporaryAccess && state.accessExpiryTime) {
        const now = Date.now();
        const remainingMs = Math.max(0, state.accessExpiryTime - now);
        return Math.floor(remainingMs / 1000);
      }
      return 0;
    },

    enabledAccessControl() {
      get().fetch();
      return get().needCode;
    },

    edgeVoiceName() {
      get().fetch();
      return get().edgeTTSVoiceName;
    },

    isValidOpenAI() {
      return ensure(get(), ["openaiApiKey"]);
    },

    isValidAzure() {
      return ensure(get(), ["azureUrl", "azureApiKey", "azureApiVersion"]);
    },

    isValidGoogle() {
      return ensure(get(), ["googleApiKey"]);
    },

    isValidAnthropic() {
      return ensure(get(), ["anthropicApiKey"]);
    },

    isValidBaidu() {
      return ensure(get(), ["baiduApiKey", "baiduSecretKey"]);
    },

    isValidByteDance() {
      return ensure(get(), ["bytedanceApiKey"]);
    },

    isValidAlibaba() {
      return ensure(get(), ["alibabaApiKey"]);
    },

    isValidTencent() {
      return ensure(get(), ["tencentSecretKey", "tencentSecretId"]);
    },

    isValidMoonshot() {
      return ensure(get(), ["moonshotApiKey"]);
    },
    isValidIflytek() {
      return ensure(get(), ["iflytekApiKey"]);
    },

    isValidXAI() {
      return ensure(get(), ["xaiApiKey"]);
    },

    isValidChatGLM() {
      return ensure(get(), ["chatglmApiKey"]);
    },

    isAuthorized() {
      get().fetch();

      // 检查是否过期
      const isExpired = get().checkAccessExpiry();
      if (isExpired) {
        return false;
      }

      // has token or has code or disabled access control
      return (
        get().isValidOpenAI() ||
        get().isValidAzure() ||
        get().isValidGoogle() ||
        get().isValidAnthropic() ||
        get().isValidBaidu() ||
        get().isValidByteDance() ||
        get().isValidAlibaba() ||
        get().isValidTencent() ||
        get().isValidMoonshot() ||
        get().isValidIflytek() ||
        get().isValidXAI() ||
        get().isValidChatGLM() ||
        !get().enabledAccessControl() ||
        (get().enabledAccessControl() && ensure(get(), ["accessCode"]))
      );
    },
    fetch() {
      if (fetchState > 0 || getClientConfig()?.buildMode === "export") return;
      fetchState = 1;
      fetch("/api/config", {
        method: "post",
        body: null,
        headers: {
          ...getHeaders(),
        },
      })
        .then((res) => res.json())
        .then((res) => {
          const defaultModel = res.defaultModel ?? "";
          if (defaultModel !== "") {
            const [model, providerName] = getModelProvider(defaultModel);
            DEFAULT_CONFIG.modelConfig.model = model;
            DEFAULT_CONFIG.modelConfig.providerName = providerName as any;
          }

          return res;
        })
        .then((res: DangerConfig) => {
          console.log("[Config] got config from server", res);
          set(() => ({ ...res }));
        })
        .catch(() => {
          console.error("[Config] failed to fetch config");
        })
        .finally(() => {
          fetchState = 2;
        });
    },

    // 设置自动检查过期
    setupExpiryCheck() {
      // 从localStorage恢复过期时间
      const storedExpiryTime = localStorage.getItem("accessExpiryTime");

      if (storedExpiryTime) {
        const expiryTime = parseInt(storedExpiryTime);

        if (!isNaN(expiryTime)) {
          const now = Date.now();
          if (expiryTime > now) {
            // 还未过期，恢复临时访问状态
            const accessCode = get().accessCode;
            console.log(
              `[恢复临时访问] 访问码: ${
                accessCode ? accessCode.substring(0, 2) + "***" : "未设置"
              }, 过期时间: ${new Date(expiryTime).toLocaleString()}`,
            );

            set((access) => {
              access.isTemporaryAccess = true;
              access.accessExpiryTime = expiryTime;
              return access;
            });
          } else {
            // 已过期，清除状态
            console.log("[临时访问] 已过期，清除状态");

            // 记录当前的访问码，判断是否是临时访问码
            const currentAccessCode = get().accessCode;
            const isTemporaryCode = ["test123", "test1234"].includes(
              currentAccessCode,
            );

            set((access) => {
              access.accessCode = "";
              access.isTemporaryAccess = false;
              access.accessExpiryTime = undefined;
              return access;
            });

            localStorage.removeItem("accessExpiryTime");

            // 不清除全局临时访问码记录
            // 以下代码被注释掉
            // ["test123", "test1234"].forEach(code => {
            //   localStorage.removeItem(`temp_access_${code}`);
            // });

            showToast("临时访问码已过期，请重新登录");
          }
        } else {
          // 无效的过期时间格式，清除
          localStorage.removeItem("accessExpiryTime");
        }
      }

      // 定期检查是否过期
      const checkInterval = setInterval(() => {
        const isExpired = get().checkAccessExpiry();
        if (isExpired) {
          console.log("[定时检查] 临时访问已过期");
        }
      }, EXPIRY_CHECK_INTERVAL);

      // 返回清理函数
      return () => clearInterval(checkInterval);
    },
  }),
  {
    name: StoreKey.Access,
    version: 3,
    migrate(persistedState, version) {
      if (version < 2) {
        const state = persistedState as {
          token: string;
          openaiApiKey: string;
          azureApiVersion: string;
          googleApiKey: string;
        };
        state.openaiApiKey = state.token;
        state.azureApiVersion = "2023-08-01-preview";
      }

      return persistedState as any;
    },
    onRehydrateStorage: (state) => {
      return (rehydratedState) => {
        if (rehydratedState) {
          // 设置过期检查
          rehydratedState.setupExpiryCheck();
        }
      };
    },
  },
);
