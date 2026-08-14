// ── 호출부 네비게이션 계약 (Red-first, 데이터 의존) ─────────────────
// 흐름: 실제 클릭 상호작용이 "전환 후 쿼리 라우트"로 이동하는지 검증한다.
//       처방전 카드 클릭 -> /medication/group?group_id=  (구: /medication/groups/{id})
//       약품 항목 클릭   -> /medication/detail?id=        (구: /medication/{id})
// 전제: docker fastapi(:8000) 기동 + 개발자 계정에 처방전 1건 이상.
//       데이터가 없으면 단언 대신 skip(사유 명시)한다.
// 선택자: Step 3 구현에서 아래 data-testid 를 부여한다(테스트가 먼저 참조하는 인터페이스).
//   - 처방전 카드:  data-testid="prescription-card"
//   - 약품 항목:    data-testid="medication-item"

import { test, expect } from '@playwright/test'

test.describe('처방전 카드 -> 그룹 상세 쿼리 라우트', () => {
  test('카드 클릭 시 /medication/group?group_id= 로 이동', async ({ page }) => {
    await page.goto('/medication')
    await page.waitForLoadState('networkidle')

    const cards = page.getByTestId('prescription-card')
    const count = await cards.count()
    test.skip(count === 0, '처방전 데이터가 없어 네비게이션 계약을 검증할 수 없음(개발자 계정에 처방전 등록 필요)')

    await cards.first().click()
    await page.waitForURL(/\/medication\/group\?group_id=/, { timeout: 10_000 })
    expect(new URL(page.url()).searchParams.get('group_id')).toBeTruthy()
  })
})

test.describe('약품 항목 -> 약품 상세 쿼리 라우트 (모바일 뷰포트)', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('약품 클릭 시 /medication/detail?id= 로 이동', async ({ page }) => {
    // 카드 -> 그룹 상세 진입
    await page.goto('/medication')
    await page.waitForLoadState('networkidle')
    const cards = page.getByTestId('prescription-card')
    test.skip((await cards.count()) === 0, '처방전 데이터가 없어 약품 상세 이동을 검증할 수 없음')

    await cards.first().click()
    await page.waitForURL(/\/medication\/group\?group_id=/, { timeout: 10_000 })

    // 그룹 상세 fetch 가 끝나 약품 목록이 렌더될 때까지 대기 후 판정
    await page.waitForLoadState('networkidle')
    const medItems = page.getByTestId('medication-item')
    await medItems.first().waitFor({ state: 'visible', timeout: 8_000 }).catch(() => {})
    test.skip((await medItems.count()) === 0, '이 처방전에 클릭 가능한 약품 항목이 없어 검증 skip')

    await medItems.first().click()
    await page.waitForURL(/\/medication\/detail\?id=/, { timeout: 10_000 })
    expect(new URL(page.url()).searchParams.get('id')).toBeTruthy()
  })
})
