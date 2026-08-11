# 환경 설정 및 CI/CD 가이드

환경별 설정 전환, 로컬 테스트, 자동 배포 파이프라인에 대한 가이드입니다.

---

## 배포 환경 정보

| 항목 | 값 |
|------|-----|
| EC2 IP | `52.78.62.12` |
| 도메인 | `ai-02-06.duckdns.org` (DuckDNS 무료 DDNS) |
| HTTPS | Let's Encrypt SSL 인증서 (자동 갱신) |
| Frontend | Vercel (`ai-02-06.vercel.app`) |
| Backend API | `https://ai-02-06.duckdns.org/api/` |

---

## 환경 구조 개요

```
envs/
├── .local.env          # 로컬용 실제 값 (gitignore)
├── .prod.env           # prod용 실제 값 (gitignore)
├── example.local.env   # 로컬 템플릿 (git 추적)
└── example.prod.env    # prod 템플릿 (git 추적)
```

### 환경별 차이점

| 항목 | local | dev | prod |
|------|-------|-----|------|
| **Backend** | 로컬 Docker | 로컬 Docker | EC2 Docker |
| **Frontend** | localhost:3000 | localhost:3000 | Vercel |
| **Database** | 로컬 Docker | 로컬 Docker | EC2 Docker |
| **Dev 로그인 버튼** | O (빠른 개발) | X (카카오 테스트) | X |
| **Docker Compose** | docker-compose.yml | docker-compose.yml | docker-compose.prod.yml |
| **SSL/HTTPS** | X | X | O (DuckDNS + Let's Encrypt) |
| **API URL** | localhost:8000 | localhost:8000 | ai-02-06.duckdns.org |

---

## 1. 환경 전환 스크립트

### 동작 원리

스크립트가 `envs/.local.env` 또는 `envs/.prod.env`를 `.env`로 **복사**하고, `ENV`와 `NEXT_PUBLIC_ENV` 값을 해당 환경으로 **수정**합니다.

```
local -> envs/.local.env 복사 후 ENV=local 설정
dev   -> envs/.local.env 복사 후 ENV=dev 설정
prod  -> envs/.prod.env 복사 후 ENV=prod 설정
```

### (로컬 PowerShell) Windows에서 환경 전환

```powershell
# 프로젝트 루트에서 실행
.\env local    # 로컬 개발 (Dev 로그인 버튼 O)
.\env dev      # 카카오 로그인 테스트 (Dev 로그인 버튼 X)
.\env prod     # prod 환경 테스트
```

### (로컬 Mac/Linux) Mac 또는 Linux에서 환경 전환

```bash
# 프로젝트 루트에서 실행
./env.sh local    # 로컬 개발 (Dev 로그인 버튼 O)
./env.sh dev      # 카카오 로그인 테스트 (Dev 로그인 버튼 X)
./env.sh prod     # prod 환경 테스트
```

### (로컬) 환경 전환 후 확인

```bash
# 현재 환경 확인
cat .env | grep "^ENV="
cat .env | grep "^NEXT_PUBLIC_ENV="

# Docker 컨테이너 내 환경 확인
docker exec fastapi printenv | grep ENV
```

---

## 2. 환경별 로컬 테스트 방법

### local 환경 (기본 개발)

가장 빠른 개발을 위한 환경. **Dev 로그인 버튼**으로 카카오 인증 없이 테스트 가능.

#### (로컬 PowerShell)

```powershell
# 1. 환경 설정
.\env local

# 2. Docker 실행
docker compose up -d

# 3. 프론트엔드 실행
cd medication-frontend
npm run dev

# 4. 접속
# Frontend: http://localhost:3000
# Backend:  http://localhost:8000
# API Docs: http://localhost:8000/api/docs
```

#### (로컬 Mac/Linux)

```bash
# 1. 환경 설정
./env.sh local

# 2. Docker 실행
docker compose up -d

# 3. 프론트엔드 실행
cd medication-frontend
npm run dev
```

### dev 환경 (카카오 로그인 테스트)

실제 카카오 로그인 플로우를 테스트할 때 사용.

#### (로컬 PowerShell)

```powershell
# 1. 환경 설정
.\env dev

# 2. envs/.local.env 에서 카카오 키 설정 확인
# KAKAO_CLIENT_ID=실제_REST_API_키
# KAKAO_CLIENT_SECRET=실제_시크릿

# 3. Docker 재시작 (환경변수 반영)
docker compose down
docker compose up -d

# 4. 프론트엔드 실행
cd medication-frontend
npm run dev
```

#### (로컬 Mac/Linux)

```bash
# 1. 환경 설정
./env.sh dev

# 2~4. 위와 동일
```

### prod 환경 (프로덕션 설정 테스트)

배포 전 prod 설정을 로컬에서 테스트.

#### (로컬)

```bash
# 1. 환경 설정
.\env prod       # Windows
./env.sh prod    # Mac/Linux

# 2. Docker 재시작
docker compose down
docker compose up -d

# 3. 테스트
curl http://localhost:8000/api/v1/health
```

---

## 3. CI/CD 파이프라인

### 자동 배포 흐름

```
[개발자 PC]
    |
    | git push (feature branch)
    v
[GitHub]
    |
    | Pull Request -> main 머지
    v
[GitHub Actions] ─────────────────────────────┐
    |                                         |
    | 1. Run Tests (pytest)                   |
    | 2. Deploy to EC2 (SSH)                  |
    | 3. Health Check (DuckDNS 도메인)         |
    v                                         |
[EC2 Server]                                  |
    |                                         |
    | docker compose -f docker-compose.prod.yml up
    v                                         |
[https://ai-02-06.duckdns.org] <──────────────┘
```

### 배포 트리거 조건

```yaml
# .github/workflows/deploy.yml
on:
  push:
    branches: [main]    # main 브랜치에 푸시될 때만
  workflow_dispatch:     # 수동 실행도 가능
```

### 배포 단계

1. **Run Tests**: pytest로 백엔드 테스트 실행
2. **Deploy to EC2**: SSH로 접속 -> git pull -> Docker 재빌드
3. **Health Check**: `https://ai-02-06.duckdns.org/api/v1/health` 응답 확인

---

## 4. GitHub Actions 확인

### Actions 페이지 접속

```
https://github.com/AI-HealthCare-02/AH_02_06/actions
```

### 실행 상태 확인

| 아이콘 | 의미 |
|--------|------|
| 녹색 체크 | 성공 |
| 빨간 X | 실패 |
| 노란 원 | 진행 중 |

### 로그 확인 방법

1. Actions 탭 클릭
2. 특정 워크플로우 실행 클릭
3. `Deploy to EC2` 단계 펼치기
4. 상세 로그 확인

---

## 5. EC2 서버 로그 확인

### (로컬 PowerShell) Windows에서 EC2 접속

```powershell
ssh -i ".\doseph-key.pem" ubuntu@52.78.62.12
```

### (로컬 Mac/Linux) Mac에서 EC2 접속

```bash
ssh -i ./doseph-key.pem ubuntu@52.78.62.12
```

### (EC2) 컨테이너 상태 확인

```bash
cd ~/AI_02_06

# 모든 컨테이너 상태
docker compose -f docker-compose.prod.yml ps

# 특정 컨테이너 상태
docker ps | grep fastapi
```

### (EC2) 로그 확인 명령어

```bash
# FastAPI 로그 (최근 100줄)
docker compose -f docker-compose.prod.yml logs fastapi --tail=100

# FastAPI 로그 (실시간 스트리밍) - Ctrl+C로 종료
docker compose -f docker-compose.prod.yml logs -f fastapi

# Nginx 로그
docker compose -f docker-compose.prod.yml logs nginx --tail=50

# 모든 서비스 로그
docker compose -f docker-compose.prod.yml logs --tail=50

# 특정 시간 이후 로그
docker compose -f docker-compose.prod.yml logs --since="2024-04-15T10:00:00" fastapi
```

### (EC2) 컨테이너 내부 접속

```bash
# FastAPI 컨테이너 쉘
docker exec -it fastapi sh

# 환경변수 확인
docker exec fastapi printenv | grep -E "^(ENV|DB_|KAKAO)"
```

---

## 6. 수동 배포 (긴급 시)

GitHub Actions 실패 시 수동으로 배포할 수 있습니다.

### (EC2) 수동 배포 명령어

```bash
# 프로젝트 폴더 이동
cd ~/AI_02_06

# 최신 코드 가져오기
git fetch origin main
git reset --hard origin/main

# 컨테이너 재빌드 및 실행
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d --build

# 상태 확인
docker compose -f docker-compose.prod.yml ps

# Health Check
curl https://ai-02-06.duckdns.org/api/v1/health
```

---

## 7. Vercel 배포 (프론트엔드)

프론트엔드는 **Vercel**에서 자동 배포됩니다.

### 자동 배포 트리거

- `main` 브랜치 푸시 -> Production 배포 (`ai-02-06.vercel.app`)
- PR 생성 -> Preview 배포

### Vercel 대시보드

```
https://vercel.com/team/ai-02-06
```

### 환경변수 설정 (Vercel Dashboard)

```
Settings > Environment Variables

NEXT_PUBLIC_ENV = prod
API_BASE_URL = https://ai-02-06.duckdns.org
NEXT_PUBLIC_KAKAO_CLIENT_ID = {카카오 REST API 키}
```

---

## 8. DuckDNS 도메인 관리

### DuckDNS란?
무료 Dynamic DNS 서비스로, EC2의 IP 주소를 `ai-02-06.duckdns.org` 도메인으로 연결합니다.

### 도메인 정보
- 도메인: `ai-02-06.duckdns.org`
- Let's Encrypt SSL 인증서 적용 (HTTPS)
- 인증서 자동 갱신 설정됨

### (EC2) SSL 인증서 상태 확인

```bash
# 인증서 만료일 확인
sudo certbot certificates

# 인증서 수동 갱신 (필요 시)
sudo certbot renew --dry-run
```

---

## 9. 문제 해결

### 배포 실패 시 체크리스트

1. **GitHub Actions 로그 확인**
   - Actions 탭에서 실패한 단계 확인

2. **(EC2) 컨테이너 상태 확인**
   ```bash
   docker compose -f docker-compose.prod.yml ps
   ```

3. **(EC2) FastAPI 로그 확인**
   ```bash
   docker compose -f docker-compose.prod.yml logs fastapi --tail=100
   ```

4. **(로컬) Health Check 확인**
   ```bash
   curl https://ai-02-06.duckdns.org/api/v1/health
   ```

### (EC2) 롤백 방법

```bash
cd ~/AI_02_06
git log --oneline -5  # 이전 커밋 해시 확인
git reset --hard {이전_커밋_해시}
docker compose -f docker-compose.prod.yml up -d --build
```

### (EC2) Docker 캐시 정리

```bash
# 사용하지 않는 이미지/컨테이너 정리
docker system prune -af

# 볼륨까지 정리 (주의: DB 데이터 삭제됨!)
docker system prune -af --volumes
```

---

## 빠른 참조

### (로컬) 환경 전환
```bash
.\env local   # Windows PowerShell - 로컬 개발
./env.sh dev  # Mac/Linux - 카카오 테스트
```

### (로컬) Docker 테스트
```bash
docker compose up -d
cd medication-frontend && npm run dev
```

### (로컬 -> EC2) SSH 접속
```bash
ssh -i ./doseph-key.pem ubuntu@52.78.62.12
```

### (EC2) 로그 실시간 확인
```bash
docker compose -f docker-compose.prod.yml logs -f fastapi
```

### GitHub Actions
```
https://github.com/AI-HealthCare-02/AH_02_06/actions
```

### 배포된 서비스
```
Frontend: https://ai-02-06.vercel.app
Backend:  https://ai-02-06.duckdns.org/api/
API Docs: https://ai-02-06.duckdns.org/api/docs
```
