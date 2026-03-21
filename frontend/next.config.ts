import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

export default function nextConfig(phase: string): NextConfig {
  return {
    // Keep dev and production builds in separate output trees so `next build`
    // does not invalidate a running `next dev` server.
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next/dev" : ".next/prod",
  };
}
