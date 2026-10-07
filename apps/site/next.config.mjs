import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  // Les captures de public/screens sont des PNG plein cadre : pas d'optimiseur
  // côté serveur, le site reste statique.
  images: { unoptimized: true },
  agentRules: false,
};

export default withMDX(config);
