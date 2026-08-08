'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import api, { parseApiError, showError } from '@/lib/api'
import { config, securityUtils } from '@/config/env'
import {
  AUTH_STATUS,
  LOGOUT_REASON,
  consumeLogoutReason,
  getAuthStatus,
  markLoggedIn,
  markLoggedOut,
} from '@/lib/authStatus'
import { Pill } from 'lucide-react'
import LoadingSpinner from '@/components/common/LoadingSpinner'

const LOGOUT_MESSAGE_BY_REASON = {
  [LOGOUT_REASON.SESSION_EXPIRED]: '로그인 시간이 오래되어 로그아웃 되었습니다.',
}

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const router = useRouter()

  // 1) 직전 로그아웃 사유가 있으면 1회성 안내 토스트 — 새로고침·재방문 시 반복 금지
  useEffect(() => {
    const reason = consumeLogoutReason()
    const message = LOGOUT_MESSAGE_BY_REASON[reason]
    if (message) toast(message)
  }, [])

  // 2) 로그인 힌트가 LOGIN 일 때만 서버 세션 유효성 확인.
  //    NONE / LOGOUT 은 API 호출 자체를 생략해 401 노이즈를 제거한다.
  useEffect(() => {
    let cancelled = false

    const verifySession = async () => {
      if (getAuthStatus() !== AUTH_STATUS.LOGIN) {
        if (!cancelled) setIsCheckingAuth(false)
        return
      }

      try {
        await api.get('/api/v1/profiles', { skipAuthInterceptor: true })
        if (!cancelled) router.replace('/main')
      } catch {
        // LOGIN 힌트는 있었지만 서버 세션 만료 — 이번 세션 내에서 직접 안내.
        markLoggedOut({ reason: LOGOUT_REASON.SESSION_EXPIRED })
        if (!cancelled) {
          toast(LOGOUT_MESSAGE_BY_REASON[LOGOUT_REASON.SESSION_EXPIRED])
          setIsCheckingAuth(false)
        }
      }
    }

    verifySession()
    return () => {
      cancelled = true
    }
  }, [router])

  // 보안 검증: 개발자 로그인 표시 여부
  const showDevLogin = securityUtils.shouldShowDevLogin()

  // 환경 변조 탐지
  if (securityUtils.detectEnvironmentTampering()) {
    console.error('Security warning: Environment tampering detected')
  }

  const handleKakaoLogin = async () => {
    setIsLoading(true)

    try {
      // 1. BE에서 OAuth 설정 정보 조회 (HMAC signed state 포함)
      const { data } = await api.get('/api/v1/auth/kakao/config')
      const { client_id, redirect_uri, authorize_url, state } = data

      // 2. BE에서 받은 state 저장 (CSRF 방지)
      localStorage.setItem('oauth_state', state)

      // 3. 카카오(Mock) 인증 페이지로 리다이렉트
      // - local/dev: Mock 서버 (authorize_url이 API_BASE_URL/api/v1/mock/kakao/authorize)
      // - prod: 실제 카카오 서버 (https://kauth.kakao.com/oauth/authorize)
      const params = new URLSearchParams({
        client_id,
        redirect_uri,
        response_type: 'code',
        state,
      })

      window.location.href = `${authorize_url}?${params.toString()}`
    } catch (err) {
      console.error('카카오 로그인 설정 조회 실패:', err)
      const parsed = err.parsed || parseApiError(err)
      showError(parsed.message)
      setIsLoading(false)
    }
  }

const handleTestLogin = async () => {
    setIsLoading(true)

    try {
      // 1. 브라우저 이동 없이 백그라운드(Axios)에서 백엔드 API 호출
      // api 객체를 사용하므로 프록시(localhost:3000 -> localhost:8000)를 안전하게 탑니다.
      const response = await api.get('/api/v1/auth/kakao/callback', {
        params: {
          code: 'dev_test_login',
          state: 'dev_mode'
        }
      })

      // 2. 백엔드가 정상적으로 토큰(쿠키)과 JSON(200 OK)을 응답했다면?
      if (response.status === 200) {
        // 로그인 성공 — 재접속자 판별용 힌트 기록 (kakao 정식 콜백과 동일 처리)
        markLoggedIn()

        const { show_survey } = response.data

        // 프론트엔드가 주도적으로 화면 전환
        if (show_survey) {
          router.push('/main?showSurvey=true')
        } else {
          router.push('/main')
        }
      }
    } catch (err) {
      console.error('개발용 로그인 실패:', err)
      const parsed = err.parsed || parseApiError(err)
      showError(parsed.message || '로그인 처리 중 오류가 발생했습니다.')
      setIsLoading(false)
    }
  }

  // 인증 상태 확인 중이면 로딩 표시
  if (isCheckingAuth) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen bg-bg">
        <div className="flex flex-col items-center gap-4">
          <LoadingSpinner size="lg" />
          <p className="text-muted font-medium">로그인 상태 확인 중...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-bg px-4">

      <div className="bg-surface p-10 rounded-2xl shadow-[var(--shadow-card)] border border-line w-96 max-w-full text-center">

        {/* 로고 */}
        <div className="w-16 h-16 bg-accent-soft rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Pill size={32} className="text-accent" />
        </div>
        <h1 className="text-3xl font-black text-ink mb-2">Doseph</h1>
        <p className="text-muted text-base mb-8">내 약을 안전하게 관리하세요</p>

        {/* 카카오 버튼 */}
        <button
          onClick={() => handleKakaoLogin()}
          disabled={isLoading}
          className="w-full bg-yellow-400 text-black/85 py-3 rounded-xl font-semibold text-sm mb-3 cursor-pointer hover:bg-yellow-500 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? '연결 중...' : '카카오로 로그인'}
        </button>

        {/* 개발자 로그인 버튼 (보안 검증된 환경에서만 표시) */}
        {showDevLogin && (
          <button
            onClick={handleTestLogin}
            disabled={isLoading}
            className="w-full bg-ink text-bg py-3 rounded-xl font-semibold text-sm mb-3 cursor-pointer hover:opacity-90 transition-all disabled:opacity-50"
          >
            개발자로 로그인 ({config.ENV})
          </button>
        )}

        {/* 구분선 */}
        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-px bg-line" />
          <span className="text-muted text-xs">또는</span>
          <div className="flex-1 h-px bg-line" />
        </div>

        {/* 네이버 버튼 */}
        <button className="w-full bg-green-500 text-white py-3 rounded-xl font-semibold text-sm cursor-pointer hover:bg-green-600 active:scale-[0.98] transition-transform duration-150">
          네이버로 로그인
        </button>

        {/* 하단 약관 */}
        <p className="text-muted text-sm mt-8">
          로그인 시 서비스 이용약관에 동의하게 됩니다
        </p>

      </div>

    </main>
  )
}
