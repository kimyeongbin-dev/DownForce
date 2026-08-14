// ── 전 페이지 스모크 (회귀 방지 그물) ───────────────────────────────
// 흐름: 각 라우트 진입 -> 앱이 크래시 없이 렌더되는지 확인.
//       (1) 미처리 예외(pageerror) 0건  (2) body 렌더  (3) Next 404 화면 아님
// 목적: Step 3 라우팅/설정 변경이 기존 페이지를 깨뜨리지 않음을 매 단계 보증.
// 전제: storageState(dev 로그인 세션) + docker fastapi(:8000) 기동.

import { test, expect } from '@playwright/test'

// 전환과 무관하게 "이미 존재하며 렌더돼야 하는" 라우트들
const ROUTES = [
  { path: '/', name: '랜딩' },
  { path: '/login', name: '로그인' },
  { path: '/main', name: '메인' },
  { path: '/medication', name: '복용 가이드' },
  { path: '/medication/edit', name: '약품 편집' },
  { path: '/mypage', name: '마이페이지' },
  { path: '/challenge', name: '챌린지' },
  { path: '/lifestyle-guide', name: '생활 가이드' },
  { path: '/ocr', name: 'OCR 시작' },
  { path: '/ocr/loading', name: 'OCR 로딩' },
  { path: '/ocr/result', name: 'OCR 결과' },
  { path: '/survey', name: '설문' },
]

for (const route of ROUTES) {
  test(`${route.name} (${route.path}) 렌더 스모크`, async ({ page }) => {
    const pageErrors = []
    page.on('pageerror', (err) => pageErrors.push(err.message))

    const res = await page.goto(route.path, { waitUntil: 'domcontentloaded' })
    expect(res?.status(), `${route.path} 문서 응답은 4xx/5xx 가 아니어야 한다`).toBeLessThan(400)

    await expect(page.locator('body')).toBeVisible()
    await expect(page.locator('body')).not.toContainText('This page could not be found')

    expect(pageErrors, `${route.path} 에서 미처리 예외 발생: ${pageErrors.join(' | ')}`).toEqual([])
  })
}

// OAuth 콜백은 code/state 없이 진입 시 정상적으로 오류 처리(→ 로그인 등)로 흘러야 하며,
// 앱 셸이 하드 크래시하지 않아야 한다.
test('OAuth 콜백(/auth/kakao/callback) 파라미터 없이 진입해도 크래시 없음', async ({ page }) => {
  const pageErrors = []
  page.on('pageerror', (err) => pageErrors.push(err.message))

  await page.goto('/auth/kakao/callback', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('body')).toBeVisible()
  expect(pageErrors, `콜백에서 미처리 예외: ${pageErrors.join(' | ')}`).toEqual([])
})
