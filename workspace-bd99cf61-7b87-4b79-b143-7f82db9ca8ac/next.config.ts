import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Ensure these server-only dirs are copied into the standalone output
  // so FFmpeg, SQLite, and file serving work in production
  serverExternalPackages: ["sharp"],
};

export default nextConfig;