// ── dev 로그인 세션 확보 (global setup) ─────────────────────────────
// 흐름: /login 진입 -> "개발자로 로그인" 클릭 -> 백엔드가 HttpOnly 쿠키 발급
//       -> /main 도달 확인 -> storageState(쿠키 포함)를 파일로 저장
// 목적: 이후 인증 페이지 테스트가 매번 로그인하지 않고 세션을 재사용하도록 한다.
// 전제: docker fastapi(:8000) 기동 + ENV=local(개발자 로그인 버튼 노출).

import { test as setup, expect } from '@playwright/test'

const AUTH_FILE = 'e2e/.auth/user.json'

setup('dev 로그인으로 세션 저장', async ({ page }) => {
  await page.goto('/login')

  // ENV=local 에서만 노출되는 개발자 로그인 버튼
  const devLoginButton = page.getByRole('button', { name: /개발자로 로그인/ })
  await expect(
    devLoginButton,
    'ENV=local 이어야 개발자 로그인 버튼이 보인다(백엔드 기동 + NEXT_PUBLIC_ENV=local 확인)',
  ).toBeVisible()

  await devLoginButton.click()

  // 로그인 성공 시 /main 으로 이동
  await page.waitForURL(/\/main/, { timeout: 15_000 })

  // 세션(쿠키) 저장 — 백엔드(:8000) HttpOnly 쿠키까지 컨텍스트 쿠키 잼에 포함됨
  await page.context().storageState({ path: AUTH_FILE })
})
