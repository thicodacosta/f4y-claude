import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  // "Pessoas" virou "Colaboradores" (menu por jornada): links antigos continuam valendo.
  async redirects() {
    return [
      { source: "/pessoas", destination: "/colaboradores", permanent: true },
      { source: "/pessoas/:caminho*", destination: "/colaboradores/:caminho*", permanent: true },
    ];
  },
  experimental: {
    // Upload de currículo/anexos (limite de negócio: 10 MB, validado no servidor).
    serverActions: { bodySizeLimit: "11mb" },
  },
};

export default nextConfig;
