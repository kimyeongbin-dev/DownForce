'use client'

// 약품명 실시간 자동완성 input.
// - GET /api/v1/medicines/suggest?q=…&limit=8 (pg_trgm 기반 fuzzy 매칭)
// - 250ms 디바운스 + 최소 2자 입력 + AbortController 로 in-flight 취소
// - 키보드 ↑/↓/Enter/Esc 지원
// - react-hook-form 의 Controller 와 함께 사용 권장 (value/onChange 제어형)

import { useEffect, useRef, useState } from 'react'
import api from '@/lib/api'

const DEBOUNCE_MS = 250
const MIN_QUERY_LENGTH = 2
const DEFAULT_LIMIT = 8

export default function MedicineNameAutocomplete({
  value,
  onChange,
  onSelectSuggestion,
  placeholder = '약품명 입력',
  className = '',
  inputClassName = '',
  inputProps = {},
  autoFocus = false,
  disabled = false,
}) {
  const [suggestions, setSuggestions] = useState([])
  const [isOpen, setIsOpen] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(-1)
  const [isLoading, setIsLoading] = useState(false)

  const wrapperRef = useRef(null)
  const inputRef = useRef(null)
  const abortRef = useRef(null)
  const debounceRef = useRef(null)
  const skipFetchRef = useRef(false)
  const userTypedRef = useRef(false)

  // ── debounced fetch (입력 변경 시) ────────────────────────────────────
  // 흐름: 사용자 typing 여부 확인 -> 최소 길이 검사 -> debounce -> API 호출
  //       -> dropdown open. mount 시 prefilled value (OCR 결과 등) 는 fetch 스킵.
  useEffect(() => {
    if (skipFetchRef.current) {
      skipFetchRef.current = false
      return
    }
    if (!userTypedRef.current) {
      return
    }
    const trimmed = (value || '').trim()
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setSuggestions([])
      setIsOpen(false)
      setHighlightIndex(-1)
      if (abortRef.current) abortRef.current.abort()
      return
    }

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort()
      const controller = new AbortController()
      abortRef.current = controller
      setIsLoading(true)
      try {
        const res = await api.get('/api/v1/medicines/suggest', {
          params: { q: trimmed, limit: DEFAULT_LIMIT },
          signal: controller.signal,
        })
        const list = res.data || []
        setSuggestions(list)
        setIsOpen(list.length > 0)
        setHighlightIndex(-1)
      } catch (err) {
        if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return
        setSuggestions([])
        setIsOpen(false)
      } finally {
        setIsLoading(false)
      }
    }, DEBOUNCE_MS)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [value])

  // ── 외부 클릭 감지 — dropdown 닫기 ────────────────────────────────────
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false)
        setHighlightIndex(-1)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // ── 항목 선택 ────────────────────────────────────────────────────────
  const handleSelect = (item) => {
    skipFetchRef.current = true
    onChange?.(item.medicine_name)
    onSelectSuggestion?.(item)
    setIsOpen(false)
    setHighlightIndex(-1)
  }

  // ── 키보드 navigation ────────────────────────────────────────────────
  const handleKeyDown = (e) => {
    if (!isOpen || suggestions.length === 0) {
      if (e.key === 'Escape') setIsOpen(false)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightIndex((prev) => (prev + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIndex((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1))
    } else if (e.key === 'Enter') {
      if (highlightIndex >= 0 && highlightIndex < suggestions.length) {
        e.preventDefault()
        handleSelect(suggestions[highlightIndex])
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false)
      setHighlightIndex(-1)
    }
  }

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <input
        ref={inputRef}
        type="text"
        value={value || ''}
        onChange={(e) => {
          userTypedRef.current = true
          onChange?.(e.target.value)
        }}
        onFocus={() => userTypedRef.current && suggestions.length > 0 && setIsOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        autoComplete="off"
        className={inputClassName}
        {...inputProps}
      />
      {isOpen && suggestions.length > 0 && (
        <ul
          className="absolute left-0 right-0 top-full mt-1 z-50 bg-surface border border-line rounded-xl shadow-lg max-h-72 overflow-y-auto"
          role="listbox"
        >
          {isLoading && (
            <li className="px-4 py-2 text-xs text-muted">검색 중…</li>
          )}
          {suggestions.map((item, idx) => {
            const isActive = idx === highlightIndex
            return (
              <li
                key={item.id}
                role="option"
                aria-selected={isActive}
                onMouseDown={(e) => {
                  e.preventDefault()
                  handleSelect(item)
                }}
                onMouseEnter={() => setHighlightIndex(idx)}
                className={`px-4 py-2 text-sm cursor-pointer transition-colors ${
                  isActive ? 'bg-accent text-accent-ink' : 'text-ink hover:bg-surface-2'
                }`}
              >
                <span className="font-bold">{item.medicine_name}</span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
