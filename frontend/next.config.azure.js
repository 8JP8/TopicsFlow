/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  // Enable static export for Azure deployment
  output: 'export',
  // Disable image optimization for static export
  images: {
    unoptimized: true,
  },
  // Disable internationalization for static export
  // i18n is not compatible with output: 'export'
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000',
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME || 'TopicsFlow'
  },
  // Trailing slash for better static hosting compatibility
  trailingSlash: true,
  // Security headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ];
  },
  // Base path for Azure deployment (if needed)
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
};

module.exports = nextConfig;
