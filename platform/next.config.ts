import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fase 7: os links de convite/magic link do Supabase local apontam para
  // http://127.0.0.1:3000 (site_url em supabase/config.toml) — sem isto, o
  // dev server bloqueia o WebSocket de HMR nesse origin e a página nunca
  // fica interativa (SSR renderiza, mas o React não hidrata).
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
