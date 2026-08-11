# Vercel 배포 가이드

Next.js 프론트엔드를 Vercel에 배포하는 가이드입니다.

## 1. Vercel 가입

1. https://vercel.com 접속
2. "Sign Up" 클릭
3. "Continue with GitHub" 선택
4. GitHub 계정으로 로그인 및 권한 허용

## 2. 프로젝트 생성

1. Vercel 대시보드에서 "Add New..." -> "Project" 클릭
2. "Import Git Repository" 섹션에서 GitHub 연동
3. `AI-HealthCare-02/AI_02_06` 레포지토리 선택
4. "Import" 클릭

## 3. 프로젝트 설정 (중요)

모노레포이므로 Next.js 폴더만 빌드하도록 설정해야 합니다.

### Root Directory 설정
```
Root Directory: medication-frontend
```
"Edit" 버튼을 눌러 `medication-frontend` 입력

### Framework Preset
```
Framework Preset: Next.js (자동 감지됨)
```

### Build & Output Settings
```
Build Command: npm run build (기본값)
Output Directory: .next (기본값)
Install Command: npm install (기본값)
```

## 4. 환경 변수 설정

"Environment Variables" 섹션에서 추가:

| Key | Value | 환경 |
|-----|-------|------|
| `NEXT_PUBLIC_API_URL` | `http://52.78.62.12` | Production |

**주의**: `NEXT_PUBLIC_` 접두사가 있어야 클라이언트에서 접근 가능합니다.

## 5. 배포

1. "Deploy" 버튼 클릭
2. 빌드 로그 확인 (약 1-3분 소요)
3. 완료되면 자동 생성된 URL 확인
   - 예: `https://ai-02-06-xxxx.vercel.app`

## 6. 배포 완료 후

### 배포된 URL 확인
- Production: `https://프로젝트명.vercel.app`
- Preview (PR별): `https://프로젝트명-브랜치명.vercel.app`

### 자동 배포 설정 (기본값)
- `main` 브랜치에 push -> 자동으로 Production 배포
- 다른 브랜치에 push -> Preview 배포

## 7. CORS 설정 확인

Vercel 배포 후 URL을 nginx CORS 설정에서 허용하고 있는지 확인:

`nginx/prod_http.conf`:
```nginx
if ($http_origin ~* "^https?://(localhost:3000|.*\.vercel\.app)$") {
    set $cors_origin $http_origin;
}
```

`*.vercel.app` 도메인은 이미 허용되어 있습니다.

## 8. 커스텀 도메인 (선택사항)

나중에 도메인을 구매하면:

1. Vercel 프로젝트 -> "Settings" -> "Domains"
2. 도메인 추가 (예: `www.doseph.com`)
3. DNS 설정 안내에 따라 설정

## 문제 해결

### 빌드 실패: "Module not found"
```bash
# 로컬에서 먼저 테스트
cd medication-frontend
npm install
npm run build
```

### API 호출 실패 (CORS)
1. EC2 nginx가 실행 중인지 확인
2. nginx CORS 설정에 Vercel 도메인이 포함되어 있는지 확인
3. 브라우저 개발자 도구 -> Network 탭에서 에러 확인

### 환경 변수가 적용 안 됨
1. 환경 변수 이름이 `NEXT_PUBLIC_`으로 시작하는지 확인
2. Vercel 대시보드에서 환경 변수 확인
3. 재배포 필요 (환경 변수 변경 후)

## 배포 URL 정리

| 환경 | URL |
|------|-----|
| Frontend (Vercel) | `https://xxx.vercel.app` |
| API (EC2) | `http://52.78.62.12/api/v1` |

## Next.js에서 API 호출 예시

```javascript
// 환경 변수 사용
const API_URL = process.env.NEXT_PUBLIC_API_URL;

// API 호출
const response = await fetch(`${API_URL}/api/v1/health`);
```
