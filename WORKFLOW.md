# Doseph 개발 워크플로우 가이드

> **새로 합류한 팀원을 위한 핵심 안내서**
>
> 이 문서는 우리 팀의 개발 철학과 협업 프로세스를 정리한 가이드입니다.
> "Tidy First + TDD" 방법론과 "안전한 환경 분리"를 통해 품질 높은 코드를 효율적으로 배포합니다.

---

## 목차

1. [개발 철학: Tidy First + TDD](#1-개발-철학-tidy-first--tdd)
2. [협업 및 배포 워크플로우 (4단계)](#2-협업-및-배포-워크플로우-4단계)
3. [환경 설정 가이드](#3-환경-설정-가이드)
4. [커밋 전 체크리스트](#4-커밋-전-체크리스트)
5. [PR 체크리스트](#5-pr-체크리스트)

---

## 1. 개발 철학: Tidy First + TDD

### 1.1 Tidy First (정리 먼저)

> **비유**: 요리하기 전에 주방을 정리하는 것과 같습니다.
> 깔끔한 환경에서 작업하면 실수가 줄고 효율이 올라갑니다.

새로운 기능을 추가하기 **전에**, 먼저 코드 구조를 다듬습니다.

**핵심 원칙**:
- 동작 변경 없이 코드 구조만 개선 (리팩토링)
- 불필요한 import 제거 및 정리
- 함수/변수 이름 명확하게 수정
- 인지 부하를 최소화하여 팀원이 코드를 쉽게 이해할 수 있도록

**예시**:
```python
# Before: 혼란스러운 코드
from app.models.users import User
from app.services.auth import AuthService
import random  # 사용하지 않는 import
from app.repositories.user import UserRepository

# After: Tidy First 적용
from app.models.users import User
from app.repositories.user import UserRepository
from app.services.auth import AuthService
```

### 1.2 TDD (Test-Driven Development)

> **비유**: 목적지를 먼저 정하고 운전하는 것과 같습니다.
> 테스트가 곧 명세서이자 목표입니다.

**Red-Green-Refactor 사이클**:

| 단계 | 설명 | 행동 |
|------|------|------|
| **Red** | 실패하는 테스트 작성 | 원하는 기능의 테스트 코드를 먼저 작성 |
| **Green** | 최소한의 코드로 통과 | 테스트를 통과할 수 있는 가장 간단한 코드 작성 |
| **Refactor** | 코드 개선 | 테스트를 유지하면서 코드 품질 향상 |

**예시**:
```python
# 1. Red: 실패하는 테스트 작성
def test_calculate_total_price():
    assert calculate_total_price([100, 200, 300]) == 600

# 2. Green: 최소한의 구현
def calculate_total_price(prices):
    return sum(prices)

# 3. Refactor: 필요시 개선 (이 경우 이미 충분히 간결)
```

### 1.3 린트 검사 (Ruff)

> **Why?** 일관된 코드 스타일은 팀 협업의 기본입니다.
> 기계가 잡아줄 수 있는 실수는 기계에게 맡기세요.

**커밋 전 필수 실행**:
```bash
uv run ruff check --fix app
```

**주요 검사 항목**:
- `B904`: raise문에서 from 누락
- `W291`: 줄 끝 공백
- `UP047`: 불필요한 타입 주석

---

## 2. 협업 및 배포 워크플로우 (4단계)

```
+----------+      +--------+      +-----------+      +----------+
|  Local   | ---> |   PR   | ---> |    Dev    | ---> |   Prod   |
|  (개인)   |      | (공유)  |      | (통합테스트) |      | (운영)    |
+----------+      +--------+      +-----------+      +----------+
```

### 2.1 1단계: Local (로컬 환경) - 나만의 실험실

> **Why?** 다른 팀원에게 영향을 주지 않고 자유롭게 실험할 수 있습니다.
> 실패해도 괜찮은 안전한 공간입니다.

**작업 내용**:
- 개별 `feature/` 브랜치에서 작업
- Mock 데이터 또는 로컬 DB 사용
- `localhost`에서 완벽히 동작할 때까지 개발

**환경 설정**:
```bash
# .env
ENV=local
```

**브랜치 네이밍**:
```
feature/기능명      # 새 기능 (예: feature/medication-reminder)
fix/버그명         # 버그 수정 (예: fix/login-redirect)
refactor/대상명    # 리팩토링 (예: refactor/auth-service)
```

### 2.2 2단계: PR (Pull Request) - 최초 공유

> **Why?** 코드 리뷰를 통해 버그를 사전에 발견하고,
> 팀원 간 지식을 공유하며, 코드 품질을 높입니다.

**작업 내용**:
- 로컬 테스트와 린트 완료 후 GitHub에 Push
- PR 생성 및 리뷰어 지정
- 팀원들의 코드 리뷰 후 Approve

**PR 생성 시 포함 사항**:
- 변경 사항 요약
- 테스트 방법 안내
- 관련 이슈 번호 연결

### 2.3 3단계: Dev 서버 (개발/테스트 환경) - 통합 테스트

> **Why?** 로컬에서는 발견하기 어려운 통합 이슈
> (CORS, 환경변수, 서버 간 통신 등)를 검증합니다.

**작업 내용**:
- PR 병합(Merge) 시 CI/CD를 통해 자동 배포
- 프론트엔드/백엔드 연동 테스트
- CORS 에러, API 응답 형식 검증
- 팀원 전체가 함께 QA 진행

**환경 설정**:
```bash
# .env
ENV=dev
```

**검증 체크리스트**:
- [ ] 프론트엔드에서 백엔드 API 호출 정상 동작
- [ ] CORS 에러 없음
- [ ] 환경변수 정상 적용
- [ ] 모든 주요 사용자 시나리오 테스트 완료

### 2.4 4단계: Prod 서버 (운영 환경) - 실제 배포

> **Why?** 실제 사용자가 사용하는 환경입니다.
> Dev에서 충분히 검증된 코드만 배포하여 안정성을 보장합니다.

**작업 내용**:
- Dev 환경에서 문제 없음 확인 후 배포
- 릴리즈 태그 생성
- 실 사용자 모니터링

**환경 설정**:
```bash
# .env
ENV=prod
```

**배포 전 최종 확인**:
- [ ] Dev 환경에서 모든 테스트 통과
- [ ] 팀원 전체 승인
- [ ] 롤백 계획 수립

---

## 3. 환경 설정 가이드

### 3.1 환경별 자동 URL 설정

`ENV` 값만 변경하면 모든 URL이 자동으로 설정됩니다.

| 환경 | ENV 값 | API URL | Frontend URL |
|------|--------|---------|--------------|
| Local | `local` | `http://localhost:8000` | `http://localhost:3000` |
| Dev | `dev` | `https://dev-api.doseph.app` | `https://dev.doseph.app` |
| Prod | `prod` | `https://api.doseph.app` | `https://doseph.app` |

### 3.2 백엔드 (.env)

```bash
# 환경 선택 (local / dev / prod)
ENV=local

# 필수 입력 (민감 정보)
SECRET_KEY=your-secret-key
DB_PASSWORD=your-db-password
KAKAO_CLIENT_ID=your-kakao-client-id
KAKAO_CLIENT_SECRET=your-kakao-client-secret
```

### 3.3 프론트엔드 (.env.local)

```bash
# 환경 선택 (local / dev / prod)
NEXT_PUBLIC_ENV=local

# Kakao OAuth
NEXT_PUBLIC_KAKAO_CLIENT_ID=your-kakao-client-id
```

---

## 4. 커밋 전 체크리스트

모든 커밋 전에 아래 항목을 확인하세요.

### 코드 품질

- [ ] Tidy First 적용: 불필요한 import 제거, 코드 정리
- [ ] 모든 테스트 통과: `uv run pytest`
- [ ] 린트 검사 통과: `uv run ruff check --fix app`
- [ ] 타입 힌트 추가 (백엔드)
- [ ] JSDoc 주석 필요시 추가 (프론트엔드)

### 보안

- [ ] `.env` 파일이 커밋에 포함되지 않았는지 확인
- [ ] 하드코딩된 비밀번호/API 키 없음
- [ ] SQL Injection 취약점 없음 (파라미터 바인딩 사용)

### 문서화

- [ ] 새로운 기능의 경우 관련 문서 업데이트
- [ ] API 변경 시 API 명세서 업데이트

---

## 5. PR 체크리스트

PR 생성 전 아래 항목을 확인하세요.

### 기본 확인

- [ ] 브랜치 이름이 컨벤션을 따르는가? (`feature/`, `fix/`, `refactor/`)
- [ ] 커밋 메시지가 명확한가?
- [ ] PR 제목이 변경 내용을 잘 설명하는가?
- [ ] 관련 이슈가 연결되어 있는가?

### 테스트

- [ ] 로컬에서 모든 테스트 통과
- [ ] 새로운 기능에 대한 테스트 코드 작성
- [ ] 수동 테스트 완료 (주요 시나리오)

### 코드 리뷰 요청

- [ ] 적절한 리뷰어 지정
- [ ] PR 설명에 테스트 방법 안내

---

## 부록: 빠른 참조

### 자주 사용하는 명령어

```bash
# 백엔드
uv run ruff check --fix app      # 린트 검사 및 자동 수정
uv run pytest                     # 테스트 실행
uv run uvicorn app.main:app --reload  # 개발 서버 실행

# 프론트엔드
npm run dev                       # 개발 서버 실행
npm run build                     # 빌드
npm run lint                      # 린트 검사
```

### Git 명령어

```bash
# 브랜치 생성 및 이동
git checkout -b feature/new-feature

# 변경사항 확인
git status
git diff

# 커밋
git add .
git commit -m "feat: 새로운 기능 추가"

# Push 및 PR
git push origin feature/new-feature
```

---

**문의사항이 있다면 팀 Slack 채널에서 언제든 질문하세요!**
