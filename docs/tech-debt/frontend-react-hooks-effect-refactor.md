# [TECH DEBT] 프론트엔드 react-hooks effect 리팩터

> 🗓️ 등록: 2026-08-14 (Phase 1 정적 export 작업 중 발견)
> 📌 상태: **미처리 (deferred)** — eslint 규칙을 error→warn 으로 강등해 임시 무마한 상태
> 🎯 목표: 아래 22개 위치의 React Compiler 지향 규칙 위반을 실제로 해소하고, 강등한 규칙을 다시 error 로 복구

---

## 배경

`eslint-config-next 16`(React 19)이 새로 끌어온 **React Compiler 지향 preview 규칙**
(`react-hooks/set-state-in-effect`, `react-hooks/immutability`)이 기존 코드베이스 전반의 관용 패턴
(mount 가드, 파생상태 동기화, URL 파라미터 처리 등)을 error 로 잡았다.

Phase 1(정적 export) 범위와 무관한 **광범위 상태관리 리팩터**이며 behavior 회귀 위험이 커서,
당장은 `medication-frontend/eslint.config.mjs` 에서 두 규칙을 **`warn` 으로 강등**(에러 0 확보)하고
실제 수정은 이 문서로 이관했다.

## 처리 조건 (반드시)

1. **별도 커밋/작업 단위** — Phase 1 기능과 절대 섞지 않는다(§5.2 refactor/feature 분리).
2. **런타임 검증 필수** — docker 백엔드 기동 + `e2e/` Playwright 스모크로 회귀 없음 확인.
3. 완료 후 `eslint.config.mjs` 의 강등 override 제거 → 두 규칙을 **error 로 복구**하고 `npm run lint` 0 에러 유지.

## 대상 목록 (22건, 2026-08-14 기준 라인)

### `react-hooks/set-state-in-effect` (21)

| 파일 | 라인 | 패턴 힌트 | 권장 방향 |
|---|---|---|---|
| `src/app/lifestyle-guide/page.jsx` | 263, 269, 275, 302 | effect 내 상태 동기화 | render-time 파생 / 이벤트 핸들러 이동 |
| `src/app/main/page.jsx` | 188, 238 | 데이터 로드 후 setState | 파생값 계산 / functional update |
| `src/app/medication/group/page.jsx` | 171, 270 | fetch 결과·선택 초기화 | 조건 가드 유지 시 근거 명시 |
| `src/app/medication/page.jsx` | 185 | 진입 시 refetch | 이벤트 기반 트리거 검토 |
| `src/app/mypage/page.jsx` | 260 | `?tab=family` → setActiveMenu | 초기 상태 계산으로 이동 |
| `components/AuthGuard.jsx` | 18 | 인증 상태 초기화 | useSyncExternalStore 검토 |
| `components/chat/ChatModal.jsx` | 130, 138, 153, 166 | 세션/스크롤 동기화 | ref·이벤트 핸들러 분리 |
| `components/medication/MedicineNameAutocomplete.jsx` | 52 | 입력 파생 상태 | render-time 파생 |
| `components/medication/TimeSlotPicker.jsx` | 32 | props→state 동기화 | 파생값 / key 리셋 |
| `components/medication/TodaySchedule.jsx` | 66 | 파생 스케줄 계산 | useMemo 파생 |
| `components/ui/ThemeToggle.jsx` | 14 | mount 가드 + 테마 초기화 | **useSyncExternalStore** (정석) |
| `contexts/ChatSessionContext.jsx` | 39 | 세션 초기화 | 초기 상태 lazy init |
| `contexts/ProfileContext.jsx` | 78 | profiles 비면 선택 리셋 | 파생 검증 / 이벤트에서 처리 |

### `react-hooks/immutability` (1)

| 파일 | 라인 | 힌트 |
|---|---|---|
| `src/app/mypage/page.jsx` | 250 | effect 가 뒤에 선언된 `fetchData` 클로저 호출 — 선언 순서/의존성 재구성 필요 |

> 라인 번호는 이후 편집으로 이동할 수 있으니, `npm run lint` 결과로 최신 위치를 재확인할 것.
