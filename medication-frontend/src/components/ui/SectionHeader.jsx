'use client'
import PropTypes from 'prop-types'

// ── 섹션 헤더 (아이콘 배지 + 제목 + 우측 액션) ─────────────────────────
// surface 카드 상단에 재사용. 아이콘 배지는 accent 톤으로 통일.
export default function SectionHeader({ icon, title, action, className = '' }) {
  return (
    <div className={`flex items-center justify-between mb-6 ${className}`}>
      <div className="flex items-center gap-3 min-w-0">
        {icon && (
          <div className="w-10 h-10 shrink-0 rounded-xl bg-accent-soft text-accent flex items-center justify-center">
            {icon}
          </div>
        )}
        <h2 className="text-xl font-black tracking-tight text-ink truncate">{title}</h2>
      </div>
      {action}
    </div>
  )
}

SectionHeader.propTypes = {
  icon: PropTypes.node,
  title: PropTypes.node.isRequired,
  action: PropTypes.node,
  className: PropTypes.string,
}
