import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  allowedDevOrigins: ['sparkly-nonstable-stanton.ngrok-free.dev'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
    ],
  },
}

export default nextConfig
