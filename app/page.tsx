"use client";

import { Analytics } from "@vercel/analytics/react";
import { useEffect, useState } from "react";
import { useChatStore } from "./store/chat";

import { Home } from "./components/home";

import { getServerSideConfig } from "./config/server";

const serverConfig = getServerSideConfig();

export default function App() {
  const [mcpInitialized, setMcpInitialized] = useState(false);

  useEffect(() => {
    // 确保MCP只初始化一次
    if (!mcpInitialized) {
      useChatStore.getState().initMcp().then(() => {
        setMcpInitialized(true);
        console.log("MCP initialized successfully");
      });
    }
  }, [mcpInitialized]);

  return (
    <>
      <Home />
      {serverConfig?.isVercel && (
        <>
          <Analytics />
        </>
      )}
    </>
  );
}
