# 환경 변수 가이드

## 파일 구조

```
envs/
├── .local.env          # 로컬용 실제 값 (gitignore)
├── .prod.env           # prod용 실제 값 (gitignore)
├── example.local.env   # 로컬 템플릿 (git 추적)
└── example.prod.env    # prod 템플릿 (git 추적)
```

---

## 환경 비교

| 항목 | local | dev | prod |
|------|-------|-----|------|
| Backend | 로컬 Docker | 로컬 Docker | Oracle ARM Docker (self-host) |
| Frontend | localhost:3000 | localhost:3000 | Vercel |
| DB | 로컬 Docker | 로컬 Docker | Oracle ARM Docker (self-host) |
| Redis | 로컬 Docker | 로컬 Docker | Oracle ARM Docker (self-host) |
| Dev 로그인 버튼 | O | X | X |
| Docker Compose | docker-compose.yml | docker-compose.yml | docker-compose.prod.yml |

---

## 로컬 개발 시작

```bash
# 1. 환경변수 복사
cp envs/.local.env .env

# 2. Docker 실행
docker compose up -d

# 3. 프론트엔드 실행
cd medication-frontend && npm run dev

# 4. 접속
# Frontend: http://localhost:3000
# Backend:  http://localhost:8000
# DB:       localhost:5432
```

---

## 환경 전환 (자동)

### Windows

```powershell
.\env local    # 로컬 개발 (Dev 로그인 버튼 O)
.\env dev      # 카카오 테스트 (Dev 로그인 버튼 X)
.\env prod     # prod 환경 테스트
```

### Mac / Linux

```bash
./env.sh local    # 로컬 개발 (Dev 로그인 버튼 O)
./env.sh dev      # 카카오 테스트 (Dev 로그인 버튼 X)
./env.sh prod     # prod 환경 테스트
```

### 환경별 차이

| 환경 | ENV | Dev 로그인 버튼 | 용도 |
|------|-----|----------------|------|
| local | local | O | 빠른 개발 (카카오 로그인 없이) |
| dev | dev | X | 카카오 로그인 테스트 |
| prod | prod | X | 프로덕션 설정 테스트 |

### 동작 원리

스크립트가 `.env` 파일을 `envs/.{환경}.env`로 심볼릭 링크합니다.

```
.env -> envs/.local.env   (local/dev 환경)
.env -> envs/.prod.env    (prod 환경)
```

---

## Oracle ARM 배포

### 최초 설정

```bash
# Oracle ARM 접속 (Reserve Public IP)
ssh ubuntu@<oracle-arm-public-ip>

# 프로젝트 클론 (fork 본인 namespace)
git clone https://github.com/kimyeongbin-dev/Doseph.git
cd Doseph

# 환경변수 설정
cp envs/example.prod.env envs/.prod.env
vi envs/.prod.env  # 실제 값 입력 (SECRET_KEY, DB_PASSWORD, KAKAO_*, DOMAIN 등)

# .env로 복사 (docker-compose 가 .env 로 읽음)
cp envs/.prod.env .env

# Docker 실행 (prod용)
docker compose -f docker-compose.prod.yml up -d
```

### 이후 배포

```bash
ssh ubuntu@<oracle-arm-public-ip>
cd Doseph
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

> 자동 배포는 `main` push 시 GitHub Actions (`.github/workflows/deploy.yml`)가 SSH로 처리. 수동 배포는 위 명령만 사용.

---

## Vercel 배포

Vercel Dashboard에서 환경변수 설정:

```
Settings > Environment Variables

NEXT_PUBLIC_ENV = prod                              (Production)
NEXT_PUBLIC_API_BASE_URL = https://doseph.duckdns.org  (Production & Preview)
NEXT_PUBLIC_KAKAO_CLIENT_ID = <카카오 REST API 키>    (All)
```

---

## CI/CD 파이프라인

### GitHub Secrets 설정

```
Repository > Settings > Secrets and variables > Actions

필수:
- SECRET_KEY
- DB_PASSWORD
- KAKAO_CLIENT_ID
- KAKAO_CLIENT_SECRET

선택 (AI Worker):
- CLOVA_OCR_SECRET_KEY
- CLOVA_OCR_INVOKE_URL
- OPENAI_API_KEY
```

### Oracle ARM에 필요한 파일

```
Oracle ARM:/home/ubuntu/Doseph/
├── .env                      # envs/.prod.env 복사본
├── docker-compose.prod.yml   # prod용 Docker Compose
├── logs/                     # 호스트 볼륨 마운트 (fastapi/ai-worker 로그)
└── (나머지 소스코드)
```

---

## Docker Compose 비교

| 항목 | docker-compose.yml | docker-compose.prod.yml |
|------|-------------------|------------------------|
| 용도 | 로컬 개발 | Oracle ARM 배포 |
| 리소스 | 넉넉함 | Oracle ARM Ampere A1 (4 OCPU + 24GB) 기준 |
| 포트 노출 | 5432, 6379, 8000, 80 | 80, 443 |
| Nginx 설정 | default.conf | prod_https.conf (v2.0 PR-5 에서 Caddy 로 교체 예정) |
| SSL | X | Let's Encrypt (DuckDNS) |
| 재시작 정책 | 없음 | unless-stopped |

---

## 문제 해결

### Docker 컨테이너 상태 확인
```bash
docker compose ps
docker compose logs fastapi --tail=50
```

### DB 연결 테스트
```bash
docker exec -it postgres psql -U doseph_admin -d doseph_db
```

### 환경변수 확인
```bash
docker exec fastapi env | grep ENV
```
