import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  experimental: {
    // Upload de currículo/anexos (limite de negócio: 10 MB, validado no servidor).
    serverActions: { bodySizeLimit: "11mb" },
  },
};

export default nextConfig;
