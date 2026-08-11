# 데이터베이스 접근 및 DBeaver 연동 가이드

EC2 및 로컬 Docker PostgreSQL에 접근하고 DBeaver로 연동하는 방법입니다.

---

## 배포 환경 정보

| 항목 | 값 |
|------|-----|
| EC2 IP | `52.78.62.12` |
| 도메인 | `ai-02-06.duckdns.org` |
| DB 컨테이너명 | `postgres` |
| DB 이름 | `doseph_db` |
| DB 사용자 | `doseph_admin` |

---

## 1. CLI로 DB 접근

### (로컬) 로컬 Docker DB 접속

```bash
# psql 클라이언트로 접속
docker exec -it postgres psql -U doseph_admin -d doseph_db

# 접속 후 프롬프트
doseph_db=#
```

### (EC2) EC2 Docker DB 접속

```bash
# 1. SSH로 EC2 접속 (로컬에서 실행)
ssh -i ./doseph-key.pem ubuntu@52.78.62.12

# 2. psql 클라이언트로 접속 (EC2에서 실행)
docker exec -it postgres psql -U doseph_admin -d doseph_db
```

---

## 2. 자주 쓰는 psql 명령어

### 기본 명령어

| 명령어 | 설명 |
|--------|------|
| `\dt` | 테이블 목록 |
| `\d {테이블명}` | 테이블 구조 |
| `\l` | 데이터베이스 목록 |
| `\du` | 사용자 목록 |
| `\q` | 종료 |
| `\x` | 확장 출력 모드 토글 |

### (로컬 또는 EC2 psql 내) 데이터 조회

```sql
-- 모든 테이블 목록
\dt

-- 계정 조회
SELECT * FROM accounts LIMIT 10;

-- 프로필 조회
SELECT * FROM profiles LIMIT 10;

-- 특정 이메일 계정 찾기
SELECT * FROM accounts WHERE email LIKE '%example%';

-- 특정 계정의 프로필 조회
SELECT * FROM profiles WHERE account_id = 'UUID값';

-- 삭제된 계정 조회
SELECT * FROM accounts WHERE is_active = false;
```

### (로컬 또는 EC2 psql 내) 데이터 수정

```sql
-- 계정 활성화 (soft delete 복구)
UPDATE accounts SET is_active = true, deleted_at = NULL WHERE email = 'user@example.com';

-- 프로필 이름 수정
UPDATE profiles SET name = '새이름' WHERE id = 'UUID값';

-- health_survey JSONB 필드 수정
UPDATE profiles
SET health_survey = '{"age": 30, "gender": "MALE"}'::jsonb
WHERE id = 'UUID값';
```

### (로컬 또는 EC2 psql 내) 데이터 삭제

```sql
-- 소프트 삭제 (권장)
UPDATE profiles SET deleted_at = NOW() WHERE id = 'UUID값';

-- 실제 삭제 (주의! 복구 불가)
DELETE FROM profiles WHERE id = 'UUID값';
```

---

## 3. DBeaver 연동

### DBeaver 설치

