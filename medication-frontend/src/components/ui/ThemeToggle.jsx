'use client'
import { useState, useEffect } from 'react'
import { Sun, Moon } from 'lucide-react'

// ── 라이트/다크 테마 토글 ─────────────────────────────────────────────
// 흐름: 마운트 시 localStorage('theme') 또는 OS 선호 반영
//       -> 클릭 시 <html data-theme> 갱신 + localStorage 저장
//       (globals.css 의 :root[data-theme] 오버라이드와 연동. FOUC 방지 스크립트는 layout head)
export default function ThemeToggle({ className = '' }) {
  const [theme, setTheme] = useState(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const stored = localStorage.getItem('theme')
    if (stored === 'dark' || stored === 'light') {
      setTheme(stored)
    } else {
      setTheme(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    }
  }, [])

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    try {
      localStorage.setItem('theme', next)
    } catch {
      /* localStorage 접근 불가 시 무시 */
    }
  }

  const base =
    'w-9 h-9 rounded-lg flex items-center justify-center text-muted ' +
    'hover:text-ink hover:bg-surface-2 transition-colors cursor-pointer ' +
    `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${className}`

  // 하이드레이션 불일치 방지: 마운트 전엔 아이콘 없이 자리만 확보
  if (!mounted) return <span className={base} aria-hidden="true" />

  return (
    <button
      type="button"
      onClick={toggle}
      className={base}
      aria-label={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
    >
      {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  )
}
