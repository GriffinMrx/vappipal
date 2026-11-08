import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";

// In development, let other devices on the local network (phone, another
// laptop) load the dev scripts when they open http://<this-PC-IP>:3000.
// Without this, Next.js blocks them and the page never becomes interactive.
const lanAddresses = Object.values(networkInterfaces())
  .flat()
  .filter((a) => a && a.family === "IPv4" && !a.internal)
  .map((a) => a!.address);

// Secure headers on every response. No full CSP yet: Clerk and inline styles
// would need nonces. `frame-ancestors` alone stops clickjacking.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  // Browsers ignore HSTS on http://localhost, so development is unaffected.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  experimental: {
    agentFeedback: true,
  },
  // LAN IPs work for viewing, but sign-in needs HTTPS off localhost (browsers
  // only expose the crypto Clerk needs in secure contexts). For phones and other
  // devices use `npm run tunnel`, which serves the dev app over a trusted
  // https://*.trycloudflare.com URL.
  allowedDevOrigins: [...lanAddresses, "*.trycloudflare.com"],
  cacheComponents: true,
  // "Subjects" became "Spaces": old links (bookmarks, reminder emails) still land.
  async redirects() {
    return [
      { source: "/subjects", destination: "/spaces", permanent: true },
      { source: "/subjects/:spaceId", destination: "/spaces/:spaceId", permanent: true },
    ];
  },
  // pdf-parse loads pdf.js (and a native canvas module) at runtime; bundling breaks its worker.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "@napi-rs/canvas"],
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