1. [DBeaver 다운로드](https://dbeaver.io/download/)
2. Community Edition 설치 (무료)

---

### 로컬 Docker DB 연결

#### (로컬 DBeaver) 연결 설정

1. **DBeaver 실행** -> **새 연결** (왼쪽 상단 플러그 아이콘)

2. **PostgreSQL** 선택

3. **Main 탭 - 연결 정보 입력**:

   | 항목 | 값 |
   |------|-----|
   | Host | `localhost` |
   | Port | `5432` |
   | Database | `doseph_db` |
   | Username | `doseph_admin` |
   | Password | `.env` 파일의 `DB_PASSWORD` 확인 |

4. **Test Connection** 클릭하여 연결 확인

5. **완료** 클릭

---

### EC2 Docker DB 연결 (SSH 터널)

EC2의 PostgreSQL은 외부 포트를 열지 않으므로 **SSH 터널**을 사용합니다.

#### (로컬 DBeaver) SSH 터널 연결 설정

1. **DBeaver 실행** -> **새 연결** -> **PostgreSQL**

2. **Main 탭 설정**:

   | 항목 | 값 |
   |------|-----|
   | Host | `localhost` |
   | Port | `5432` |
   | Database | `doseph_db` |
   | Username | `doseph_admin` |
   | Password | (아래 방법으로 확인) |

3. **SSH 탭 설정** (중요!):

   | 항목 | 값 |
   |------|-----|
   | Use SSH Tunnel | **체크** |
   | Host | `52.78.62.12` |
   | Port | `22` |
   | Username | `ubuntu` |
   | Authentication Method | `Public Key` |
   | Private Key | `.\doseph-key.pem` |

4. **Test Connection** -> **완료**

#### SSH 터널 연결 구조

```
[로컬 PC]                    [EC2]                    [Docker]
DBeaver  ──SSH 터널──>  52.78.62.12:22  ──>  postgres:5432
           (포트 포워딩)
```

---

## 4. EC2 DB 비밀번호 확인

EC2의 DB 비밀번호는 `.env` 파일에 있습니다.

### (EC2) 비밀번호 확인 방법

```bash
# EC2 접속 후 실행
cd ~/AI_02_06
grep DB_PASSWORD .env
```

---

## 5. 테이블 구조

### 주요 테이블

```
accounts          - 로그인 계정 (카카오 OAuth)
profiles          - 건강 프로필 (본인 + 피보호자)
medications       - 복용 약품 정보
intake_logs       - 복용 기록
challenges        - 건강 챌린지
chat_sessions     - AI 상담 세션
messages          - 채팅 메시지
refresh_tokens    - JWT 토큰 관리
```

### ERD 확인

프로젝트 내 ERD 파일: `docs/db_schema.dbml`

### (psql 내) 테이블 구조 확인

```sql
-- 특정 테이블 구조 보기
\d accounts
\d profiles
\d medications

-- 외래키 관계 확인
SELECT * FROM information_schema.table_constraints WHERE constraint_type = 'FOREIGN KEY';
```

---

## 6. 유용한 쿼리 모음

### (psql 내) 사용자 통계

```sql
-- 총 활성 계정 수
SELECT COUNT(*) FROM accounts WHERE is_active = true;

-- 프로필 타입별 수
SELECT relation_type, COUNT(*) FROM profiles GROUP BY relation_type;

-- 오늘 가입한 사용자
SELECT * FROM accounts WHERE created_at::date = CURRENT_DATE;

-- 최근 7일 가입자
SELECT * FROM accounts WHERE created_at > NOW() - INTERVAL '7 days';
```

### (psql 내) 데이터 정합성 확인

```sql
-- 프로필 없는 활성 계정 찾기
SELECT * FROM accounts a
WHERE a.is_active = true
AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.account_id = a.id);

-- 삭제된 계정의 프로필 찾기
SELECT * FROM profiles p
WHERE EXISTS (
    SELECT 1 FROM accounts a
    WHERE a.id = p.account_id AND a.is_active = false
);
```

### (psql 내) 성능 분석

```sql
-- 테이블별 행 수
SELECT schemaname, relname, n_live_tup
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC;

-- 인덱스 사용 현황
SELECT * FROM pg_stat_user_indexes ORDER BY idx_scan DESC;
```

---

## 7. 백업 및 복원

### (로컬) 로컬 DB 백업

```bash
# 전체 백업
docker exec postgres pg_dump -U doseph_admin -d doseph_db > backup_$(date +%Y%m%d).sql

# 특정 테이블만 백업
docker exec postgres pg_dump -U doseph_admin -d doseph_db -t accounts -t profiles > accounts_profiles.sql
```

### (EC2) EC2 DB 백업

```bash
docker exec postgres pg_dump -U doseph_admin -d doseph_db --encoding=UTF8 > ~/backup_$(date +%Y%m%d).sql
```

### (로컬) 복원

```bash
docker exec -i postgres psql -U doseph_admin -d doseph_db < backup_20240415.sql
```

---

## 8. 문제 해결

### 연결 거부 오류

#### (로컬)

```bash
# Docker 컨테이너 상태 확인
docker ps | grep postgres

# 컨테이너 재시작
docker compose restart postgres
```

### 인증 실패

#### (로컬)

```bash
# 비밀번호 확인
cat .env | grep DB_PASSWORD

# Docker 환경변수 확인
docker exec postgres printenv | grep POSTGRES
```

### DBeaver SSH 터널 오류

1. `.pem` 파일 경로가 올바른지 확인 (`doseph-key.pem`)
2. `.pem` 파일 권한 확인 (읽기 전용)
3. EC2 보안 그룹에서 22번 포트 허용 확인

#### (로컬 PowerShell) .pem 권한 설정

```powershell
icacls ".\doseph-key.pem" /inheritance:r /grant:r "$($env:USERNAME):R"
```

### 쿼리 타임아웃

#### (psql 내)

```sql
-- 타임아웃 설정 (밀리초)
SET statement_timeout = '30000';

-- 실행 중인 쿼리 확인
SELECT * FROM pg_stat_activity WHERE state != 'idle';

-- 쿼리 강제 종료
SELECT pg_cancel_backend({pid});
```

---

## 빠른 참조

### (로컬) CLI 접속
```bash
docker exec -it postgres psql -U doseph_admin -d doseph_db
```

### (EC2) CLI 접속
```bash
# 1. SSH 접속
ssh -i ./doseph-key.pem ubuntu@52.78.62.12

# 2. psql 접속
docker exec -it postgres psql -U doseph_admin -d doseph_db
```

### DBeaver 로컬 연결
```
Host: localhost
Port: 5432
Database: doseph_db
Username: doseph_admin
Password: .env 파일의 DB_PASSWORD 확인
```

### DBeaver EC2 연결 (SSH 터널)
```
[Main 탭]
Host: localhost
Port: 5432
Database: doseph_db
Username: doseph_admin
Password: (EC2 .env에서 확인)

[SSH 탭]
Use SSH Tunnel: 체크
Host: 52.78.62.12
Port: 22
Username: ubuntu
Private Key: doseph-key.pem 경로
```
