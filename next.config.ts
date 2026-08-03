import type { NextConfig } from "next";

/**
 * The frontend is a static/SSR Next.js app on Vercel; all API work lives in the
 * separate Express service (see server/). Requests are addressed absolutely via
 * NEXT_PUBLIC_API_BASE_URL — see lib/api.ts.
 *
 * When NEXT_PUBLIC_API_BASE_URL is unset, `apiFetch` emits same-origin relative
 * paths, and this rewrite forwards them to a locally running API so
 * `npm run dev:all` works without CORS.
 */
const LOCAL_API_URL = process.env.LOCAL_API_PROXY_URL || "http://localhost:3001";

const nextConfig: NextConfig = {
  async rewrites() {
    if (process.env.NEXT_PUBLIC_API_BASE_URL) return [];
    return [{ source: "/api/:path*", destination: `${LOCAL_API_URL}/api/:path*` }];
  },
};

export default nextConfig;
