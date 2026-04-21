/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['localhost'],
  },
  transpilePackages: ['react-markdown', 'remark-gfm'],
}

module.exports = nextConfig
