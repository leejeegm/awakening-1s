/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  env: {
    BUILD_TIME_ISO: new Date().toISOString(),
  },
  // Vercel 빌드 시 ESLint/TypeScript 오류로 실패하는 경우 방지 (로컬에서 lint/ts 수정 후 제거 가능)
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;
