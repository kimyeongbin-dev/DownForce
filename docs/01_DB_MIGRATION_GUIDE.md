# EC2 DB -> 로컬 DB 마이그레이션 가이드

EC2 운영 환경의 PostgreSQL 데이터를 로컬 개발 환경으로 복사하는 방법입니다.

---

## 배포 환경 정보

| 항목 | 값 |
|------|-----|
| EC2 IP | `52.78.62.12` |
| 도메인 | `ai-02-06.duckdns.org` (DuckDNS 무료 도메인) |
| SSH 포트 | 22 |
| HTTPS | Let's Encrypt SSL 인증서 |

---

## 사전 준비

### 필요한 것
- `doseph-key.pem` 파일 (EC2 SSH 접속용 키)
- Docker Desktop 실행 중
- 로컬 Docker DB 컨테이너 실행 중

### .pem 파일 위치
팀 공유 드라이브 또는 Slack에서 `doseph-key.pem` 파일을 받아 **프로젝트 루트**에 저장합니다.

```
위치: 프로젝트루트/doseph-key.pem (gitignore 처리됨)
```

---

## 1단계: EC2 접속

### (로컬 PowerShell) Windows에서 EC2 접속

```powershell
# .pem 파일 권한 설정 (최초 1회)
icacls ".\doseph-key.pem" /inheritance:r /grant:r "$($env:USERNAME):R"

# SSH 접속
ssh -i ".\doseph-key.pem" ubuntu@52.78.62.12
```

### (로컬 Mac/Linux) Mac 또는 Linux에서 EC2 접속

```bash
# .pem 파일 권한 설정 (최초 1회)
chmod 400 ./doseph-key.pem

# SSH 접속
ssh -i ./doseph-key.pem ubuntu@52.78.62.12
```

### 접속 확인
```bash
# EC2에 접속되면 아래와 같이 표시됨
ubuntu@ip-172-31-xxx-xxx:~$
```

---

## 2단계: EC2에서 DB 덤프 생성

### (EC2) PostgreSQL 덤프 생성

```bash
# 프로젝트 폴더로 이동
cd ~/AI_02_06

# PostgreSQL 컨테이너에서 덤프 생성
docker exec postgres pg_dump -U doseph_admin -d doseph_db --encoding=UTF8 > ~/db_dump.sql

# 덤프 파일 확인
ls -lh ~/db_dump.sql
head -20 ~/db_dump.sql  # 내용 미리보기

# 인코딩 확인 (UTF-8이어야 함)
file ~/db_dump.sql
```

**예상 출력:**
```
-rw-rw-r-- 1 ubuntu ubuntu 156K Apr 15 10:30 /home/ubuntu/db_dump.sql
db_dump.sql: UTF-8 Unicode text
```

---

## 3단계: 덤프 파일 로컬로 복사

**새 터미널을 열고** (EC2 접속 종료하지 않고) 로컬에서 실행합니다.

### (로컬 PowerShell) Windows에서 파일 복사

```powershell
# 프로젝트 폴더로 이동
cd E:\Project\Team_Project\OZ-Final\AH_02_06

# SCP로 파일 복사
scp -i ".\doseph-key.pem" ubuntu@52.78.62.12:~/db_dump.sql ./db_dump.sql

# 복사 확인
Get-Item .\db_dump.sql
```

### (로컬 Mac/Linux) Mac 또는 Linux에서 파일 복사

```bash
# 프로젝트 폴더로 이동
cd ~/path/to/AH_02_06

# SCP로 파일 복사
scp -i ./doseph-key.pem ubuntu@52.78.62.12:~/db_dump.sql ./db_dump.sql

# 복사 확인
ls -lh db_dump.sql
```

---

## 4단계: 로컬 Docker DB 준비

### (로컬 PowerShell / Mac / Linux) Docker 컨테이너 확인

```bash
# 컨테이너 상태 확인
docker compose ps

# postgres 컨테이너가 없으면 실행
docker compose up -d postgres
```

### (로컬) 기존 데이터 백업 (선택)

기존 로컬 데이터를 보존하려면:

```bash
docker exec postgres pg_dump -U doseph_admin -d doseph_db > local_backup.sql
```

