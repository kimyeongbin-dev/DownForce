'use client'
import PropTypes from 'prop-types'

// ── 재사용 카드 프리미티브 ────────────────────────────────────────────
// tone: 'surface'(기본 면) | 'accent'(브랜드 강조/피처 카드)
// 색·반경·그림자는 시맨틱 토큰만 참조 -> 테마 자동 대응, 변경은 globals.css 1곳.
const TONES = {
  surface: 'bg-surface text-ink border border-line',
  accent: 'bg-accent text-accent-ink',
}

export default function Card({ tone = 'surface', className = '', children, ...props }) {
  return (
    <div
      className={`rounded-card p-6 sm:p-8 shadow-[var(--shadow-card)] ${TONES[tone]} ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}

Card.propTypes = {
  tone: PropTypes.oneOf(['surface', 'accent']),
  className: PropTypes.string,
  children: PropTypes.node,
}
