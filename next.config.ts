import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Uploaded source files are served only through authenticated route handlers,
  // never from the public/ directory.
  experimental: { serverActions: { bodySizeLimit: "25mb" } },
};

export default nextConfig;
