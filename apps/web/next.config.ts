import path from 'node:path';
import type { NextConfig } from 'next';

const config: NextConfig = {
  // Les paquets du monorepo sont servis en TypeScript source.
  transpilePackages: ['@regie/core', '@regie/db', '@regie/jobs', '@regie/providers', '@regie/storage', '@regie/studio'],
  serverExternalPackages: ['bullmq', 'ioredis', '@prisma/client', '@prisma/adapter-pg', 'pg', '@aws-sdk/client-s3'],
  outputFileTracingRoot: path.join(import.meta.dirname, '../..'),
  output: 'standalone',
  experimental: { serverActions: { bodySizeLimit: '60mb' } },
  images: { unoptimized: true },
  agentRules: false,
  devIndicators: false,
};

export default config;
