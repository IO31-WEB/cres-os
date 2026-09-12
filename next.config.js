/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next 15 moved this out of `experimental` — if your installed version
  // still expects `experimental.serverComponentsExternalPackages`, move it
  // there instead. Without this, Next tries to bundle the Chromium binary
  // into the function and the PDF route will fail at runtime.
  serverExternalPackages: ['puppeteer-core', '@sparticuz/chromium'],

  // Lint and build are deliberately separate checks (run `npm run lint`
  // and `npm run build` independently, e.g. as separate CI steps) rather
  // than lint blocking the build — this project previously had no working
  // ESLint config at all, so decoupling them here preserves prior build
  // behavior while `npm run lint` is now fully functional and enforced on
  // its own. A handful of pre-existing `no-explicit-any` warnings on raw
  // third-party API response shapes (Google Places, FDOT traffic count
  // API) remain — documented in the security report, not fixed blind here
  // since guessing at external API field types risks silently changing
  // behavior.
  eslint: { ignoreDuringBuilds: true },

  // Baseline security headers applied to every response. HTTPS itself is
  // enforced by Vercel at the edge (plain HTTP requests are redirected
  // before they reach this app), so HSTS here is what tells browsers to
  // skip the insecure request entirely on subsequent visits.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
}

module.exports = nextConfig
