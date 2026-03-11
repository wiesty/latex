import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["child_process"],
  turbopack: {},
  webpack: (config) => {
    // pdfjs-dist uses canvas as optional peer dep; silence the missing-module warning
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
