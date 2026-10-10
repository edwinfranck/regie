import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  // Les captures de public/screens sont des PNG plein cadre : pas d'optimiseur
  // côté serveur, le site reste statique.
  images: { unoptimized: true },
  agentRules: false,
  // /app → l'application en ligne (démo publique).
  async redirects() {
    return [
      { source: '/app', destination: 'https://regie-app-gamma.vercel.app', permanent: false },
      { source: '/app/:path*', destination: 'https://regie-app-gamma.vercel.app/:path*', permanent: false },
    ];
  },
};

export default withMDX(config);
