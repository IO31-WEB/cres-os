// Vitest runs in plain Node, not through Next.js's webpack/turbopack
// pipeline — and the real `server-only` package unconditionally throws
// when required outside that pipeline (it relies on Next's bundler
// aliasing it away for server bundles and only erroring for client
// bundles). This stub is aliased in vitest.config.ts so modules that
// import 'server-only' can still be unit-tested directly.
export {}
