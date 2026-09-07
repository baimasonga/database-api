import type { NextConfig } from "next";

/**
 * Security headers.
 *
 * The dashboard renders only its own content and talks only to its own origin,
 * so the policy is restrictive by default. `unsafe-inline` for styles is
 * required by Next's runtime style injection; scripts are restricted to
 * self plus the inline hydration payload, which Next signs per build.
 */
const SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "img-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-inline'",
      "connect-src 'self'",
      "font-src 'self'",
      "upgrade-insecure-requests",
    ].join("; "),
  },
];

// HSTS is only meaningful over TLS, and would strand a plain-HTTP dev server.
const PRODUCTION_HEADERS = [
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Uploaded source files are served only through authenticated route handlers,
  // never from the public/ directory.
  experimental: { serverActions: { bodySizeLimit: "25mb" } },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          ...SECURITY_HEADERS,
          ...(process.env.NODE_ENV === "production" ? PRODUCTION_HEADERS : []),
        ],
      },
      {
        // Uploaded-file downloads must never be cached by a shared proxy.
        source: "/api/admin/:path*",
        headers: [{ key: "Cache-Control", value: "private, no-store, max-age=0" }],
      },
    ];
  },
};

export default nextConfig;
