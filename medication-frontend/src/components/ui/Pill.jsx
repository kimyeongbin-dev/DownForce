'use client'
import PropTypes from 'prop-types'

// ── 상태/태그 칩 프리미티브 ───────────────────────────────────────────
// tone: 'neutral'(기본 태그) | 'brand'(강조) | 'success' | 'warning' | 'critical'
const TONES = {
  neutral: 'bg-surface-2 text-ink border border-line',
  brand: 'bg-accent-soft text-accent',
  success: 'bg-success/12 text-success',
  warning: 'bg-warning/12 text-warning',
  critical: 'bg-critical/12 text-critical',
}

export default function Pill({ tone = 'neutral', className = '', children, ...props }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 h-7 text-xs font-bold ${TONES[tone]} ${className}`}
      {...props}
    >
      {children}
    </span>
  )
}

Pill.propTypes = {
  tone: PropTypes.oneOf(['neutral', 'brand', 'success', 'warning', 'critical']),
  className: PropTypes.string,
  children: PropTypes.node,
}
