import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // @masterqala/ui отдаётся исходниками (exports → src/index.ts), а не сборкой:
  // так не бывает устаревшего dist/ и не нужен порядок сборки пакетов.
  // Взамен Next должен сам транспилировать TSX из воркспейс-пакета.
  transpilePackages: ['@masterqala/ui'],
};

export default nextConfig;
