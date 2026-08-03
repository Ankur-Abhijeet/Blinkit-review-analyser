import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The collectors read data/seed-corpus.csv at runtime via process.cwd().
  // Next's tracer cannot follow the dynamic path, so include it explicitly or
  // the file is missing from the Vercel serverless bundle.
  outputFileTracingIncludes: {
    "/api/**": ["./data/seed-corpus.csv"],
  },
  // @libsql/client pulls in optional native bindings; keep it external so the
  // bundler does not try to inline them into the server build.
  serverExternalPackages: ["@libsql/client"],
};

export default nextConfig;
