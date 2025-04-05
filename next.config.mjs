import webpack from "webpack";
import { createRequire } from 'module';
import withTranspileModules from 'next-transpile-modules';

const mode = process.env.BUILD_MODE ?? "standalone";
console.log("[Next] build mode", mode);

const disableChunk = !!process.env.DISABLE_CHUNK || mode === "export";
console.log("[Next] build with chunk: ", !disableChunk);

// 使用 next-transpile-modules 包装配置，移除 pg-native
const withTM = withTranspileModules(['pg', 'pg-pool']);

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack(config) {
    config.module.rules.push({
      test: /\.svg$/,
      use: ["@svgr/webpack"],
    });

    if (disableChunk) {
      config.plugins.push(
        new webpack.optimize.LimitChunkCountPlugin({ maxChunks: 1 }),
      );
    }

    // 提供 Node.js 核心模块的 polyfill
    config.resolve.fallback = {
      child_process: false,
      fs: false,
      path: false,
      stream: false,
      crypto: false,
      os: false,
      util: false,
      net: false,
      tls: false,
    };

    return config;
  },
  output: mode,
  images: {
    unoptimized: mode === "export",
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    formats: ['image/webp'],
  },
  experimental: {
    forceSwcTransforms: true,
    optimizePackageImports: [
      'react-markdown', 
      'lodash-es',
      'emoji-picker-react',
      '@hello-pangea/dnd',
      'mermaid',
    ],
    serverComponentsExternalPackages: ["pg", "pg-pool"],
    serverActions: {
      bodySizeLimit: '4mb',
    },
  },
  compress: true,
  staticPageGenerationTimeout: 180,
  poweredByHeader: false,
  serverRuntimeConfig: {
    PROJECT_ROOT: process.cwd(),
  },
};

const CorsHeaders = [
  { key: "Access-Control-Allow-Credentials", value: "true" },
  { key: "Access-Control-Allow-Origin", value: "*" },
  {
    key: "Access-Control-Allow-Methods",
    value: "*",
  },
  {
    key: "Access-Control-Allow-Headers",
    value: "*",
  },
  {
    key: "Access-Control-Max-Age",
    value: "86400",
  },
];

if (mode !== "export") {
  nextConfig.headers = async () => {
    return [
      {
        source: "/api/:path*",
        headers: CorsHeaders,
      },
    ];
  };

  nextConfig.rewrites = async () => {
    const ret = [
      // adjust for previous version directly using "/api/proxy/" as proxy base route
      // {
      //   source: "/api/proxy/v1/:path*",
      //   destination: "https://api.openai.com/v1/:path*",
      // },
      {
        // https://{resource_name}.openai.azure.com/openai/deployments/{deploy_name}/chat/completions
        source: "/api/proxy/azure/:resource_name/deployments/:deploy_name/:path*",
        destination: "https://:resource_name.openai.azure.com/openai/deployments/:deploy_name/:path*",
      },
      {
        source: "/api/proxy/google/:path*",
        destination: "https://generativelanguage.googleapis.com/:path*",
      },
      {
        source: "/api/proxy/openai/:path*",
        destination: "https://api.openai.com/:path*",
      },
      {
        source: "/api/proxy/anthropic/:path*",
        destination: "https://api.anthropic.com/:path*",
      },
      {
        source: "/google-fonts/:path*",
        destination: "https://fonts.googleapis.com/:path*",
      },
      {
        source: "/sharegpt",
        destination: "https://sharegpt.com/api/conversations",
      },
      {
        source: "/api/proxy/alibaba/:path*",
        destination: "https://dashscope.aliyuncs.com/api/:path*",
      },
    ];
    
    return {
      beforeFiles: ret,
    };
  };
}

// 导出时使用 withTM 包装 nextConfig
export default withTM(nextConfig);
