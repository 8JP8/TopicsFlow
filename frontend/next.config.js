const isExport = process.env.NODE_ENV === 'production';

const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  output: isExport ? 'export' : undefined,
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

  // Turbopack configuration
  experimental: {
    turbo: {
      resolveAlias: {
        fs: './utils/empty-mock.js',
        net: './utils/empty-mock.js',
        tls: './utils/empty-mock.js',
      },
    },
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

// Only add headers and rewrites if NOT in export mode
if (!isExport) {
  // Security headers
  nextConfig.headers = async () => {
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
  };

  // Rewrites for API proxy (development only)
  nextConfig.rewrites = async () => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  };
}

module.exports = nextConfig;