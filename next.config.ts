import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: ['ws', 'crypto'],
  turbopack: {},
}

export default nextConfig
