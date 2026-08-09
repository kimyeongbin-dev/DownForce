'use client'

// /medication/groups/[group_id] — 처방전 그룹 drill-down
//
// 모든 fetch / mutation 은 PrescriptionGroupContext 의 hook 으로 위임.
// 페이지는 화면 정책 (편집 모드 / confirm / 토스트) 만 책임.

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Calendar,
  Building2,
  ChevronRight,
  Pill,
  Trash2,
  Pencil,
  PencilLine,
  CircleCheck,
  Hospital,
} from 'lucide-react'
import toast from 'react-hot-toast'

import { showError } from '@/lib/api'
import BottomNav from '@/components/layout/BottomNav'
import { useConfirm } from '@/components/common/ConfirmDialog'
import MedicationDetailPanel from '@/components/medication/MedicationDetailPanel'
import { usePrescriptionGroup } from '@/contexts/PrescriptionGroupContext'

// 등록 경로 — 사용자에게 보일 한국어 라벨 매핑
const SOURCE_LABEL = {
  OCR: '이미지',
  MANUAL: '직접 입력',
  MIGRATED: '기존 등록',
}

function formatDate(isoStr) {
  if (!isoStr) return '날짜 미상'
  const [yyyy, mm, dd] = isoStr.split('-')
  return `${yyyy}년 ${parseInt(mm, 10)}월 ${parseInt(dd, 10)}일`
}

function EditableMetaRow({
  icon,
  value,
  placeholder,
  emptyLabel,
  isEditing,
  draft,
  onDraft,
  onStart,
  onCancel,
  onSave,
  isSaving,
  maxLength,
}) {
  return (
    <div className="flex items-center gap-2 text-xs text-ink">
      {icon}
      {isEditing ? (
        <input
          type="text"
          value={draft}
          onChange={(e) => onDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              onSave()
            }
            if (e.key === 'Escape') {
              e.preventDefault()
              onCancel()
            }
          }}
          onBlur={() => {
            if (!isSaving) onSave()
          }}
          placeholder={placeholder}
          maxLength={maxLength}
          className="flex-1 bg-surface-2 border border-line rounded px-2 py-1 outline-none focus:border-line"
          autoFocus
        />
      ) : (
        <>
          <span
            className={`${value ? 'font-bold' : 'text-muted'} cursor-text select-none`}
            onDoubleClick={onStart}
            title="더블클릭하거나 연필 아이콘으로 수정"
          >
            {value || emptyLabel}
          </span>
          <button
            type="button"
            onClick={onStart}
            className="p-1 rounded hover:bg-surface-2 text-muted hover:text-ink cursor-pointer"
            aria-label="수정"
          >
            <Pencil size={12} />
          </button>
        </>
      )}
    </div>
  )
}

