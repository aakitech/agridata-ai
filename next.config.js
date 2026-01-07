/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
  async redirects() {
    return [
      {
        source: '/admin/users',
        destination: '/dashboard/admin/users',
        permanent: true,
      },
      {
        source: '/admin/organizations',
        destination: '/dashboard/admin/organizations',
        permanent: true,
      },
      {
        source: '/triage',
        destination: '/dashboard/triage',
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self';",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline';",
              "style-src 'self' 'unsafe-inline';",
              "img-src 'self' data: blob: https://*.supabase.co https://*.tile.openstreetmap.org https://server.arcgisonline.com https://api.twilio.com https://unpkg.com;",
              "font-src 'self' data:;",
              "connect-src 'self' https://*.supabase.co https://*.twilio.com;",
              "frame-src 'none';",
              "object-src 'none';",
              "base-uri 'self';",
              "form-action 'self';"
            ].join(' '),
          },
        ],
      },
    ];
  },
};

export default config;
