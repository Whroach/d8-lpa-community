/** @type {import('next').NextConfig} */
const nextConfig = {
  // Lets several local copies run side by side (each needs its own build folder).
  distDir: process.env.NEXT_DIST_DIR || '.next',
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
