# PLAN: OCR 이미지 전처리 + DB 후처리 개선

## 개요

OCR 파이프라인의 정확도와 안정성을 높이기 위해 두 가지 독립적인 개선을 수행합니다.

- **Feature A (전처리)**: Clova OCR 호출 전 이미지 품질을 향상시켜 인식률을 높입니다.
- **Feature B (후처리)**: DB 저장을 트랜잭션으로 묶고, UPSERT 패턴 및 pg_trgm 인덱스를 도입합니다.

---

## 현재 파이프라인 (As-Is)

```mermaid
flowchart TD
    A[클라이언트 이미지 업로드] --> B[파일 저장]
    B --> C[Clova OCR 호출 - 원본 이미지]
    C --> D[LLM Structured Outputs]
    D --> E[Redis setex - 10분 TTL]
    E --> F[클라이언트 확인]
    F --> G[Redis atomic delete]
    G --> H{삭제 성공?}
    H -- No --> I[409 Conflict]
    H -- Yes --> J[Medication.create 루프 - 트랜잭션 없음]
    J --> K[BackgroundTasks]
```

**문제점**

| 구분 | 현상 | 위험도 |
|---|---|---|
| 전처리 없음 | 저화질 이미지에서 OCR 오인식 발생 | 중 |
| 트랜잭션 없음 | 중간 실패 시 일부만 저장되는 partial write | 높음 |
| UPSERT 없음 | 동일 처방전 재등록 시 중복 레코드 생성 | 높음 |
| medicine_name 인덱스 없음 | 약품명 검색 시 full scan | 중 |
| traceback 노출 | 500 에러 시 서버 내부 정보가 클라이언트에 노출 | 높음 |

---

## 목표 파이프라인 (To-Be)

```mermaid
flowchart TD
    A[클라이언트 이미지 업로드] --> B[파일 저장]
    B --> C[ImagePreprocessor.enhance]
    C --> |성공| D[전처리 이미지]
    C --> |실패 fallback| E[원본 이미지]
    D --> F[Clova OCR 호출]
    E --> F
    F --> G[LLM Structured Outputs]
    G --> H[Redis setex - 10분 TTL]
    H --> I[클라이언트 확인]
    I --> J[Redis atomic delete]
    J --> K{삭제 성공?}
    K -- No --> L[409 Conflict]
    K -- Yes --> M[in_transaction 시작]
    M --> N[UPSERT 루프]
    N --> O[커밋]
    O --> P[BackgroundTasks]
    O --> |실패| Q[롤백 + 500]
```

---

## Feature A: 이미지 전처리 (ImagePreprocessor)

### 신규 파일: `app/services/image_preprocessor.py`

**전처리 파이프라인 (순서 고정)**

```mermaid
flowchart LR
    RAW[원본 이미지] --> GRAY[Grayscale 변환]
    GRAY --> BLUR[GaussianBlur 노이즈 제거]
    BLUR --> CLAHE[CLAHE 대비 향상]
    CLAHE --> THRESH[Adaptive Threshold 이진화]
    THRESH --> DESKEW[Deskew 기울기 보정]
    DESKEW --> OUT[전처리 완료 이미지]
```

**설계 원칙**
- `ImagePreprocessor` 클래스: SRP, 각 단계가 독립 메서드
- 전처리 실패 시 원본 이미지로 fallback (OCR 자체를 막지 않음)
- 임시 파일 생성 후 Clova OCR 전달, 완료 후 삭제
- 의존성: `opencv-python-headless`, `pillow` (이미 requirements에 포함 여부 확인 필요)

**인터페이스**

```python
class ImagePreprocessor:
    async def enhance(self, image_path: str) -> str:
        """전처리된 임시 이미지 경로 반환. 실패 시 원본 경로 반환."""
        ...

    def _to_grayscale(self, img: np.ndarray) -> np.ndarray: ...
    def _denoise(self, img: np.ndarray) -> np.ndarray: ...
    def _enhance_contrast(self, img: np.ndarray) -> np.ndarray: ...
    def _binarize(self, img: np.ndarray) -> np.ndarray: ...
    def _deskew(self, img: np.ndarray) -> np.ndarray: ...
```

**ocr_service.py 변경 범위 (Feature A)**
- `extract_and_parse_image()`: Clova OCR 호출 직전에 `ImagePreprocessor.enhance()` 삽입
- 변경 라인 수: ~5줄

---

## Feature B: DB 후처리 개선

### B-1. 트랜잭션 적용 (`ocr_service.py`)

```python
# Before (line 176-196)
for med_data in confirmed_medicines:
    await Medication.create(...)

# After
async with in_transaction():
    for med_data in confirmed_medicines:
        await Medication.get_or_create(
            profile_id=profile_id,
            medicine_name=med_data.medicine_name,
            dispensed_date=med_data.dispensed_date,
            defaults={...}
        )
```

**UPSERT 키**: `(profile_id, medicine_name, dispensed_date)`
- 동일 처방전 재등록 시 기존 레코드 업데이트 (중복 방지)
- `dispensed_date`가 null인 경우 처리 필요 (null은 unique key에서 제외)

### B-2. pg_trgm 마이그레이션

**신규 마이그레이션 파일**: `migrations/models/XXX_add_medicine_name_trgm_index.py`

