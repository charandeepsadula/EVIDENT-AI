import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  outputFileTracingRoot: path.join(__dirname, "../"),
  eslint: {
    // Lint is run separately via ESLint CLI; skip during build
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;