/** @type {import('next').NextConfig} */
const nextConfig = {
  // 정적 export: next build -> out/ 정적 산출물 생성 (Cloudflare Pages 등 정적 호스팅 대상)
  output: 'export',

  // 성능 최적화
  experimental: {
    optimizeCss: true, // CSS 최적화
    optimizePackageImports: ['lucide-react'], // 아이콘 라이브러리 최적화
  },

  // 컴파일러 최적화
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production', // 프로덕션에서 console.log 제거
  },

  images: {
    // 정적 export 에는 이미지 최적화 서버가 없으므로 최적화 비활성화 (원본 그대로 서빙)
    unoptimized: true,
    // 외부 이미지 도메인 허용 (필요시 추가)
    remotePatterns: [],
  },

  // 정적 export 는 rewrites(서버 프록시)를 지원하지 않는다.
  // API 호출은 axios baseURL(config.API_BASE_URL = NEXT_PUBLIC_API_BASE_URL)로 백엔드를 직접 호출한다.
}

export default nextConfig