---

## 5단계: 로컬 DB에 덤프 적용

### (로컬 PowerShell / Mac / Linux) 방법 A: 기존 DB 삭제 후 새로 적용 (권장)

```bash
# 1. 기존 연결 종료 및 DB 재생성
docker exec -it postgres psql -U doseph_admin -d postgres -c "
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'doseph_db' AND pid <> pg_backend_pid();
"
docker exec -it postgres psql -U doseph_admin -d postgres -c "DROP DATABASE IF EXISTS doseph_db;"
docker exec -it postgres psql -U doseph_admin -d postgres -c "CREATE DATABASE doseph_db OWNER doseph_admin;"

# 2. 덤프 적용
docker exec -i postgres psql -U doseph_admin -d doseph_db < db_dump.sql

# 3. 적용 확인
docker exec -it postgres psql -U doseph_admin -d doseph_db -c "\dt"
```

### (로컬) 방법 B: 기존 데이터 유지하며 추가 (주의: 충돌 가능)

```bash
docker exec -i postgres psql -U doseph_admin -d doseph_db < db_dump.sql
```

---

## 6단계: 마이그레이션 확인

### (로컬 PowerShell / Mac / Linux) 데이터 확인

```bash
# 테이블 목록 확인
docker exec -it postgres psql -U doseph_admin -d doseph_db -c "\dt"

# 계정 데이터 확인
docker exec -it postgres psql -U doseph_admin -d doseph_db -c "SELECT * FROM accounts LIMIT 5;"

# 프로필 데이터 확인
docker exec -it postgres psql -U doseph_admin -d doseph_db -c "SELECT * FROM profiles LIMIT 5;"
```

---

## 7단계: 정리

### (로컬) 덤프 파일 삭제

```bash
rm db_dump.sql
```

### (EC2) 덤프 파일 삭제

```bash
rm ~/db_dump.sql
```

---

## 문제 해결

### 인코딩 오류 (한글 깨짐)

#### (EC2) 덤프 시 인코딩 명시

```bash
docker exec postgres pg_dump -U doseph_admin -d doseph_db --encoding=UTF8 > ~/db_dump.sql
```

#### (로컬) 적용 시 인코딩 설정

```bash
docker exec -i postgres psql -U doseph_admin -d doseph_db -c "SET client_encoding TO 'UTF8';" < db_dump.sql
```

### Permission Denied (Windows .pem 파일)

#### (로컬 PowerShell)

```powershell
# 파일 속성에서 읽기 전용으로 설정
icacls "C:\path\to\doseph-key.pem" /inheritance:r /grant:r "$($env:USERNAME):R"
```

### 연결 거부 오류

#### (로컬)

```bash
# Docker 컨테이너 상태 확인
docker compose ps

# postgres 재시작
docker compose restart postgres
```

### Foreign Key 제약 조건 오류

테이블 간 의존성 때문에 순서 문제가 발생할 수 있습니다:

#### (로컬)

```bash
# FK 제약 조건 무시하고 적용
docker exec -i postgres psql -U doseph_admin -d doseph_db -c "SET session_replication_role = 'replica';" < db_dump.sql
docker exec -i postgres psql -U doseph_admin -d doseph_db -c "SET session_replication_role = 'origin';"
```

---

## 빠른 참조 (전체 과정 요약)

### (로컬 Mac/Linux) EC2 접속

```bash
ssh -i ./doseph-key.pem ubuntu@52.78.62.12
```

### (EC2) 덤프 생성

```bash
docker exec postgres pg_dump -U doseph_admin -d doseph_db --encoding=UTF8 > ~/db_dump.sql
```

### (로컬 Mac/Linux - 새 터미널) 파일 복사

```bash
scp -i ./doseph-key.pem ubuntu@52.78.62.12:~/db_dump.sql ./db_dump.sql
```

### (로컬) DB 초기화 후 적용

```bash
docker exec -it postgres psql -U doseph_admin -d postgres -c "DROP DATABASE IF EXISTS doseph_db; CREATE DATABASE doseph_db OWNER doseph_admin;"
docker exec -i postgres psql -U doseph_admin -d doseph_db < db_dump.sql
```
