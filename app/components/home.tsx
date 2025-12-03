"use client";

require("../polyfill");

import { useState, useEffect } from "react";
import styles from "./home.module.scss";

import hanbaoLogo from "../icons/汉堡.png";
import LoadingIcon from "../icons/three-dots.svg";

import { getCSSVar, useMobileScreen } from "../utils";

import dynamic from "next/dynamic";
import { Path, SlotID } from "../constant";
import { ErrorBoundary } from "./error";

import { getISOLang, getLang } from "../locales";

import {
  HashRouter as Router,
  Routes,
  Route,
  useLocation,
} from "react-router-dom";
import { SideBar } from "./sidebar";
import { useAppConfig } from "../store/config";
import { AuthPage } from "./auth";
import { getClientConfig } from "../config/client";
import { type ClientApi, getClientApi } from "../client/api";
import { useAccessStore } from "../store";
import clsx from "clsx";
import { initializeMcpSystem, isMcpEnabled } from "../mcp/actions";
import { PurchasePage } from "./purchase";
import { InvitePage } from "./invite";
import { WelcomeModal } from "./welcome-modal";
import { Chat } from "./chat";
import { NewChat } from "./new-chat";
import { PurchaseEntry } from "./purchase-entry";

export function Loading(props: { noLogo?: boolean }) {
  return (
    <div className={clsx("no-dark", styles["loading-content"])}>
      {!props.noLogo && (
        <img src={hanbaoLogo.src} alt="汉堡Logo" width={44} height={44} />
      )}
      <LoadingIcon />
      <div className={styles["loading-text"]}>正在加载中，请稍候...</div>
    </div>
  );
}

const Artifacts = dynamic(async () => (await import("./artifacts")).Artifacts, {
  loading: () => <Loading noLogo />,
  ssr: false,
});

const Settings = dynamic(async () => (await import("./settings")).Settings, {
  loading: () => <Loading noLogo />,
  ssr: false,
});

const MaskPage = dynamic(async () => (await import("./mask")).MaskPage, {
  loading: () => <Loading noLogo />,
  ssr: false,
});

const PluginPage = dynamic(async () => (await import("./plugin")).PluginPage, {
  loading: () => <Loading noLogo />,
  ssr: false,
});

const SearchChat = dynamic(
  async () => (await import("./search-chat")).SearchChatPage,
  {
    loading: () => <Loading noLogo />,
    ssr: false,
  },
);

const Sd = dynamic(async () => (await import("./sd")).Sd, {
  loading: () => <Loading noLogo />,
  ssr: false,
});

const McpMarketPage = dynamic(
  async () => (await import("./mcp-market")).McpMarketPage,
  {
    loading: () => <Loading noLogo />,
    ssr: false,
  },
);

export function useSwitchTheme() {
  const config = useAppConfig();

  useEffect(() => {
    document.body.classList.remove("light");
    document.body.classList.remove("dark");

    if (config.theme === "dark") {
      document.body.classList.add("dark");
    } else if (config.theme === "light") {
      document.body.classList.add("light");
    }

    const metaDescriptionDark = document.querySelector(
      'meta[name="theme-color"][media*="dark"]',
    );
    const metaDescriptionLight = document.querySelector(
      'meta[name="theme-color"][media*="light"]',
    );

    if (config.theme === "auto") {
      metaDescriptionDark?.setAttribute("content", "#151515");
      metaDescriptionLight?.setAttribute("content", "#fafafa");
    } else {
      const themeColor = getCSSVar("--theme-color");
      metaDescriptionDark?.setAttribute("content", themeColor);
      metaDescriptionLight?.setAttribute("content", themeColor);
    }
  }, [config.theme]);
}

function useHtmlLang() {
  useEffect(() => {
    const lang = getISOLang();
    const htmlLang = document.documentElement.lang;

    if (lang !== htmlLang) {
      document.documentElement.lang = lang;
    }
  }, []);
}

const useHasHydrated = () => {
  const [hasHydrated, setHasHydrated] = useState<boolean>(false);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  return hasHydrated;
};

const loadAsyncGoogleFont = () => {
  // 添加资源预连接，让浏览器提前建立连接
  const preconnectEl = document.createElement("link");
  preconnectEl.rel = "preconnect";
  preconnectEl.href = "https://fonts.googleapis.com";
  document.head.appendChild(preconnectEl);

  const preconnectEl2 = document.createElement("link");
  preconnectEl2.rel = "preconnect";
  preconnectEl2.href = "https://fonts.gstatic.com";
  preconnectEl2.crossOrigin = "anonymous";
  document.head.appendChild(preconnectEl2);

  // 添加字体样式，使用较小子集以加快加载
  const linkEl = document.createElement("link");
  const proxyFontUrl = "/google-fonts";
  const remoteFontUrl = "https://fonts.googleapis.com";
  const googleFontUrl =
    getClientConfig()?.buildMode === "export" ? remoteFontUrl : proxyFontUrl;
  linkEl.rel = "stylesheet";
  linkEl.href =
    googleFontUrl +
    "/css2?family=" +
    encodeURIComponent("Noto Sans:wght@400;700&display=swap");
  linkEl.media = "print";
  linkEl.onload = () => {
    linkEl.media = "all";
  };
  document.head.appendChild(linkEl);
};

export function WindowContent(props: { children: React.ReactNode }) {
  return (
    <div className={styles["window-content"]} id={SlotID.AppBody}>
      {props?.children}
    </div>
  );
}

