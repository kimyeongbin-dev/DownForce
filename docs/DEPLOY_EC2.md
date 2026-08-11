# EC2 배포 가이드

EC2 인스턴스(t3.micro)에 FastAPI + Redis + AI-Worker + Nginx를 배포하는 가이드입니다.

## 사전 요구사항

- EC2 인스턴스: t3.micro (Ubuntu)
- SSH 키: `doseph-key.pem`
- EC2 IP: `52.78.62.12`

## 1. EC2 접속

```bash
# Windows (PowerShell 또는 CMD)
ssh -i "doseph-key.pem" ubuntu@52.78.62.12

# Mac/Linux
chmod 400 doseph-key.pem
ssh -i "doseph-key.pem" ubuntu@52.78.62.12
```

## 2. 필수 패키지 설치 (최초 1회)

```bash
# 시스템 업데이트
sudo apt update && sudo apt upgrade -y

# Docker 설치
sudo apt install -y docker.io docker-compose-plugin

# Docker 권한 설정 (sudo 없이 사용)
sudo usermod -aG docker $USER

# 변경사항 적용 (재접속 필요)
exit
```

재접속 후 Docker 확인:
```bash
ssh -i "doseph-key.pem" ubuntu@52.78.62.12
docker --version
docker compose version
```

## 3. 프로젝트 클론

```bash
# 홈 디렉토리에 클론
cd ~
git clone https://github.com/AI-HealthCare-02/AI_02_06.git
cd AI_02_06
```

## 4. 환경 변수 설정

```bash
# .env 파일 생성
nano .env
```

아래 내용을 붙여넣기 (실제 값으로 교체):

```env
# Database
DATABASE_URL=postgresql+asyncpg://사용자:비밀번호@52.78.62.12:5432/doseph_db

# Redis
REDIS_URL=redis://redis:6379/0

# JWT
JWT_SECRET_KEY=your-secret-key-here
JWT_ALGORITHM=RS256

# CLOVA OCR (AI-Worker용)
CLOVA_OCR_INVOKE_URL=your-clova-url
CLOVA_OCR_SECRET_KEY=your-clova-secret

# OpenAI (AI-Worker용)
OPENAI_API_KEY=your-openai-key

# 환경
ENV=production
DEBUG=false
```

저장: `Ctrl + O` -> `Enter` -> `Ctrl + X`

## 5. Docker 이미지 빌드 및 실행

```bash
# 프로덕션 이미지 빌드
docker compose -f docker-compose.prod.yml build

# 컨테이너 실행
docker compose -f docker-compose.prod.yml up -d

# 상태 확인
docker compose -f docker-compose.prod.yml ps
```

## 6. 로그 확인

```bash
# 전체 로그
docker compose -f docker-compose.prod.yml logs -f

# 특정 서비스 로그
docker compose -f docker-compose.prod.yml logs -f fastapi
docker compose -f docker-compose.prod.yml logs -f ai-worker
docker compose -f docker-compose.prod.yml logs -f nginx
```

## 7. 동작 확인

```bash
# Health Check
curl http://localhost/health

# API 테스트
curl http://localhost/api/v1/health

# 외부에서 접근 테스트 (로컬 PC에서)
curl http://52.78.62.12/api/v1/health
```

## 8. EC2 Security Group 설정

AWS 콘솔에서 Security Group 인바운드 규칙 확인:

| 포트 | 소스 | 설명 |
|------|------|------|
| 22 | 내 IP | SSH 접속 |
| 80 | 0.0.0.0/0 | HTTP (Nginx) |
| 5432 | Security Group 자체 | PostgreSQL (내부만) |

**주의**: 8000, 6379 포트는 외부에 노출하지 않습니다.

## 자주 사용하는 명령어

```bash
# 컨테이너 재시작
docker compose -f docker-compose.prod.yml restart

# 컨테이너 중지
docker compose -f docker-compose.prod.yml down

# 이미지 재빌드 후 실행
docker compose -f docker-compose.prod.yml up -d --build

# 사용하지 않는 이미지/볼륨 정리
docker system prune -a
```

## 업데이트 배포

```bash
cd ~/AI_02_06

# 최신 코드 가져오기
git pull origin main

# 이미지 재빌드 및 재시작
docker compose -f docker-compose.prod.yml up -d --build

# 로그 확인
docker compose -f docker-compose.prod.yml logs -f
```

## 문제 해결

### 메모리 부족
```bash
# 메모리 사용량 확인
free -h
docker stats

# 필요시 swap 추가 (t3.micro 권장)
sudo fallocate -l 1G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### 컨테이너가 계속 재시작될 때
```bash
# 로그 확인
docker compose -f docker-compose.prod.yml logs fastapi

# 컨테이너 상세 정보
docker inspect fastapi
```
