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
};

export default nextConfig;
