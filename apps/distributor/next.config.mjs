/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    domains: ['localhost'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
    unoptimized: true,
  },
  serverExternalPackages: ['sharp', 'pdf-to-img', 'pdfjs-dist'],
  transpilePackages: ['@kosha/types', '@kosha/supabase', '@kosha/ui'],
}

export default nextConfig
