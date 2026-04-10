import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client", "@prisma/adapter-neon"],
  },
};

export default nextConfig;
