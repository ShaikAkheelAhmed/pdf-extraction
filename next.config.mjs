/** @type {import('next').NextConfig} */
const nextConfig = {
  // External packages configuration - updated for Next.js 15+
  serverExternalPackages: ['pdf-parse', 'mammoth'],
  // Configure webpack to handle file system module
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
    };
    return config;
  },
};

export default nextConfig; 