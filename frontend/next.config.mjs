/** @type {import('next').NextConfig} */

// Security headers for every page. CSP notes:
//  - script-src needs 'unsafe-inline' for Next's inline runtime; no external
//    script origins are allowed at all (nothing to hijack).
//  - connect-src limits API calls to self + the API origin (+ ws for sockets).
//  - img-src allows the API origin (pet photos served from /uploads).
const apiOrigin = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const wsOrigin = apiOrigin.replace(/^http/, "ws");

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      `img-src 'self' data: blob: ${apiOrigin}`,
      "font-src 'self' data:",
      `connect-src 'self' ${apiOrigin} ${wsOrigin}`,
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; "),
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(self)" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
