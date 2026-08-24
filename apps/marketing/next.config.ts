import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  outputFileTracingRoot: process.cwd(),
  allowedDevOrigins: ["0.0.0.0"],
};

export default nextConfig;
