import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    // Build errors should be caught during development
    ignoreBuildErrors: false,
  },
  eslint: {
    // ESLint errors should be caught during development
    ignoreDuringBuilds: false,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
  serverExternalPackages: ['@firebase/auth', '@firebase/app'],
  webpack: (config, { isServer }) => {
    // Exclude AI development files from production build
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push({
        '@genkit-ai/firebase': 'commonjs @genkit-ai/firebase',
        '@opentelemetry/exporter-jaeger': 'commonjs @opentelemetry/exporter-jaeger',
      });
    }
    return config;
  },
};

export default nextConfig;
