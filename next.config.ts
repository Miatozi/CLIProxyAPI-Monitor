import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* 启用 Next.js 16 实验性视图过渡支持 */
  experimental: {
    viewTransition: true,
    /* 优化第三方库打包：自动 tree-shaking */
    optimizePackageImports: ["recharts", "lucide-react", "framer-motion"],
  },
};

export default nextConfig;
