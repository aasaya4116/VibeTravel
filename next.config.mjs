/** @type {import('next').NextConfig} */
const nextConfig = {
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

export default nextConfig
