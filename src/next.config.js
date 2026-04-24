/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['localhost'],
  },
  transpilePackages: ['react-markdown', 'remark-gfm'],
  experimental: {
    optimizePackageImports: ['lucide-react', 'date-fns', 'recharts'],
  },
  onDemandEntries: {
    // Keep compiled pages alive longer in dev to reduce chunk eviction/race issues
    maxInactiveAge: 60 * 60 * 1000,
    pagesBufferLength: 20,
  },
}

module.exports = nextConfig
