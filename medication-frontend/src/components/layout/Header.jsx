'use client'
import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import PropTypes from 'prop-types'

export default function Header({ title, subtitle, showBack = false, onBack }) {
  const router = useRouter()

  const handleBack = () => {
    if (onBack) {
      onBack()
    } else {
      router.back()
    }
  }

  return (
    <header className="bg-surface border-b border-line px-6 py-5 sticky top-0 z-40">
      <div className="flex items-center gap-4">
        {showBack && (
          <button
            onClick={handleBack}
            className="p-1 -ml-1 text-muted hover:bg-surface-2 rounded-lg cursor-pointer active:scale-[0.98] transition-all duration-150"
          >
            <ChevronLeft size={24} />
          </button>
        )}
        <div>
          {subtitle && <p className="text-muted text-xs mb-0.5">{subtitle}</p>}
          <h1 className="text-xl font-bold text-ink">{title}</h1>
        </div>
      </div>
    </header>
  )
}

Header.propTypes = {
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string,
  showBack: PropTypes.bool,
  onBack: PropTypes.func,
}

Header.defaultProps = {
  subtitle: null,
  showBack: false,
  onBack: null,
}
