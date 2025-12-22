/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  output: process.env.NODE_ENV === 'production' ? 'export' : undefined,
  images: {
    unoptimized: true,
    domains: ['localhost', 'media.tenor.com'], // Tenor API for GIFs
    formats: ['image/webp', 'image/avif'],
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000',
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME || 'TopicsFlow',
    NEXT_PUBLIC_TENOR_API_KEY: process.env.NEXT_PUBLIC_TENOR_API_KEY || '',
  },

  // Disable compression in dev to avoid zlib memory errors
  compress: process.env.NODE_ENV === 'production',

  // Allow cross-origin requests from local network
  // Allow cross-origin requests from local network
  // experimental: {
  //   allowedDevOrigins: [
  //     'localhost:3000',
  //     '127.0.0.1:3000',
  //     '192.168.1.252:3000', // User's specific mobile IP
  //     '192.168.1.252',
  //   ],
  // },

  // Security headers
  async headers() {
    if (process.env.NODE_ENV !== 'production') {
      return [
        {
          source: '/(.*)',
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
    }
    return [];
  },
  // Rewrites for API proxy (development only)
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  },
  // Webpack configuration to handle module federation errors
  webpack: (config, { isServer }) => {
    // Suppress module federation warnings/errors in development
    if (!isServer) {
      config.optimization = {
        ...config.optimization,
        moduleIds: 'deterministic',
      };
      // Handle module federation errors gracefully
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;