```sql
-- Up
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX CONCURRENTLY idx_medication_medicine_name_trgm
    ON medication USING gin (medicine_name gin_trgm_ops);

-- Down
DROP INDEX IF EXISTS idx_medication_medicine_name_trgm;
```

### B-3. traceback 노출 제거 (`ocr_routers.py`)

```python
# Before (현재 코드)
except Exception as e:
    return JSONResponse(
        status_code=500,
        content={"detail": str(e), "traceback": traceback.format_exc()}
    )

# After
except Exception:
    logger.exception("OCR confirm 처리 중 예기치 않은 오류")
    raise HTTPException(status_code=500, detail="처리 중 오류가 발생했습니다.")
```

---

## 개발 순서 (3-Step Cycle)

### Feature A 개발 순서

| 단계 | 작업 |
|---|---|
| Tidy | `ocr_service.py` import 정리, 함수 길이 점검 |
| Test (Red) | `test_image_preprocessor.py`: enhance 성공 케이스 + fallback 케이스 |
| Implement (Green) | `image_preprocessor.py` 구현 + `ocr_service.py` 연동 |

### Feature B 개발 순서

| 단계 | 작업 |
|---|---|
| Tidy | `confirm_and_save()` 함수 분리 (현재 한 함수에 너무 많은 책임) |
| Test (Red) | `test_ocr_service.py`: 트랜잭션 롤백 케이스, UPSERT 중복 케이스 |
| Implement (Green) | `in_transaction()` 적용, UPSERT 패턴 적용, 마이그레이션 추가 |

---

## 체크리스트

### Feature A
- [ ] `opencv-python-headless`, `pillow` requirements 확인
- [ ] `ImagePreprocessor` 클래스 구현
- [ ] `enhance()` fallback 동작 테스트
- [ ] `ocr_service.py` 연동 (5줄 내외)

### Feature B
- [ ] `confirm_and_save()` Tidy (단일 책임 분리)
- [ ] `in_transaction()` 적용
- [ ] UPSERT 키 설계 (`dispensed_date` null 처리)
- [ ] pg_trgm 마이그레이션 작성
- [ ] traceback 노출 제거 + `logger.exception()` 적용
- [ ] `medication.py` 모델에 인덱스 추가

---

## 영향 범위

| 파일 | 변경 유형 |
|---|---|
| `app/services/image_preprocessor.py` | 신규 생성 |
| `app/services/ocr_service.py` | 수정 (전처리 연동 + 트랜잭션 + UPSERT) |
| `app/apis/v1/ocr_routers.py` | 수정 (traceback 제거) |
| `app/models/medication.py` | 수정 (인덱스 추가) |
| `migrations/models/XXX_add_trgm.py` | 신규 생성 |
| `tests/test_image_preprocessor.py` | 신규 생성 |
| `tests/test_ocr_service.py` | 수정 (트랜잭션/UPSERT 테스트 추가) |

---

*`go` 명령어를 입력하시면 Feature A Tidy 단계부터 시작합니다.*

---

## 핵심 프로세스 플로우차트

### OCR 전체 흐름

```mermaid
flowchart TD
    A[처방전 사진 찍기] --> B{사진이 정상인가?}
    B -- 이상한 파일 --> C[다시 업로드 해주세요]
    B -- 정상 --> D[사진 보관함에 저장]
    D --> E[사진 화질 개선]
    E --> F[사진에서 글자 읽기]
    F --> G{글자 읽기 성공?}
    G -- 실패 --> H[지금 서비스가 바빠요.<br/>잠시 후 다시 시도해주세요]
    G -- 성공 --> I[약 이름 찾기]
    I --> J{약 이름 찾았나?}
    J -- 실패 --> K[사진이 흐려요.<br/>더 선명하게 찍어주세요]
    J -- 성공 --> L[사용자 확인 화면]
    L --> M[AI가 복약 안내 만들기]
    M --> N{AI 응답 성공?}
    N -- 실패 --> O{재시도 3회}
    O -- 최종 실패 --> P[AI가 지금 바빠요.<br/>잠시 후 다시 시도해주세요]
    O -- 성공 --> Q[저장 완료]
    N -- 성공 --> Q
```

---

### 챗봇 대화 흐름

```mermaid
flowchart TD
    A[사용자 메시지] --> B{어떤 종류의 질문인가?}
    B -- 욕설 또는 의미없는 말 --> C[정중한 안내 메시지 반환]
    B -- 날씨 등 약과 무관한 질문 --> D[약 관련 질문만 답할 수 있어요]
    B -- 약 관련 질문 --> E[질문의 의미를 숫자로 바꾸기]
    E --> F[약품 정보 창고에서 비슷한 정보 찾기]
    F --> G{관련 정보 찾았나?}
    G -- 없음 --> H[해당 약품 정보가 없어요]
    G -- 있음 --> I[찾은 정보 + 대화 내용을 AI에게 전달]
    I --> J{AI 응답 성공?}
    J -- 실패 --> K{재시도 3회}
    K -- 최종 실패 --> L[AI가 지금 바빠요.<br/>잠시 후 다시 시도해주세요]
    K -- 성공 --> M[답변 저장 및 반환]
    J -- 성공 --> M
```