function MedicationItem({ medication, onClick, selected = false }) {
  const dose = medication.dose_per_intake || ''
  const instr = medication.intake_instruction || ''
  const inactive = !medication.is_active
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left bg-surface rounded-2xl border transition-colors p-4 flex items-center gap-3 cursor-pointer ${
        selected ? 'border-accent ring-1 ring-accent' : 'border-line hover:border-line'
      }`}
    >
      <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center shrink-0">
        <Pill size={18} />
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-ink truncate">{medication.medicine_name}</span>
          {inactive && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-surface-2 text-muted shrink-0">완료</span>
          )}
        </div>
        {(dose || instr) && (
          <p className="text-xs text-muted truncate">
            {[dose, instr].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>
      <ChevronRight size={18} className="text-muted shrink-0" />
    </button>
  )
}

export default function PrescriptionGroupDetailPage() {
  const router = useRouter()
  const params = useParams()
  const confirm = useConfirm()
  const groupId = params?.group_id
  const {
    groupsById,
    fetchGroupDetail,
    updateGroup,
    markGroupCompleted,
    deleteGroup,
  } = usePrescriptionGroup()

  // detail 은 Context cache 로부터 derive — fetch 가 끝나면 cache 가 채워지며 자동 렌더.
  const group = groupId ? groupsById[groupId] || null : null
  const [isLoading, setIsLoading] = useState(!group)
  const [error, setError] = useState(null)
  const [editingField, setEditingField] = useState(null)
  const [draft, setDraft] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isCompleting, setIsCompleting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    if (!groupId) return
    let cancelled = false
    setIsLoading(true)
    setError(null)
    fetchGroupDetail(groupId, { forceRefresh: true })
      .catch((err) => {
        if (cancelled) return
        setError(err?.response?.status === 404 ? '처방전을 찾을 수 없어요.' : '처방전을 불러오지 못했어요.')
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [groupId, fetchGroupDetail])

  const startEdit = (field) => {
    setDraft(group?.[field] || '')
    setEditingField(field)
  }
  const cancelEdit = () => {
    setEditingField(null)
    setDraft('')
  }
  const saveEdit = async () => {
    if (!groupId || !editingField) return
    const next = draft.trim() || null
    const currentField = editingField
    if ((group?.[currentField] || null) === next) {
      setEditingField(null)
      return
    }
    setIsSaving(true)
    try {
      await updateGroup(groupId, { [currentField]: next })
      setEditingField(null)
      toast.success(currentField === 'hospital_name' ? '병원을 수정했어요.' : '진료과를 수정했어요.')
    } catch {
      showError('수정에 실패했어요.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleComplete = async () => {
    if (!groupId || !group) return
    const ok = await confirm({
      title: '복용 완료 처리',
      message: '이 처방전을 복용 완료로 처리할까요?\n그룹 안 모든 약이 비활성으로 변경됩니다.',
      confirmLabel: '완료 처리',
    })
    if (!ok) return
    setIsCompleting(true)
    try {
      await markGroupCompleted(groupId)
      toast.success('복용 완료 처리됐어요.')
    } catch {
      showError('복용 완료 처리에 실패했어요.')
    } finally {
      setIsCompleting(false)
    }
  }

  const handleDelete = async () => {
    if (!groupId) return
    const ok = await confirm({
      title: '처방전 삭제',
      message: '이 처방전을 삭제할까요?\n안 약품과 관련 가이드도 함께 정리됩니다.',
      confirmLabel: '삭제',
      danger: true,
    })
    if (!ok) return
    setIsDeleting(true)
    try {
      await deleteGroup(groupId)
      toast.success('처방전을 삭제했어요.')
      router.push('/medication')
    } catch {
      showError('삭제에 실패했어요.')
      setIsDeleting(false)
    }
  }

  const allInactive = group?.medications?.length > 0 && group.medications.every((m) => !m.is_active)

  // 데스크탑 split-pane: lg 이상에서 우측 panel 에 약품 상세 inline 표시.
  // 같은 처방전의 약 클릭 시 페이지 push 대신 selectedMedicationId 만 변경.
  // 모바일 (< lg) 에선 약 클릭 시 기존처럼 /medication/[id] 페이지로 이동.
  const [selectedMedicationId, setSelectedMedicationId] = useState(null)
  const handleMedicationClick = (medicationId) => {
    if (typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches) {
      setSelectedMedicationId(medicationId)
    } else {
      router.push(`/medication/${medicationId}`)
    }
  }
  // 그룹의 약 list 가 갱신되면 선택된 약이 사라졌는지 체크 (삭제 등)
  useEffect(() => {
    if (!selectedMedicationId || !group?.medications) return
    if (!group.medications.find((m) => m.id === selectedMedicationId)) {
      setSelectedMedicationId(null)
    }
  }, [group?.medications, selectedMedicationId])

  return (
    <main className="min-h-screen bg-surface-2 pb-24">
      <header className="sticky top-0 z-20 bg-surface border-b border-line">
        <div className="max-w-4xl mx-auto px-2 py-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.push('/medication')}
            className="p-2 rounded-lg hover:bg-surface-2 cursor-pointer"
            aria-label="뒤로"
          >
            <ArrowLeft size={18} className="text-ink" />
          </button>
          <h1 className="flex-1 text-base font-bold text-ink truncate">처방전 상세</h1>
          {group && (
            <>
              <button
                type="button"
                onClick={() => {
                  const ids = (group.medications || []).map((m) => m.id).join(',')
                  if (!ids) {
                    showError('수정할 약품이 없어요.')
                    return
                  }
                  router.push(`/medication/edit?ids=${ids}`)
                }}
                disabled={!group.medications?.length}
                title="약 정보 수정"
                className="p-2 rounded-lg hover:bg-blue-50 text-blue-500 cursor-pointer disabled:text-muted disabled:cursor-default"
                aria-label="약 정보 수정"
              >
                <PencilLine size={18} />
              </button>
              <button
                type="button"
                onClick={handleComplete}
                disabled={isCompleting || allInactive}
                title={allInactive ? '이미 복용 완료됨' : '복용 완료 처리'}
                className={`p-2 rounded-lg cursor-pointer transition-colors ${
                  allInactive ? 'text-muted cursor-default' : 'text-green-600 hover:bg-green-50'
                }`}
                aria-label="복용 완료 처리"
              >
                <CircleCheck size={18} />
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="p-2 rounded-lg hover:bg-red-50 text-red-500 cursor-pointer"
                aria-label="처방전 삭제"
              >
                <Trash2 size={18} />
              </button>
            </>
          )}
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-4 space-y-4">
        {isLoading && !group ? (
          <div className="bg-surface rounded-2xl border border-line p-4 animate-pulse space-y-3">
            <div className="h-4 bg-surface-2 rounded w-32" />
            <div className="h-3 bg-surface-2 rounded w-24" />
          </div>
        ) : error ? (
          <p className="text-sm text-red-500 text-center py-10">{error}</p>
        ) : group ? (
          // 데스크탑 (lg+) : 왼쪽 (그룹 메타 + 약 list) + 오른쪽 (약품 상세).
          // 모바일: 같은 column 안에 그룹 메타 → 약 list 가 세로로 흐른다 (오른쪽 패널 hidden).
          <div className="lg:grid lg:grid-cols-[minmax(280px,360px)_1fr] lg:gap-4">
            <div className="space-y-4">
              {/* 그룹 메타 카드 */}
              <div className="bg-surface rounded-2xl border border-line p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm font-bold text-ink">
                  <Calendar size={16} className="text-muted" />
                  <span>{formatDate(group.dispensed_date)}</span>
                </div>
                <EditableMetaRow
                  icon={<Hospital size={14} className="shrink-0 text-muted" />}
                  fieldKey="hospital_name"
                  value={group.hospital_name}
                  placeholder="병원 (예: 서울내과의원)"
                  emptyLabel="병원 미상"
                  isEditing={editingField === 'hospital_name'}
                  draft={draft}
                  onDraft={setDraft}
                  onStart={() => startEdit('hospital_name')}
                  onCancel={cancelEdit}
                  onSave={saveEdit}
                  isSaving={isSaving}
                  maxLength={128}
                />
                <EditableMetaRow
                  icon={<Building2 size={14} className="shrink-0 text-muted" />}
                  fieldKey="department"
                  value={group.department}
                  placeholder="진료과 (예: 내과)"
                  emptyLabel="진료과 미상"
                  isEditing={editingField === 'department'}
                  draft={draft}
                  onDraft={setDraft}
                  onStart={() => startEdit('department')}
                  onCancel={cancelEdit}
                  onSave={saveEdit}
                  isSaving={isSaving}
                  maxLength={64}
                />
                <p className="text-[11px] text-muted pt-1">
                  약 {group.medications?.length || 0}개 · 등록 경로 {SOURCE_LABEL[group.source] || group.source}
                  {allInactive && <span className="ml-2 text-green-500 font-bold">· 복용 완료</span>}
                </p>
              </div>

              {/* 약 list */}
              <div className="space-y-2">
                {(group.medications || []).length === 0 ? (
                  <p className="text-sm text-muted text-center py-8">이 처방전엔 등록된 약이 없어요.</p>
                ) : (
                  group.medications.map((m) => (
                    <MedicationItem
                      key={m.id}
                      medication={m}
                      onClick={() => handleMedicationClick(m.id)}
                      selected={m.id === selectedMedicationId}
                    />
                  ))
                )}
              </div>
            </div>

            {/* 우측 — 약품 상세 panel (lg+ 에서만 표시, 모바일은 별 페이지로 push) */}
            <div className="hidden lg:block bg-surface rounded-2xl border border-line p-5">
              <MedicationDetailPanel
                medicationId={selectedMedicationId}
                onDeleted={() => setSelectedMedicationId(null)}
              />
            </div>
          </div>
        ) : null}
      </div>

      <BottomNav />
    </main>
  )
}
