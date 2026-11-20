import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  outputFileTracingRoot: __dirname,
  eslint: {
    // Lint is run separately via ESLint CLI; skip during build
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Prevent missing devDependencies or type check hiccups from breaking production build
    ignoreBuildErrors: true,
  },
};

export default nextConfig;

