import { withSentryConfig } from "@sentry/nextjs/config"

/** @type {import('next').NextConfig} */
const nextConfig = {
  // This workspace sits beneath another npm lockfile. Pin Next's roots to this
  // project so local and CI builds never crawl the parent user directory.
  outputFileTracingRoot: process.cwd(),
  turbopack: {
    root: process.cwd(),
  },
  // Type errors now fail the build. The codebase is clean (tsc --noEmit passes);
  // keeping this on means a bad type — like a wrong model ID — can't ship silently.
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "flagcdn.com",
      },
      {
        protocol: "https",
        hostname: "upload.wikimedia.org",
      },
    ],
  },
}

export default withSentryConfig(nextConfig, {
  // Project credentials are read from SENTRY_ORG, SENTRY_PROJECT, and
  // SENTRY_AUTH_TOKEN at build time. Runtime delivery uses the DSN only.
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  telemetry: false,
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },
})
