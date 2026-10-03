import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/**": ["./data/derived/**/*.json"],
  },
};

export default nextConfig;