function Screen() {
  const config = useAppConfig();
  const location = useLocation();
  const isArtifact = location.pathname.includes(Path.Artifacts);
  const isHome = location.pathname === Path.Home;
  const isAuth = location.pathname === Path.Auth;
  const isSd = location.pathname === Path.Sd;
  const isSdNew = location.pathname === Path.SdNew;
  const isPurchase = location.pathname === Path.Purchase;
  const isInvite = location.pathname === Path.Invite;

  const isMobileScreen = useMobileScreen();
  const shouldTightBorder =
    getClientConfig()?.isApp || (config.tightBorder && !isMobileScreen);

  useEffect(() => {
    loadAsyncGoogleFont();
  }, []);

  if (isArtifact) {
    return (
      <Routes>
        <Route path="/artifacts/:id" element={<Artifacts />} />
      </Routes>
    );
  }
  const renderContent = () => {
    if (isAuth) return <AuthPage />;
    if (isPurchase)
      return (
        <WindowContent>
          <PurchasePage />
        </WindowContent>
      );
    if (isInvite)
      return (
        <WindowContent>
          <InvitePage />
        </WindowContent>
      );
    if (isSd) return <Sd />;
    if (isSdNew) return <Sd />;
    return (
      <>
        <SideBar
          className={clsx({
            [styles["sidebar-show"]]: isHome,
          })}
        />
        <WindowContent>
          <Routes>
            <Route path={Path.Home} element={<Chat />} />
            <Route path={Path.NewChat} element={<NewChat />} />
            <Route path={Path.Masks} element={<MaskPage />} />
            <Route path={Path.Plugins} element={<PluginPage />} />
            <Route path={Path.SearchChat} element={<SearchChat />} />
            <Route path={Path.Chat} element={<Chat />} />
            <Route path={Path.Settings} element={<Settings />} />
            <Route path={Path.McpMarket} element={<McpMarketPage />} />
            <Route path={Path.Purchase} element={<PurchasePage />} />
            <Route path={Path.Invite} element={<InvitePage />} />
          </Routes>
        </WindowContent>
      </>
    );
  };

  return (
    <div
      className={clsx(styles.container, {
        [styles["tight-container"]]: shouldTightBorder,
        [styles["rtl-screen"]]: getLang() === ("ar" as any),
      })}
    >
      {renderContent()}
    </div>
  );
}

// 用于存储上次的 customModels 配置
const CUSTOM_MODELS_CACHE_KEY = "custom-models-hash";

export function useLoadData() {
  const config = useAppConfig();

  const api: ClientApi = getClientApi(config.modelConfig.providerName);

  useEffect(() => {
    (async () => {
      try {
        // 获取服务端配置
        const configResponse = await fetch("/api/config", {
          cache: "no-store",
          headers: { "Cache-Control": "no-cache" },
        });
        const serverConfig = await configResponse.json();
        const serverCustomModels = serverConfig.customModels || "";

        // 获取本地缓存的 customModels
        const cachedCustomModels =
          localStorage.getItem(CUSTOM_MODELS_CACHE_KEY) || "";

        console.log("[Models] 服务端配置:", serverCustomModels.substring(0, 100));
        console.log("[Models] 本地缓存:", cachedCustomModels.substring(0, 100));
        
        // 如果服务端配置变化了，强制更新模型列表
        if (serverCustomModels !== cachedCustomModels) {
          console.log("[Models] 检测到模型配置变化，正在更新...");
          // 更新缓存
          localStorage.setItem(CUSTOM_MODELS_CACHE_KEY, serverCustomModels);
          // 清除旧的模型缓存
          localStorage.removeItem("chat-next-web-models");
          // 清除 app-config 里的 models（但保留其他配置）
          const appConfig = localStorage.getItem("app-config");
          if (appConfig) {
            try {
              const parsed = JSON.parse(appConfig);
              if (parsed.state && parsed.state.models) {
                parsed.state.models = [];
                localStorage.setItem("app-config", JSON.stringify(parsed));
              }
            } catch (e) {
              console.error("[Models] 清除配置缓存失败:", e);
            }
          }
          // 清除 access-control 里的 customModels（但保留其他配置）
          const accessConfig = localStorage.getItem("access-control");
          if (accessConfig) {
            try {
              const parsed = JSON.parse(accessConfig);
              if (parsed.state) {
                parsed.state.customModels = serverCustomModels;
                localStorage.setItem("access-control", JSON.stringify(parsed));
              }
            } catch (e) {
              console.error("[Models] 更新 access 配置失败:", e);
            }
          }
          // 刷新页面以确保模型列表更新
          window.location.reload();
          return;
        }

        // 加载模型
        const models = await api.llm.models();
        config.mergeModels(models);
      } catch (e) {
        console.error("[Models] 加载模型失败:", e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

export function Home() {
  useSwitchTheme();
  useLoadData();
  useHtmlLang();

  useEffect(() => {
    console.log("[Config] got config from build time", getClientConfig());
    useAccessStore.getState().fetch();

    const initMcp = async () => {
      try {
        const enabled = await isMcpEnabled();
        if (enabled) {
          console.log("[MCP] initializing...");
          await initializeMcpSystem();
          console.log("[MCP] initialized");
        }
      } catch (err) {
        console.error("[MCP] failed to initialize:", err);
      }
    };
    initMcp();
  }, []);

  if (!useHasHydrated()) {
    return <Loading />;
  }

  return (
    <ErrorBoundary>
      <Router>
        <Screen />
        <WelcomeModal />
        <PurchaseEntry />
      </Router>
    </ErrorBoundary>
  );
}
