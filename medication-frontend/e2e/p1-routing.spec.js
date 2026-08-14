// ── P1 라우팅 계약 (Red-first) ──────────────────────────────────────
// 흐름: 정적 export 전환 후의 "라우팅 스펙"을 못박는다.
//       신규 쿼리 라우트 200 / 구 동적 라우트 404 / 딥링크 파라미터 유지.
// 상태: 전환 전에는 실패(Red)가 정상이다.
//       - static 타겟: out/ 미생성 or 신규 라우트 부재 -> 404 (Red)
//       - dev 타겟   : 구 동적 라우트가 아직 200 -> "404 기대" 단언 실패 (Red)
// 데이터 비의존: 백엔드 없이도 문서 응답 코드/파라미터만 검증한다.

import { test, expect } from '@playwright/test'

// 이 스펙은 로그인 세션이 필요 없다(문서 응답 코드 검증). 게스트 컨텍스트로 실행.
test.use({ storageState: { cookies: [], origins: [] } })

// 전환 후 "존재해야 하는" 신규 쿼리 라우트
const NEW_ROUTES = ['/medication/detail', '/medication/group']

// 전환 후 "사라져야 하는" 구 동적 라우트 (경로 세그먼트 방식)
const OLD_DYNAMIC_ROUTES = ['/medication/1', '/medication/groups/1']

test.describe('신규 쿼리 라우트는 존재해야 한다 (200)', () => {
  for (const route of NEW_ROUTES) {
    test(`GET ${route} -> 200`, async ({ page }) => {
      const res = await page.goto(route)
      expect(res, `${route} 응답이 있어야 함`).not.toBeNull()
      expect(
        res.status(),
        `${route} 는 전환 후 실제 페이지여야 한다(현재 미생성 시 404 = Red)`,
      ).toBe(200)
      // Next 기본 404 화면이 아닌지 확인 (정적 404.html 도 status 200 로 서빙될 여지 차단)
      await expect(page.locator('body')).not.toContainText('This page could not be found')
    })
  }
})

test.describe('구 동적 라우트는 사라져야 한다 (404)', () => {
  for (const route of OLD_DYNAMIC_ROUTES) {
    test(`GET ${route} -> 404`, async ({ page }) => {
      const res = await page.goto(route)
      expect(res, `${route} 응답이 있어야 함`).not.toBeNull()
      expect(
        res.status(),
        `${route} 는 쿼리 방식 전환 후 존재하지 않아야 한다(현재 200 = Red)`,
      ).toBe(404)
    })
  }
})

test.describe('딥링크 쿼리 파라미터가 URL 에 유지된다', () => {
  test('GET /medication/detail?id=999 -> 200 + id 보존', async ({ page }) => {
    const res = await page.goto('/medication/detail?id=999')
    expect(res?.status(), '딥링크 진입은 200 이어야 한다(현재 404 = Red)').toBe(200)
    expect(new URL(page.url()).searchParams.get('id')).toBe('999')
    await expect(page.locator('body')).not.toContainText('This page could not be found')
  })

  test('GET /medication/group?group_id=999 -> 200 + group_id 보존', async ({ page }) => {
    const res = await page.goto('/medication/group?group_id=999')
    expect(res?.status(), '딥링크 진입은 200 이어야 한다(현재 404 = Red)').toBe(200)
    expect(new URL(page.url()).searchParams.get('group_id')).toBe('999')
    await expect(page.locator('body')).not.toContainText('This page could not be found')
  })
})
